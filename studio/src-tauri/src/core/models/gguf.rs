use serde::Serialize;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::Path,
};

const GGUF_MAGIC: &[u8; 4] = b"GGUF";
const MAX_STRING_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilitySignal {
    pub supported: bool,
    pub confidence: &'static str,
    pub evidence: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCapabilities {
    pub category: String,
    pub mtp: CapabilitySignal,
    pub reasoning: CapabilitySignal,
    pub thinking_toggle: CapabilitySignal,
    pub reasoning_effort: CapabilitySignal,
    pub reasoning_preserve: CapabilitySignal,
    pub vision: CapabilitySignal,
    pub tools: CapabilitySignal,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GgufInspection {
    pub architecture: Option<String>,
    pub model_name: Option<String>,
    pub parameter_size: Option<String>,
    pub context_length: Option<u64>,
    pub gpu_layer_count: Option<u64>,
    pub embedding_length: Option<u64>,
    pub attention_head_count: Option<u64>,
    pub attention_head_count_kv: Option<u64>,
    pub attention_key_length: Option<u64>,
    pub attention_value_length: Option<u64>,
    pub pooling_type: Option<String>,
    pub chat_template: Option<String>,
    pub tokenizer_fingerprint: Option<String>,
    pub capabilities: ModelCapabilities,
}

pub struct CapabilityHints<'a> {
    pub repo_id: &'a str,
    pub filename: &'a str,
    pub tags: &'a [String],
    pub pipeline_tag: Option<&'a str>,
}

pub fn inspect_gguf(path: &Path, hints: CapabilityHints<'_>) -> Result<GgufInspection, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("failed to open GGUF {}: {error}", path.display()))?;

    let mut magic = [0_u8; 4];
    file.read_exact(&mut magic)
        .map_err(|error| format!("failed to read GGUF header: {error}"))?;

    if &magic != GGUF_MAGIC {
        return Err(format!("{} is not a GGUF file", path.display()));
    }

    let version = read_u32(&mut file)?;
    if !(2..=3).contains(&version) {
        return Err(format!("unsupported GGUF version {version}"));
    }

    let tensor_count = read_u64(&mut file)?;
    let metadata_count = read_u64(&mut file)?;

    let mut architecture = None;
    let mut model_name = None;
    let mut parameter_size = None;
    let mut parameter_count = None;
    let mut context_length = None;
    let mut gpu_layer_count = None;
    let mut embedding_length = None;
    let mut attention_head_count = None;
    let mut attention_head_count_kv = None;
    let mut attention_key_length = None;
    let mut attention_value_length = None;
    let mut expert_count = None;
    let mut pooling_type = None;
    let mut chat_template = None;
    let mut capability_metadata = Vec::new();
    let mut tokenizer_metadata = Vec::new();

    for _ in 0..metadata_count {
        let key = read_string(&mut file)?;
        let value_type = read_u32(&mut file)?;
        let lower_key = key.to_lowercase();
        let tokenizer_metadata_key = lower_key.starts_with("tokenizer.ggml.");
        let capture_value = lower_key == "general.architecture"
            || lower_key == "general.name"
            || lower_key == "general.size_label"
            || lower_key == "general.parameter_count"
            || lower_key == "general.tags"
            || lower_key.ends_with(".context_length")
            || lower_key.ends_with(".block_count")
            || lower_key.ends_with(".embedding_length")
            || lower_key.ends_with(".attention.head_count")
            || lower_key.ends_with(".attention.head_count_kv")
            || lower_key.ends_with(".attention.key_length")
            || lower_key.ends_with(".attention.value_length")
            || lower_key.ends_with(".expert_count")
            || lower_key == "laya.max_len"
            || lower_key.contains("chat_template")
            || capability_key(&lower_key);

        let value = if tokenizer_metadata_key {
            let value_hash = fingerprint_value(&mut file, value_type)?;
            tokenizer_metadata.push((lower_key.clone(), value_hash));
            None
        } else if capture_value {
            read_value_text(&mut file, value_type)?
        } else {
            skip_value(&mut file, value_type)?;
            None
        };

        match lower_key.as_str() {
            "general.architecture" => architecture = value.clone(),
            "general.name" => model_name = value.clone(),
            "general.size_label" => parameter_size = value.clone(),
            "general.parameter_count" => {
                parameter_count = value
                    .as_deref()
                    .and_then(|value| value.parse::<u128>().ok())
            }
            _ if lower_key.ends_with(".context_length") || lower_key == "laya.max_len" => {
                if context_length.is_none() {
                    context_length = value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".block_count") => {
                if gpu_layer_count.is_none() {
                    gpu_layer_count = value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".embedding_length") => {
                if embedding_length.is_none() {
                    embedding_length = value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".attention.head_count_kv") => {
                if attention_head_count_kv.is_none() {
                    attention_head_count_kv =
                        value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".attention.head_count") => {
                if attention_head_count.is_none() {
                    attention_head_count =
                        value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".attention.key_length") => {
                if attention_key_length.is_none() {
                    attention_key_length =
                        value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".attention.value_length") => {
                if attention_value_length.is_none() {
                    attention_value_length =
                        value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".expert_count") => {
                if expert_count.is_none() {
                    expert_count = value.as_deref().and_then(|value| value.parse::<u64>().ok());
                }
            }
            _ if lower_key.ends_with(".pooling_type") => {
                if pooling_type.is_none() {
                    pooling_type = value.as_deref().and_then(normalize_pooling_type);
                }
            }
            _ if lower_key.contains("chat_template") && chat_template.is_none() => {
                chat_template = value.clone()
            }
            _ => {}
        }

        if capability_key(&lower_key) || lower_key == "general.tags" {
            capability_metadata.push(match value {
                Some(value) => format!("{key}={value}"),
                None => key,
            });
        }
    }

    let should_derive_moe = expert_count.is_some_and(|count| count > 1)
        && !parameter_size
            .as_deref()
            .is_some_and(|label| label.to_ascii_lowercase().contains('x'));
    let needs_tensor_counts = parameter_size.is_none() || should_derive_moe;
    let tensor_counts = needs_tensor_counts
        .then(|| read_tensor_parameter_count(&mut file, tensor_count))
        .transpose()?;

    if should_derive_moe
        && let (Some(experts), Some(counts)) = (expert_count, tensor_counts.as_ref())
        && counts.expert > 0
    {
        let per_expert = counts.expert / u128::from(experts);
        if per_expert > 0 {
            parameter_size = Some(format!("{experts}x{}", format_parameter_count(per_expert)));
        }
    }

    if parameter_size.is_none() {
        let count = parameter_count
            .or_else(|| tensor_counts.as_ref().map(|counts| counts.total))
            .unwrap_or(0);
        if count > 0 {
            parameter_size = Some(format_parameter_count(count));
        }
    }

    let capabilities = infer_capabilities(
        architecture.as_deref(),
        model_name.as_deref(),
        chat_template.as_deref(),
        &capability_metadata,
        hints,
    );
    let tokenizer_fingerprint = build_tokenizer_fingerprint(tokenizer_metadata);

    Ok(GgufInspection {
        architecture,
        model_name,
        parameter_size,
        context_length,
        gpu_layer_count,
        embedding_length,
        attention_head_count,
        attention_head_count_kv,
        attention_key_length,
        attention_value_length,
        pooling_type,
        chat_template,
        tokenizer_fingerprint,
        capabilities,
    })
}

const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;

fn fingerprint_bytes(hash: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *hash ^= u64::from(*byte);
        *hash = hash.wrapping_mul(FNV_PRIME);
    }
}

fn fingerprint_value(file: &mut File, value_type: u32) -> Result<u64, String> {
    let mut hash = FNV_OFFSET_BASIS;
    fingerprint_bytes(&mut hash, &value_type.to_le_bytes());
    fingerprint_value_payload(file, value_type, &mut hash)?;
    Ok(hash)
}

fn fingerprint_value_payload(
    file: &mut File,
    value_type: u32,
    hash: &mut u64,
) -> Result<(), String> {
    if value_type == 8 {
        let length = read_u64(file)?;
        if length > MAX_STRING_BYTES {
            return Err(format!(
                "GGUF metadata string is unexpectedly large: {length} bytes"
            ));
        }
        fingerprint_bytes(hash, &length.to_le_bytes());
        let mut bytes = vec![0_u8; length as usize];
        file.read_exact(&mut bytes)
            .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
        fingerprint_bytes(hash, &bytes);
        return Ok(());
    }

    if value_type == 9 {
        let element_type = read_u32(file)?;
        let count = read_u64(file)?;
        fingerprint_bytes(hash, &element_type.to_le_bytes());
        fingerprint_bytes(hash, &count.to_le_bytes());
        for _ in 0..count {
            fingerprint_value_payload(file, element_type, hash)?;
        }
        return Ok(());
    }

    let size = fixed_size(value_type)
        .ok_or_else(|| format!("unsupported GGUF metadata value type {value_type}"))?;
    let mut bytes = vec![0_u8; size as usize];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    fingerprint_bytes(hash, &bytes);
    Ok(())
}

fn build_tokenizer_fingerprint(mut metadata: Vec<(String, u64)>) -> Option<String> {
    let has_model = metadata
        .iter()
        .any(|(key, _)| key == "tokenizer.ggml.model");
    let has_tokens = metadata
        .iter()
        .any(|(key, _)| key == "tokenizer.ggml.tokens");
    if !has_model || !has_tokens {
        return None;
    }

    metadata.sort_by(|left, right| left.0.cmp(&right.0));
    let mut hash = FNV_OFFSET_BASIS;
    for (key, value_hash) in metadata {
        fingerprint_bytes(&mut hash, key.as_bytes());
        fingerprint_bytes(&mut hash, &[0]);
        fingerprint_bytes(&mut hash, &value_hash.to_le_bytes());
    }
    Some(format!("tok-v1-{hash:016x}"))
}

fn normalize_pooling_type(value: &str) -> Option<String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "-1" | "unspecified" => None,
        "0" | "none" => Some("none".to_string()),
        "1" | "mean" => Some("mean".to_string()),
        "2" | "cls" => Some("cls".to_string()),
        "3" | "last" | "lasttoken" => Some("last".to_string()),
        "4" | "rank" => Some("rank".to_string()),
        _ => None,
    }
}

struct TensorParameterCounts {
    total: u128,
    expert: u128,
}

fn read_tensor_parameter_count(
    file: &mut File,
    tensor_count: u64,
) -> Result<TensorParameterCounts, String> {
    let mut total = 0_u128;
    let mut expert = 0_u128;

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
        let _offset = read_u64(file)?;
        total = total
            .checked_add(elements)
            .ok_or_else(|| "GGUF parameter count overflow".to_string())?;

        let lower_name = name.to_ascii_lowercase();
        if lower_name.contains("exps")
            || lower_name.contains(".experts.")
            || lower_name.contains("expert")
        {
            expert = expert
                .checked_add(elements)
                .ok_or_else(|| "GGUF expert parameter count overflow".to_string())?;
        }
    }

    Ok(TensorParameterCounts { total, expert })
}

fn format_parameter_count(count: u128) -> String {
    const BILLION: f64 = 1_000_000_000.0;
    const MILLION: f64 = 1_000_000.0;
    const THOUSAND: f64 = 1_000.0;

    let count = count as f64;
    if count >= BILLION {
        trim_parameter_number(count / BILLION) + "B"
    } else if count >= MILLION {
        trim_parameter_number(count / MILLION) + "M"
    } else if count >= THOUSAND {
        trim_parameter_number(count / THOUSAND) + "K"
    } else {
        format!("{count:.0}")
    }
}

fn trim_parameter_number(value: f64) -> String {
    let precision = if value >= 100.0 {
        0
    } else if value >= 10.0 {
        1
    } else {
        2
    };
    let formatted = format!("{value:.precision$}");
    if precision == 0 {
        return formatted;
    }
    formatted
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_string()
}

fn infer_capabilities(
    architecture: Option<&str>,
    model_name: Option<&str>,
    chat_template: Option<&str>,
    capability_metadata: &[String],
    hints: CapabilityHints<'_>,
) -> ModelCapabilities {
    let architecture_lower = architecture.unwrap_or_default().to_lowercase();
    let name_haystack = format!(
        "{} {} {} {}",
        hints.repo_id,
        hints.filename,
        model_name.unwrap_or_default(),
        architecture.unwrap_or_default(),
    )
    .to_lowercase();
    let tag_haystack = format!(
        "{} {}",
        hints.tags.join(" "),
        hints.pipeline_tag.unwrap_or_default(),
    )
    .to_lowercase();
    let metadata_haystack = capability_metadata.join(" ").to_lowercase();
    let template = chat_template.unwrap_or_default().to_lowercase();

    let decision_metadata =
        metadata_haystack.contains("decision") || metadata_haystack.contains("laya.");
    let decision_tags =
        tag_haystack.contains("decision-model") || tag_haystack.contains("decision_model");
    let decision_name = name_haystack.contains("openjev")
        || name_haystack.contains("julia-1")
        || name_haystack.contains("laya")
        || name_haystack.contains("decision-model")
        || name_haystack.contains("decision_model");
    let decision_evidence = evidence([
        (
            decision_metadata,
            "GGUF metadata contains decision-model markers".to_string(),
        ),
        (
            decision_tags,
            "repository metadata identifies a decision model".to_string(),
        ),
        (
            decision_name,
            "model/repository name indicates a decision model".to_string(),
        ),
    ]);

    let embedding_evidence = evidence([
        (
            architecture_lower.contains("bert") || architecture_lower.contains("embed"),
            format!("architecture={}", architecture.unwrap_or("unknown")),
        ),
        (
            tag_haystack.contains("feature-extraction") || tag_haystack.contains("embedding"),
            "Hugging Face embedding metadata".to_string(),
        ),
        (
            name_haystack.contains("embed") || name_haystack.contains("embedding"),
            "model/repository name indicates embeddings".to_string(),
        ),
    ]);

    let drafter_evidence = evidence([
        (
            metadata_haystack.contains("draft") || metadata_haystack.contains("eagle"),
            "GGUF metadata contains draft-model markers".to_string(),
        ),
        (
            name_haystack.contains("draft") || name_haystack.contains("eagle"),
            "model/repository name indicates a draft model".to_string(),
        ),
    ]);

    let category = if !decision_evidence.is_empty() {
        "DECISION"
    } else if !drafter_evidence.is_empty() {
        "Drafter"
    } else if !embedding_evidence.is_empty() {
        "Embedding"
    } else {
        "LLM"
    }
    .to_string();

    let mtp_metadata = metadata_haystack.contains("mtp");
    let mtp_name = name_haystack.contains("mtp");
    let mtp = capability_signal(
        mtp_metadata || mtp_name,
        if mtp_metadata { "high" } else { "medium" },
        evidence([
            (
                mtp_metadata,
                "GGUF metadata contains MTP markers".to_string(),
            ),
            (mtp_name, "model/repository name contains MTP".to_string()),
        ]),
    );

    let template_reasoning = template.contains("<think")
        || template.contains("enable_thinking")
        || template.contains("reasoning")
        || template.contains("thinking");
    let named_reasoning = name_haystack.contains("deepseek-r1")
        || name_haystack.contains("reasoning")
        || name_haystack.contains("thinking")
        || name_haystack.contains("qwen3");
    let metadata_reasoning =
        metadata_haystack.contains("reasoning") || metadata_haystack.contains("thinking");
    let reasoning = capability_signal(
        template_reasoning || named_reasoning || metadata_reasoning,
        if template_reasoning || metadata_reasoning {
            "high"
        } else {
            "medium"
        },
        evidence([
            (
                template_reasoning,
                "embedded chat template contains thinking/reasoning markers".to_string(),
            ),
            (
                metadata_reasoning,
                "GGUF metadata contains reasoning markers".to_string(),
            ),
            (
                named_reasoning,
                "model family/name is commonly reasoning-capable".to_string(),
            ),
        ]),
    );
    let thinking_toggle_template = template.contains("enable_thinking");
    let thinking_toggle_metadata = metadata_haystack.contains("enable_thinking");
    let thinking_toggle = capability_signal(
        thinking_toggle_template || thinking_toggle_metadata,
        "high",
        evidence([
            (
                thinking_toggle_template,
                "embedded chat template exposes enable_thinking".to_string(),
            ),
            (
                thinking_toggle_metadata,
                "GGUF metadata exposes enable_thinking".to_string(),
            ),
        ]),
    );
    let reasoning_effort_template = template.contains("reasoning_effort");
    let reasoning_effort_metadata = metadata_haystack.contains("reasoning_effort");
    let reasoning_effort_name = name_haystack.contains("gpt-oss")
        || name_haystack.contains("stepfun")
        || name_haystack.contains("step-3")
        || name_haystack.contains("deepseek-v4");
    let reasoning_effort = capability_signal(
        reasoning_effort_template || reasoning_effort_metadata || reasoning_effort_name,
        if reasoning_effort_template || reasoning_effort_metadata {
            "high"
        } else {
            "medium"
        },
        evidence([
            (
                reasoning_effort_template,
                "embedded chat template exposes reasoning_effort".to_string(),
            ),
            (
                reasoning_effort_metadata,
                "GGUF metadata exposes reasoning_effort".to_string(),
            ),
            (
                reasoning_effort_name,
                "model family is known to use reasoning-effort controls".to_string(),
            ),
        ]),
    );
    let reasoning_preserve_template =
        template.contains("preserve_reasoning") || template.contains("preserve_thinking");
    let reasoning_preserve_metadata = metadata_haystack.contains("preserve_reasoning")
        || metadata_haystack.contains("preserve_thinking");
    let reasoning_preserve = capability_signal(
        reasoning_preserve_template || reasoning_preserve_metadata,
        "high",
        evidence([
            (
                reasoning_preserve_template,
                "embedded chat template exposes reasoning preservation".to_string(),
            ),
            (
                reasoning_preserve_metadata,
                "GGUF metadata exposes reasoning preservation".to_string(),
            ),
        ]),
    );

    let vision_metadata = metadata_haystack.contains("vision")
        || metadata_haystack.contains("projector")
        || metadata_haystack.contains("mmproj");
    let vision_tags = tag_haystack.contains("image-text-to-text")
        || tag_haystack.contains("multimodal")
        || tag_haystack.contains("vision");
    let vision_name = name_haystack.contains("mmproj")
        || name_haystack.contains("llava")
        || name_haystack.contains("qwen2-vl")
        || name_haystack.contains("qwen2vl")
        || name_haystack.contains("qwen3-vl")
        || name_haystack.contains("qwen3vl")
        || name_haystack.contains("minicpm-v");
    let vision = capability_signal(
        vision_metadata || vision_tags || vision_name,
        if vision_metadata || name_haystack.contains("mmproj") {
            "high"
        } else {
            "medium"
        },
        evidence([
            (
                vision_metadata,
                "GGUF metadata contains vision/projector markers".to_string(),
            ),
            (
                vision_tags,
                "Hugging Face metadata indicates a vision/multimodal model".to_string(),
            ),
            (
                vision_name,
                "model/repository name indicates a vision model".to_string(),
            ),
        ]),
    );

    // A bare `tools` reference is not enough: templates can mention tools
    // without implementing a tool-call turn or tool-response formatting.
    let template_tools = ["tool_calls", "tool_call", "function_call", "tool_use"]
        .iter()
        .any(|marker| template.contains(marker))
        || (template.contains("tools")
            && [
                "role == 'tool'",
                "role=='tool'",
                "role == \"tool\"",
                "role==\"tool\"",
                "<|tool|>",
                "<tool_response>",
            ]
            .iter()
            .any(|marker| template.contains(marker)));
    let metadata_tools = [
        "tool_calls",
        "tool_call",
        "tool_use",
        "tool-use",
        "tool-calling",
        "function_call",
        "function-calling",
    ]
    .iter()
    .any(|marker| metadata_haystack.contains(marker));
    let tag_tools = tag_haystack.contains("tool-use")
        || tag_haystack.contains("tool-calling")
        || tag_haystack.contains("function-calling");
    let tools = capability_signal(
        category == "LLM" && (template_tools || metadata_tools || tag_tools),
        if template_tools || metadata_tools {
            "high"
        } else {
            "medium"
        },
        evidence([
            (
                template_tools,
                "embedded chat template contains tool/function-call markers".to_string(),
            ),
            (
                metadata_tools,
                "GGUF metadata contains tool/function markers".to_string(),
            ),
            (
                tag_tools,
                "Hugging Face metadata indicates tool use".to_string(),
            ),
        ]),
    );

    ModelCapabilities {
        category,
        mtp,
        reasoning,
        thinking_toggle,
        reasoning_effort,
        reasoning_preserve,
        vision,
        tools,
    }
}

fn capability_signal(
    supported: bool,
    confidence: &'static str,
    evidence: Vec<String>,
) -> CapabilitySignal {
    CapabilitySignal {
        supported,
        confidence: if supported { confidence } else { "low" },
        evidence,
    }
}

fn evidence<const N: usize>(items: [(bool, String); N]) -> Vec<String> {
    items
        .into_iter()
        .filter_map(|(include, value)| include.then_some(value))
        .collect()
}

fn capability_key(key: &str) -> bool {
    [
        "mtp",
        "draft",
        "eagle",
        "vision",
        "projector",
        "mmproj",
        "reason",
        "think",
        "tool",
        "function",
        "pooling",
        "embedding",
        "decision",
        "laya",
    ]
    .iter()
    .any(|needle| key.contains(needle))
}

fn read_value_text(file: &mut File, value_type: u32) -> Result<Option<String>, String> {
    match value_type {
        0 => Ok(Some(read_u8(file)?.to_string())),
        1 => Ok(Some(read_i8(file)?.to_string())),
        2 => Ok(Some(read_u16(file)?.to_string())),
        3 => Ok(Some(read_i16(file)?.to_string())),
        4 => Ok(Some(read_u32(file)?.to_string())),
        5 => Ok(Some(read_i32(file)?.to_string())),
        6 => Ok(Some(read_f32(file)?.to_string())),
        7 => Ok(Some((read_u8(file)? != 0).to_string())),
        8 => Ok(Some(read_string(file)?)),
        9 => read_array_text(file),
        10 => Ok(Some(read_u64(file)?.to_string())),
        11 => Ok(Some(read_i64(file)?.to_string())),
        12 => Ok(Some(read_f64(file)?.to_string())),
        other => Err(format!("unsupported GGUF metadata value type {other}")),
    }
}

fn read_array_text(file: &mut File) -> Result<Option<String>, String> {
    let element_type = read_u32(file)?;
    let count = read_u64(file)?;

    if element_type == 8 {
        let mut values = Vec::new();
        for index in 0..count {
            let value = read_string(file)?;
            if index < 8 {
                values.push(value);
            }
        }
        return Ok(Some(values.join(" ")));
    }

    skip_array_elements(file, element_type, count)?;
    Ok(None)
}

fn skip_value(file: &mut File, value_type: u32) -> Result<(), String> {
    if value_type == 9 {
        let element_type = read_u32(file)?;
        let count = read_u64(file)?;
        return skip_array_elements(file, element_type, count);
    }

    if value_type == 8 {
        let length = read_u64(file)?;
        seek_forward(file, length)?;
        return Ok(());
    }

    let size = fixed_size(value_type)
        .ok_or_else(|| format!("unsupported GGUF metadata value type {value_type}"))?;
    seek_forward(file, size)
}

fn skip_array_elements(file: &mut File, element_type: u32, count: u64) -> Result<(), String> {
    if element_type == 8 {
        for _ in 0..count {
            let length = read_u64(file)?;
            seek_forward(file, length)?;
        }
        return Ok(());
    }

    if element_type == 9 {
        for _ in 0..count {
            let nested_type = read_u32(file)?;
            let nested_count = read_u64(file)?;
            skip_array_elements(file, nested_type, nested_count)?;
        }
        return Ok(());
    }

    let size = fixed_size(element_type)
        .ok_or_else(|| format!("unsupported GGUF array element type {element_type}"))?;
    let total = size
        .checked_mul(count)
        .ok_or_else(|| "GGUF array size overflow".to_string())?;
    seek_forward(file, total)
}

fn fixed_size(value_type: u32) -> Option<u64> {
    match value_type {
        0 | 1 | 7 => Some(1),
        2 | 3 => Some(2),
        4 | 5 | 6 => Some(4),
        10 | 11 | 12 => Some(8),
        _ => None,
    }
}

fn seek_forward(file: &mut File, bytes: u64) -> Result<(), String> {
    let offset = i64::try_from(bytes).map_err(|_| "GGUF seek offset is too large".to_string())?;
    file.seek(SeekFrom::Current(offset))
        .map(|_| ())
        .map_err(|error| format!("failed to seek GGUF metadata: {error}"))
}

fn read_string(file: &mut File) -> Result<String, String> {
    let length = read_u64(file)?;
    if length > MAX_STRING_BYTES {
        return Err(format!(
            "GGUF metadata string is unexpectedly large: {length} bytes"
        ));
    }

    let mut bytes = vec![0_u8; length as usize];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata string: {error}"))?;

    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn read_u8(file: &mut File) -> Result<u8, String> {
    let mut bytes = [0_u8; 1];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(bytes[0])
}

fn read_i8(file: &mut File) -> Result<i8, String> {
    Ok(read_u8(file)? as i8)
}

fn read_u16(file: &mut File) -> Result<u16, String> {
    let mut bytes = [0_u8; 2];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(u16::from_le_bytes(bytes))
}

fn read_i16(file: &mut File) -> Result<i16, String> {
    let mut bytes = [0_u8; 2];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(i16::from_le_bytes(bytes))
}

fn read_u32(file: &mut File) -> Result<u32, String> {
    let mut bytes = [0_u8; 4];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_i32(file: &mut File) -> Result<i32, String> {
    let mut bytes = [0_u8; 4];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(i32::from_le_bytes(bytes))
}

fn read_f32(file: &mut File) -> Result<f32, String> {
    let mut bytes = [0_u8; 4];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(f32::from_le_bytes(bytes))
}

fn read_u64(file: &mut File) -> Result<u64, String> {
    let mut bytes = [0_u8; 8];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_i64(file: &mut File) -> Result<i64, String> {
    let mut bytes = [0_u8; 8];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(i64::from_le_bytes(bytes))
}

fn read_f64(file: &mut File) -> Result<f64, String> {
    let mut bytes = [0_u8; 8];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("failed to read GGUF metadata: {error}"))?;
    Ok(f64::from_le_bytes(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        io::Write,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn tool_capability_requires_specific_template_or_metadata_evidence() {
        let inspect = |template: &str, metadata: &[String]| {
            infer_capabilities(
                Some("qwen3"),
                Some("Example Chat Model"),
                Some(template),
                metadata,
                CapabilityHints {
                    repo_id: "example/chat",
                    filename: "chat-q4_k_m.gguf",
                    tags: &[],
                    pipeline_tag: None,
                },
            )
            .tools
        };

        assert!(!inspect("{{ tools }}", &[]).supported);
        assert!(
            !inspect(
                "normal conversation",
                &["general.functionality=chat".into()]
            )
            .supported
        );

        let explicit_calls = inspect("{{ tools }} {{ message.tool_calls }}", &[]);
        assert!(explicit_calls.supported);
        assert_eq!(explicit_calls.confidence, "high");

        let tool_role = inspect(
            "{% if message.role == 'tool' %}{{ message.content }}{% endif %} {{ tools }}",
            &[],
        );
        assert!(tool_role.supported);

        let metadata = inspect("normal conversation", &["general.tool_use=true".into()]);
        assert!(metadata.supported);
        assert_eq!(metadata.confidence, "high");
    }

    #[test]
    fn tool_capability_from_repository_tags_is_unverified_and_llm_only() {
        let tags = vec!["tool-use".to_string()];
        let hints = CapabilityHints {
            repo_id: "example/chat",
            filename: "chat.gguf",
            tags: &tags,
            pipeline_tag: None,
        };
        let llm = infer_capabilities(Some("llama"), Some("Chat Model"), None, &[], hints);
        assert!(llm.tools.supported);
        assert_eq!(llm.tools.confidence, "medium");

        let non_llm = infer_capabilities(
            Some("modern-bert"),
            Some("Embedding Model"),
            Some("tool_calls"),
            &[],
            CapabilityHints {
                repo_id: "example/embedding",
                filename: "embed.gguf",
                tags: &tags,
                pipeline_tag: Some("feature-extraction"),
            },
        );
        assert_eq!(non_llm.category, "Embedding");
        assert!(!non_llm.tools.supported);
    }

    #[test]
    fn inspects_capabilities_from_metadata_without_tensor_data() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-gguf-{unique}.gguf"));
        let mut file = File::create(&path).expect("create test gguf");

        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&0_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&4_u64.to_le_bytes())
            .expect("metadata count");

        write_string_metadata(&mut file, "general.architecture", "qwen3");
        write_string_metadata(&mut file, "general.name", "Example MTP Model");
        write_string_metadata(
            &mut file,
            "tokenizer.chat_template",
            "{% if enable_thinking %}<think>{% endif %} {{ tools }} tool_calls",
        );
        write_bool_metadata(&mut file, "general.mtp.enabled", true);
        drop(file);

        let tags = vec!["image-text-to-text".to_string(), "tool-use".to_string()];
        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: "example/example-mtp",
                filename: "example-mtp-q4_k_m.gguf",
                tags: &tags,
                pipeline_tag: Some("image-text-to-text"),
            },
        )
        .expect("inspect gguf");

        assert_eq!(inspection.architecture.as_deref(), Some("qwen3"));
        assert_eq!(inspection.capabilities.category, "LLM");
        assert!(inspection.capabilities.mtp.supported);
        assert!(inspection.capabilities.reasoning.supported);
        assert!(inspection.capabilities.vision.supported);
        assert!(inspection.capabilities.tools.supported);

        fs::remove_file(path).expect("remove test gguf");
    }

    #[test]
    fn tokenizer_fingerprint_matches_only_exact_tokenizer_metadata() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let first = std::env::temp_dir().join(format!("tidestudio-tokenizer-a-{unique}.gguf"));
        let second = std::env::temp_dir().join(format!("tidestudio-tokenizer-b-{unique}.gguf"));
        let different = std::env::temp_dir().join(format!("tidestudio-tokenizer-c-{unique}.gguf"));

        write_tokenizer_test_gguf(&first, &["<s>", "hello", "world"]);
        write_tokenizer_test_gguf(&second, &["<s>", "hello", "world"]);
        write_tokenizer_test_gguf(&different, &["<s>", "hello", "draft"]);

        let inspect = |path: &Path| {
            inspect_gguf(
                path,
                CapabilityHints {
                    repo_id: "example/tokenizer",
                    filename: "model.gguf",
                    tags: &[],
                    pipeline_tag: None,
                },
            )
            .expect("inspect tokenizer gguf")
            .tokenizer_fingerprint
            .expect("tokenizer fingerprint")
        };

        let first_fingerprint = inspect(&first);
        assert_eq!(first_fingerprint, inspect(&second));
        assert_ne!(first_fingerprint, inspect(&different));

        fs::remove_file(first).expect("remove first tokenizer gguf");
        fs::remove_file(second).expect("remove second tokenizer gguf");
        fs::remove_file(different).expect("remove different tokenizer gguf");
    }

    #[test]
    fn detects_decision_model_before_bert_embedding_heuristic() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-decision-{unique}.gguf"));
        let mut file = File::create(&path).expect("create test gguf");

        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&0_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&3_u64.to_le_bytes())
            .expect("metadata count");

        write_string_metadata(&mut file, "general.architecture", "modern-bert");
        write_string_metadata(&mut file, "general.name", "Julia-1");
        write_string_metadata(&mut file, "modern-bert.decision.type", "noul");
        drop(file);

        let tags = vec!["decision-model".to_string()];
        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: "ggml-org/Julia-1-GGUF",
                filename: "Julia-1-Q8_0.gguf",
                tags: &tags,
                pipeline_tag: None,
            },
        )
        .expect("inspect decision gguf");

        assert_eq!(inspection.capabilities.category, "DECISION");

        fs::remove_file(path).expect("remove test gguf");
    }

    #[test]
    fn detects_laya_decision_model_metadata() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-laya-{unique}.gguf"));
        let mut file = File::create(&path).expect("create test gguf");

        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&0_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&3_u64.to_le_bytes())
            .expect("metadata count");

        write_string_metadata(&mut file, "general.architecture", "ggmlc");
        write_string_metadata(&mut file, "general.name", "laya_english_f16");
        write_string_metadata(&mut file, "laya.model_name", "laya");
        drop(file);

        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: "mys/laya-GGUF",
                filename: "laya_english_f16.gguf",
                tags: &[],
                pipeline_tag: None,
            },
        )
        .expect("inspect laya gguf");

        assert_eq!(inspection.capabilities.category, "DECISION");

        fs::remove_file(path).expect("remove test gguf");
    }

    #[test]
    fn reads_embedding_pooling_metadata() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-pooling-{unique}.gguf"));
        let mut file = File::create(&path).expect("create test gguf");

        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&0_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&3_u64.to_le_bytes())
            .expect("metadata count");

        write_string_metadata(&mut file, "general.architecture", "bert");
        write_string_metadata(&mut file, "general.name", "Example Embedding");
        write_u32_metadata(&mut file, "bert.pooling_type", 3);
        drop(file);

        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: "example/embedding",
                filename: "example-embedding-f16.gguf",
                tags: &["feature-extraction".to_string()],
                pipeline_tag: Some("feature-extraction"),
            },
        )
        .expect("inspect embedding gguf");

        assert_eq!(inspection.capabilities.category, "Embedding");
        assert_eq!(inspection.pooling_type.as_deref(), Some("last"));

        fs::remove_file(path).expect("remove test gguf");
    }

    #[test]
    fn derives_parameter_size_from_tensor_shapes() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-params-{unique}.gguf"));
        let mut file = File::create(&path).expect("create test gguf");

        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&2_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&2_u64.to_le_bytes())
            .expect("metadata count");

        write_string_metadata(&mut file, "general.architecture", "example");
        write_string_metadata(&mut file, "general.name", "No Size Label");

        write_tensor_info(&mut file, "token_embd.weight", &[1_000, 2_000], 0);
        write_tensor_info(&mut file, "output.weight", &[500, 2_000], 8_000_000);
        drop(file);

        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: "example/no-size-label",
                filename: "model.gguf",
                tags: &[],
                pipeline_tag: None,
            },
        )
        .expect("inspect gguf");

        assert_eq!(inspection.parameter_size.as_deref(), Some("3M"));

        fs::remove_file(path).expect("remove test gguf");
    }

    #[test]
    fn derives_moe_parameter_layout_and_context_length() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-moe-{unique}.gguf"));
        let mut file = File::create(&path).expect("create test gguf");

        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&2_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&4_u64.to_le_bytes())
            .expect("metadata count");

        write_string_metadata(&mut file, "general.architecture", "example-moe");
        write_string_metadata(&mut file, "general.name", "Example MoE");
        write_u32_metadata(&mut file, "example-moe.expert_count", 64);
        write_u32_metadata(&mut file, "example-moe.context_length", 32_768);

        write_tensor_info(
            &mut file,
            "blk.0.ffn_up_exps.weight",
            &[64, 1_200_000_000],
            0,
        );
        write_tensor_info(&mut file, "token_embd.weight", &[1_000, 2_000], 8_000_000);
        drop(file);

        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: "example/moe",
                filename: "model.gguf",
                tags: &[],
                pipeline_tag: None,
            },
        )
        .expect("inspect moe gguf");

        assert_eq!(inspection.parameter_size.as_deref(), Some("64x1.2B"));
        assert_eq!(inspection.context_length, Some(32_768));

        fs::remove_file(path).expect("remove test gguf");
    }

    #[test]
    fn reads_gpu_layer_and_attention_memory_metadata() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tidestudio-memory-{unique}.gguf"));
        let mut file = File::create(&path).expect("create test gguf");

        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&0_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&8_u64.to_le_bytes())
            .expect("metadata count");

        write_string_metadata(&mut file, "general.architecture", "qwen3");
        write_u32_metadata(&mut file, "qwen3.block_count", 28);
        write_u32_metadata(&mut file, "qwen3.embedding_length", 3584);
        write_u32_metadata(&mut file, "qwen3.attention.head_count", 28);
        write_u32_metadata(&mut file, "qwen3.attention.head_count_kv", 4);
        write_u32_metadata(&mut file, "qwen3.attention.key_length", 128);
        write_u32_metadata(&mut file, "qwen3.attention.value_length", 128);
        write_u32_metadata(&mut file, "qwen3.context_length", 131_072);
        drop(file);

        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: "example/qwen3",
                filename: "model.gguf",
                tags: &[],
                pipeline_tag: None,
            },
        )
        .expect("inspect memory metadata gguf");

        assert_eq!(inspection.gpu_layer_count, Some(28));
        assert_eq!(inspection.embedding_length, Some(3584));
        assert_eq!(inspection.attention_head_count, Some(28));
        assert_eq!(inspection.attention_head_count_kv, Some(4));
        assert_eq!(inspection.attention_key_length, Some(128));
        assert_eq!(inspection.attention_value_length, Some(128));
        assert_eq!(inspection.context_length, Some(131_072));

        fs::remove_file(path).expect("remove test gguf");
    }

    fn write_string_metadata(file: &mut File, key: &str, value: &str) {
        write_gguf_string(file, key);
        file.write_all(&8_u32.to_le_bytes()).expect("string type");
        write_gguf_string(file, value);
    }

    fn write_bool_metadata(file: &mut File, key: &str, value: bool) {
        write_gguf_string(file, key);
        file.write_all(&7_u32.to_le_bytes()).expect("bool type");
        file.write_all(&[u8::from(value)]).expect("bool value");
    }

    fn write_u32_metadata(file: &mut File, key: &str, value: u32) {
        write_gguf_string(file, key);
        file.write_all(&4_u32.to_le_bytes()).expect("u32 type");
        file.write_all(&value.to_le_bytes()).expect("u32 value");
    }

    fn write_string_array_metadata(file: &mut File, key: &str, values: &[&str]) {
        write_gguf_string(file, key);
        file.write_all(&9_u32.to_le_bytes()).expect("array type");
        file.write_all(&8_u32.to_le_bytes())
            .expect("string array element type");
        file.write_all(&(values.len() as u64).to_le_bytes())
            .expect("string array length");
        for value in values {
            write_gguf_string(file, value);
        }
    }

    fn write_tokenizer_test_gguf(path: &Path, tokens: &[&str]) {
        let mut file = File::create(path).expect("create tokenizer test gguf");
        file.write_all(b"GGUF").expect("magic");
        file.write_all(&3_u32.to_le_bytes()).expect("version");
        file.write_all(&0_u64.to_le_bytes()).expect("tensor count");
        file.write_all(&4_u64.to_le_bytes())
            .expect("metadata count");
        write_string_metadata(&mut file, "general.architecture", "llama");
        write_string_metadata(&mut file, "tokenizer.ggml.model", "gpt2");
        write_string_metadata(&mut file, "tokenizer.ggml.pre", "llama-bpe");
        write_string_array_metadata(&mut file, "tokenizer.ggml.tokens", tokens);
    }

    fn write_tensor_info(file: &mut File, name: &str, dimensions: &[u64], offset: u64) {
        write_gguf_string(file, name);
        file.write_all(&(dimensions.len() as u32).to_le_bytes())
            .expect("tensor dimension count");
        for dimension in dimensions {
            file.write_all(&dimension.to_le_bytes())
                .expect("tensor dimension");
        }
        file.write_all(&0_u32.to_le_bytes()).expect("tensor type");
        file.write_all(&offset.to_le_bytes())
            .expect("tensor offset");
    }

    fn write_gguf_string(file: &mut File, value: &str) {
        file.write_all(&(value.len() as u64).to_le_bytes())
            .expect("string length");
        file.write_all(value.as_bytes()).expect("string bytes");
    }
}
