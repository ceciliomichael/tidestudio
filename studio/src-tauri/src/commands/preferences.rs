use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const DATABASE_FILE: &str = "tidestudio.sqlite3";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompletedDownloadRecord {
    pub download_id: String,
    pub repo_id: String,
    pub filename: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub completed_at: i64,
}

#[tauri::command]
pub async fn get_completed_downloads(
    app: AppHandle,
) -> Result<Vec<CompletedDownloadRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        ensure_schema(&connection)?;
        read_completed_downloads(&connection)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn save_completed_download(
    app: AppHandle,
    record: CompletedDownloadRecord,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        ensure_schema(&connection)?;
        insert_completed_download(&connection, &record)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn clear_completed_downloads(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        ensure_schema(&connection)?;
        clear_download_history(&connection)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn read_completed_downloads(
    connection: &Connection,
) -> Result<Vec<CompletedDownloadRecord>, String> {
    let mut statement = connection
        .prepare("SELECT download_id, repo_id, filename, downloaded_bytes, total_bytes, completed_at FROM completed_downloads ORDER BY completed_at DESC, download_id")
        .map_err(|error| format!("failed to read download history: {error}"))?;
    let records = statement
        .query_map([], |row| {
            let downloaded: i64 = row.get(3)?;
            let total: Option<i64> = row.get(4)?;
            Ok(CompletedDownloadRecord {
                download_id: row.get(0)?,
                repo_id: row.get(1)?,
                filename: row.get(2)?,
                downloaded_bytes: downloaded.max(0) as u64,
                total_bytes: total.map(|bytes| bytes.max(0) as u64),
                completed_at: row.get(5)?,
            })
        })
        .map_err(|error| format!("failed to query download history: {error}"))?;
    records
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to decode download history: {error}"))
}

fn insert_completed_download(
    connection: &Connection,
    record: &CompletedDownloadRecord,
) -> Result<(), String> {
    if record.download_id.is_empty()
        || record.repo_id.is_empty()
        || record.filename.is_empty()
        || record.completed_at <= 0
    {
        return Err("invalid completed download record".to_string());
    }
    let downloaded_bytes = i64::try_from(record.downloaded_bytes)
        .map_err(|_| "download size exceeds SQLite integer range")?;
    let total_bytes = record
        .total_bytes
        .map(i64::try_from)
        .transpose()
        .map_err(|_| "download total exceeds SQLite integer range")?;
    connection.execute(
        "INSERT INTO completed_downloads (download_id, repo_id, filename, downloaded_bytes, total_bytes, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(download_id) DO UPDATE SET
            repo_id = excluded.repo_id,
            filename = excluded.filename,
            downloaded_bytes = excluded.downloaded_bytes,
            total_bytes = excluded.total_bytes,
            completed_at = MIN(completed_downloads.completed_at, excluded.completed_at)",
        params![
            record.download_id,
            record.repo_id,
            record.filename,
            downloaded_bytes,
            total_bytes,
            record.completed_at
        ],
    )
    .map_err(|error| format!("failed to save completed download: {error}"))?;
    Ok(())
}

fn clear_download_history(connection: &Connection) -> Result<(), String> {
    connection
        .execute("DELETE FROM completed_downloads", [])
        .map_err(|error| format!("failed to clear completed downloads: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn get_ui_preference(app: AppHandle, key: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || get_ui_preference_sync(&app, &key))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn set_ui_preference(app: AppHandle, key: String, value: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || set_ui_preference_sync(&app, &key, &value))
        .await
        .map_err(|error| error.to_string())?
}

pub(crate) fn get_ui_preference_sync(app: &AppHandle, key: &str) -> Result<Option<String>, String> {
    let connection = open_database(app)?;
    ensure_schema(&connection)?;

    connection
        .query_row(
            "SELECT value FROM ui_preferences WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to read UI preference: {error}"))
}

pub(crate) fn set_ui_preference_sync(
    app: &AppHandle,
    key: &str,
    value: &str,
) -> Result<(), String> {
    let connection = open_database(app)?;
    ensure_schema(&connection)?;

    connection
        .execute(
            "
            INSERT INTO ui_preferences (key, value)
            VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            ",
            params![key, value],
        )
        .map_err(|error| format!("failed to save UI preference: {error}"))?;

    Ok(())
}

pub(crate) fn delete_ui_preference_sync(app: &AppHandle, key: &str) -> Result<(), String> {
    let connection = open_database(app)?;
    ensure_schema(&connection)?;
    connection
        .execute("DELETE FROM ui_preferences WHERE key = ?1", params![key])
        .map_err(|error| format!("failed to reset UI preference: {error}"))?;
    Ok(())
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;

    Connection::open(&path).map_err(|error| format!("failed to open {}: {error}", path.display()))
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve TideStudio app data directory: {error}"))?;

    fs::create_dir_all(&directory)
        .map_err(|error| format!("failed to create {}: {error}", directory.display()))?;

    Ok(directory.join(DATABASE_FILE))
}

fn ensure_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS ui_preferences (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS completed_downloads (
                download_id TEXT PRIMARY KEY NOT NULL,
                repo_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                downloaded_bytes INTEGER NOT NULL,
                total_bytes INTEGER,
                completed_at INTEGER NOT NULL
            );
            ",
        )
        .map_err(|error| format!("failed to initialize UI preferences table: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_record() -> CompletedDownloadRecord {
        CompletedDownloadRecord {
            download_id: "huggingface::publisher/model::model.gguf".to_string(),
            repo_id: "publisher/model".to_string(),
            filename: "model.gguf".to_string(),
            downloaded_bytes: 1024,
            total_bytes: Some(1024),
            completed_at: 1_800_000_000_000,
        }
    }

    #[test]
    fn completed_download_survives_database_reopen_and_clear() {
        let path = std::env::temp_dir().join(format!(
            "tidestudio-downloads-test-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let record = sample_record();
        {
            let connection = Connection::open(&path).unwrap();
            ensure_schema(&connection).unwrap();
            insert_completed_download(&connection, &record).unwrap();
        }
        {
            let connection = Connection::open(&path).unwrap();
            ensure_schema(&connection).unwrap();
            assert_eq!(read_completed_downloads(&connection).unwrap(), vec![record]);
            clear_download_history(&connection).unwrap();
            assert!(read_completed_downloads(&connection).unwrap().is_empty());
        }
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn repeated_completion_upserts_without_duplicate_history() {
        let connection = Connection::open_in_memory().unwrap();
        ensure_schema(&connection).unwrap();
        let record = sample_record();
        insert_completed_download(&connection, &record).unwrap();
        insert_completed_download(
            &connection,
            &CompletedDownloadRecord {
                completed_at: record.completed_at + 1_000,
                ..record.clone()
            },
        )
        .unwrap();
        assert_eq!(read_completed_downloads(&connection).unwrap(), vec![record]);
    }
}
