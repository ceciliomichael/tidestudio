use rusqlite::{Connection, OptionalExtension, params};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const DATABASE_FILE: &str = "tidestudio.sqlite3";

#[tauri::command]
pub fn get_ui_preference(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let connection = open_database(&app)?;
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

#[tauri::command]
pub fn set_ui_preference(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let connection = open_database(&app)?;
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
            ",
        )
        .map_err(|error| format!("failed to initialize UI preferences table: {error}"))
}
