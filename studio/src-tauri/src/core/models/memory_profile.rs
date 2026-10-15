use serde::Serialize;
use std::{
    fs::File,
    io::{Seek, SeekFrom},
};

use super::gguf::{read_string, read_u32, read_u64};

/// Compact GGUF on-disk tensor footprint, including per-tensor alignment padding.
/// These are not llama.cpp device allocation measurements.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelMemoryProfile {
    pub layer_bytes: Vec<u64>,
    pub shared_bytes: u64,
    pub output_bytes: u64,
    pub stored_bytes: u64,
    pub has_output_tensor: bool,
    pub token_embedding_bytes: u64,
    pub active_layer_count: usize,
    pub cache_layers: Option<Vec<CacheLayer>>,
}

/// Per-block cache requirements. Recurrent bytes are independent of context length.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheLayer {
    pub kv_heads: u64,
    pub recurrent_bytes: u64,
}

pub struct TensorScan {
    pub total_parameters: u128,
    pub expert_parameters: u128,
    pub memory: Option<ModelMemoryProfile>,
}

struct TensorEntry {
    name: String,
    offset: u64,
}

fn align_up(value: u64, alignment: u64) -> Option<u64> {
    value
        .checked_add(alignment.checked_sub(1)?)
        .map(|value| value / alignment * alignment)
}

/// Reads only GGUF tensor-info records. Actual tensor payloads are never read.
pub fn scan_tensors(
    file: &mut File,
    tensor_count: u64,
    layer_count: Option<u64>,
    alignment: u64,
) -> Result<TensorScan, String> {
    if tensor_count > 1_000_000 {
        return Err("GGUF tensor count is unexpectedly large".to_string());
    }
    let mut total_parameters = 0_u128;
    let mut expert_parameters = 0_u128;
    let mut tensors = Vec::new();

    for _ in 0..tensor_count {
        let name = read_string(file)?;
        let dimensions = read_u32(file)?;
        let mut elements = 1_u128;
        for _ in 0..dimensions {
            elements = elements
                .checked_mul(u128::from(read_u64(file)?))
                .ok_or_else(|| "GGUF tensor parameter count overflow".to_string())?;
        }
        let _tensor_type = read_u32(file)?;
        let offset = read_u64(file)?;
        total_parameters = total_parameters
            .checked_add(elements)
            .ok_or_else(|| "GGUF parameter count overflow".to_string())?;

        let lower_name = name.to_ascii_lowercase();
        if lower_name.contains("exps")
            || lower_name.contains(".experts.")
            || lower_name.contains("expert")
        {
            expert_parameters = expert_parameters
                .checked_add(elements)
                .ok_or_else(|| "GGUF expert parameter count overflow".to_string())?;
        }
        tensors.push(TensorEntry { name, offset });
    }

    let memory = memory_from_offsets(file, tensors, layer_count, alignment);
    Ok(TensorScan {
        total_parameters,
        expert_parameters,
        memory,
    })
}

fn memory_from_offsets(
    file: &mut File,
    mut tensors: Vec<TensorEntry>,
    layer_count: Option<u64>,
    alignment: u64,
) -> Option<ModelMemoryProfile> {
    let layers = usize::try_from(layer_count?).ok()?;
    if layers == 0 || layers > 65_536 || tensors.is_empty() || alignment == 0 || alignment > 4096 {
        return None;
    }
    let data_start = align_up(file.stream_position().ok()?, alignment)?;
    let file_size = file.seek(SeekFrom::End(0)).ok()?;
    let payload_bytes = file_size.checked_sub(data_start)?;
    tensors.sort_unstable_by_key(|tensor| tensor.offset);

    let mut profile = ModelMemoryProfile {
        layer_bytes: vec![0; layers],
        shared_bytes: 0,
        output_bytes: 0,
        stored_bytes: 0,
        has_output_tensor: false,
        token_embedding_bytes: 0,
        active_layer_count: layers,
        cache_layers: None,
    };

    for index in 0..tensors.len() {
        let tensor = &tensors[index];
        let end = if index + 1 < tensors.len() {
            tensors[index + 1].offset
        } else {
            payload_bytes
        };
        // Zero-length, overlapping, truncated or sparse tensor ranges are not estimable.
        let size = end.checked_sub(tensor.offset)?;
        if size == 0 || tensor.offset > payload_bytes || end > payload_bytes {
            return None;
        }

        let is_embedding = tensor.name == "token_embd.weight";
        if is_embedding {
            profile.token_embedding_bytes = profile.token_embedding_bytes.checked_add(size)?;
        }
        let destination = if let Some(suffix) = tensor.name.strip_prefix("blk.") {
            let (block, _) = suffix.split_once('.')?;
            let number = block.parse::<usize>().ok()?;
            profile.layer_bytes.get_mut(number)?
        } else if tensor.name.starts_with("output.") {
            profile.has_output_tensor = true;
            &mut profile.output_bytes
        } else if tensor.name.starts_with("output_norm.") {
            &mut profile.output_bytes
        } else {
            &mut profile.shared_bytes
        };
        *destination = destination.checked_add(size)?;
        profile.stored_bytes = profile.stored_bytes.checked_add(size)?;
    }

    // No unsupported gaps before the first tensor: the data region must be accounted for.
    if tensors[0].offset != 0 || profile.stored_bytes != payload_bytes {
        return None;
    }
    Some(profile)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        fs::OpenOptions,
        io::Write,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn groups_layer_output_and_shared_bytes_without_reading_tensor_data() {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-tensor-{id}.bin"));
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
            .unwrap();
        for (name, offset) in [
            ("blk.1.attn.weight", 0_u64),
            ("token_embd.weight", 32),
            ("output.weight", 96),
            ("blk.0.ffn.weight", 160),
        ] {
            file.write_all(&(name.len() as u64).to_le_bytes()).unwrap();
            file.write_all(name.as_bytes()).unwrap();
            file.write_all(&1_u32.to_le_bytes()).unwrap();
            file.write_all(&32_u64.to_le_bytes()).unwrap();
            file.write_all(&2_u32.to_le_bytes()).unwrap();
            file.write_all(&offset.to_le_bytes()).unwrap();
        }
        let start = file.stream_position().unwrap();
        let aligned = align_up(start, 32).unwrap();
        file.write_all(&vec![0; (aligned - start + 224) as usize])
            .unwrap();
        file.seek(SeekFrom::Start(0)).unwrap();
        let result = scan_tensors(&mut file, 4, Some(2), 32).unwrap();
        let profile = result.memory.unwrap();
        assert_eq!(profile.layer_bytes, vec![64, 32]);
        assert_eq!(profile.shared_bytes, 64);
        assert_eq!(profile.output_bytes, 64);
        assert!(profile.has_output_tensor);
        assert_eq!(profile.stored_bytes, 224);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn incomplete_payload_does_not_produce_memory_profile() {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-empty-tensor-{id}.bin"));
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
            .unwrap();
        file.write_all(&0_u64.to_le_bytes()).unwrap();
        file.write_all(&1_u32.to_le_bytes()).unwrap();
        file.write_all(&32_u64.to_le_bytes()).unwrap();
        file.write_all(&0_u32.to_le_bytes()).unwrap();
        file.write_all(&0_u64.to_le_bytes()).unwrap();
        file.seek(SeekFrom::Start(0)).unwrap();
        let result = scan_tensors(&mut file, 1, Some(1), 32).unwrap();
        assert!(result.memory.is_none());
        fs::remove_file(path).unwrap();
    }
}
