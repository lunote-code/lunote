use serde::Serialize;
use tauri::AppHandle;

use crate::core::files;
use crate::luna_paths;

#[derive(Serialize)]
pub struct ThemeStyleEntry {
  pub name: String,
}

#[derive(Serialize)]
pub struct CustomThemeEntry {
  pub name: String,
}

fn theme_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let _ = app;
  Ok(luna_paths::get_config_path()?.join("Theme"))
}

fn theme_snippets_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  Ok(theme_dir(app)?.join("snippets"))
}

fn theme_export_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  Ok(theme_dir(app)?.join("export"))
}

fn custom_theme_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let _ = app;
  Ok(luna_paths::get_luna_root()?.join("theme"))
}

/// Make sure the `application configuration directory/Theme` exists and return the absolute path (for front-end prompts).
#[tauri::command]
pub fn ensure_theme_directory(app: AppHandle) -> Result<String, String> {
  let dir = theme_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create Theme directory: {e}"))?;
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ensure_theme_snippets_directory(app: AppHandle) -> Result<String, String> {
  let dir = theme_snippets_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create Theme/snippets directory: {e}"))?;
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ensure_theme_export_directory(app: AppHandle) -> Result<String, String> {
  let dir = theme_export_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create Theme/export directory: {e}"))?;
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_theme_stylesheets(app: AppHandle) -> Result<Vec<ThemeStyleEntry>, String> {
  let dir = theme_dir(&app)?;
  if !dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in std::fs::read_dir(&dir).map_err(|e| format!("Failed to read Theme: {e}"))? {
    let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
    let meta = entry.metadata().map_err(|e| e.to_string())?;
    if !meta.is_file() {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    if name.to_lowercase().ends_with(".css") {
      out.push(ThemeStyleEntry { name });
    }
  }
  out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(out)
}

#[tauri::command]
pub fn list_theme_snippets(app: AppHandle) -> Result<Vec<ThemeStyleEntry>, String> {
  let dir = theme_snippets_dir(&app)?;
  if !dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in std::fs::read_dir(&dir).map_err(|e| format!("Failed to read Theme/snippets: {e}"))? {
    let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
    let meta = entry.metadata().map_err(|e| e.to_string())?;
    if !meta.is_file() {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    if name.to_lowercase().ends_with(".css") {
      out.push(ThemeStyleEntry { name });
    }
  }
  out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(out)
}

#[tauri::command]
pub fn list_theme_export_styles(app: AppHandle) -> Result<Vec<ThemeStyleEntry>, String> {
  let dir = theme_export_dir(&app)?;
  if !dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in std::fs::read_dir(&dir).map_err(|e| format!("Failed to read Theme/export: {e}"))? {
    let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
    let meta = entry.metadata().map_err(|e| e.to_string())?;
    if !meta.is_file() {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    if name.to_lowercase().ends_with(".css") {
      out.push(ThemeStyleEntry { name });
    }
  }
  out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(out)
}

fn validate_theme_basename(name: &str) -> Result<(), String> {
  if name.is_empty() {
    return Err("File name is empty".to_string());
  }
  if name.contains('/') || name.contains('\\') || name.contains("..") {
    return Err("Illegal file name".to_string());
  }
  if !name.to_lowercase().ends_with(".css") {
    return Err("Only supports .css files".to_string());
  }
  Ok(())
}

fn validate_custom_theme_basename(name: &str) -> Result<(), String> {
  if name.is_empty() {
    return Err("File name is empty".to_string());
  }
  if name.contains('/') || name.contains('\\') || name.contains("..") {
    return Err("Illegal file name".to_string());
  }
  if !name.to_lowercase().ends_with(".json") {
    return Err("Only supports .json files".to_string());
  }
  Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCustomThemePayload {
  pub file_name: String,
  pub content: String,
}

#[tauri::command]
pub fn read_theme_stylesheet(app: AppHandle, name: String) -> Result<String, String> {
  validate_theme_basename(&name)?;
  let path = theme_dir(&app)?.join(&name);
  if !path.is_file() {
    return Err("Theme file does not exist".to_string());
  }
  std::fs::read_to_string(&path).map_err(|e| format!("Failed to read topic: {e}"))
}

#[tauri::command]
pub fn read_theme_snippet(app: AppHandle, name: String) -> Result<String, String> {
  validate_theme_basename(&name)?;
  let path = theme_snippets_dir(&app)?.join(&name);
  if !path.is_file() {
    return Err("Theme snippet does not exist".to_string());
  }
  std::fs::read_to_string(&path).map_err(|e| format!("Failed to read theme snippet: {e}"))
}

#[tauri::command]
pub fn read_theme_export_style(app: AppHandle, name: String) -> Result<String, String> {
  validate_theme_basename(&name)?;
  let path = theme_export_dir(&app)?.join(&name);
  if !path.is_file() {
    return Err("Theme export style does not exist".to_string());
  }
  std::fs::read_to_string(&path).map_err(|e| format!("Failed to read theme export style: {e}"))
}

#[tauri::command]
pub fn reveal_theme_directory(app: AppHandle) -> Result<(), String> {
  let dir = theme_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn reveal_theme_snippets_directory(app: AppHandle) -> Result<(), String> {
  let dir = theme_snippets_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn reveal_theme_export_directory(app: AppHandle) -> Result<(), String> {
  let dir = theme_export_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn reveal_custom_theme_directory(app: AppHandle) -> Result<(), String> {
  let dir = custom_theme_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn list_custom_theme_files(app: AppHandle) -> Result<Vec<CustomThemeEntry>, String> {
  let dir = custom_theme_dir(&app)?;
  if !dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in std::fs::read_dir(&dir).map_err(|e| format!("Failed to read theme directory: {e}"))? {
    let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
    let meta = entry.metadata().map_err(|e| e.to_string())?;
    if !meta.is_file() {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    if name.to_lowercase().ends_with(".json") {
      out.push(CustomThemeEntry { name });
    }
  }
  out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(out)
}

#[tauri::command]
pub fn read_custom_theme_json(app: AppHandle, name: String) -> Result<String, String> {
  validate_custom_theme_basename(&name)?;
  let path = custom_theme_dir(&app)?.join(&name);
  if !path.is_file() {
    return Err("Theme file does not exist".to_string());
  }
  std::fs::read_to_string(&path).map_err(|e| format!("Failed to read theme: {e}"))
}

#[tauri::command]
pub fn save_custom_theme_json(
  app: AppHandle,
  payload: SaveCustomThemePayload,
) -> Result<String, String> {
  validate_custom_theme_basename(&payload.file_name)?;
  let dir = custom_theme_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create theme directory: {e}"))?;
  let path = dir.join(&payload.file_name);
  let data = payload.content.into_bytes();
  crate::core::security::ensure_json_payload_size(&data, "Custom theme")?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}
