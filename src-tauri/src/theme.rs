use std::fs;

use serde::Serialize;
use tauri::AppHandle;

use crate::core::files;
use crate::luna_paths;
use crate::theme_migration;

#[derive(Serialize)]
pub struct ThemeStyleEntry {
  pub name: String,
}

#[derive(Serialize)]
pub struct CustomThemeEntry {
  pub name: String,
}

fn prepare_theme_dirs(_app: &AppHandle) -> Result<(), String> {
  theme_migration::migrate_theme_layout_if_needed()
}

fn theme_styles_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  prepare_theme_dirs(app)?;
  Ok(luna_paths::get_theme_style_path()?)
}

fn theme_snippets_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  prepare_theme_dirs(app)?;
  Ok(luna_paths::get_theme_snippets_path()?)
}

fn theme_export_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  prepare_theme_dirs(app)?;
  Ok(luna_paths::get_theme_export_path()?)
}

fn theme_tokens_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  prepare_theme_dirs(app)?;
  Ok(luna_paths::get_theme_tokens_path()?)
}

/// Ensure `~/.luna/theme/` exists and return the absolute path.
#[tauri::command]
pub fn ensure_theme_directory(app: AppHandle) -> Result<String, String> {
  prepare_theme_dirs(&app)?;
  let dir = theme_styles_dir(&app)?;
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ensure_theme_snippets_directory(app: AppHandle) -> Result<String, String> {
  let dir = theme_snippets_dir(&app)?;
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ensure_theme_export_directory(app: AppHandle) -> Result<String, String> {
  let dir = theme_export_dir(&app)?;
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_theme_stylesheets(app: AppHandle) -> Result<Vec<ThemeStyleEntry>, String> {
  let dir = theme_styles_dir(&app)?;
  prepare_theme_dirs(&app)?;
  if !dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in fs::read_dir(&dir).map_err(|e| format!("Failed to read theme/style directory: {e}"))? {
    let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
    let meta = entry.metadata().map_err(|e| e.to_string())?;
    if !meta.is_file() {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    if name.starts_with('.') {
      continue;
    }
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
  for entry in fs::read_dir(&dir).map_err(|e| format!("Failed to read theme/snippets: {e}"))? {
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
  for entry in fs::read_dir(&dir).map_err(|e| format!("Failed to read theme/export: {e}"))? {
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
  let path = theme_styles_dir(&app)?.join(&name);
  if !path.is_file() {
    return Err("Theme file does not exist".to_string());
  }
  std::fs::read_to_string(&path).map_err(|e| format!("Failed to read theme stylesheet: {e}"))
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
  let dir = theme_styles_dir(&app)?;
  prepare_theme_dirs(&app)?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn reveal_theme_snippets_directory(app: AppHandle) -> Result<(), String> {
  let dir = theme_snippets_dir(&app)?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn reveal_theme_export_directory(app: AppHandle) -> Result<(), String> {
  let dir = theme_export_dir(&app)?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn reveal_custom_theme_directory(app: AppHandle) -> Result<(), String> {
  let dir = theme_tokens_dir(&app)?;
  let p = dir.to_string_lossy().to_string();
  files::reveal_path_in_explorer(&p, "")
}

#[tauri::command]
pub fn list_custom_theme_files(app: AppHandle) -> Result<Vec<CustomThemeEntry>, String> {
  let dir = theme_tokens_dir(&app)?;
  if !dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in fs::read_dir(&dir).map_err(|e| format!("Failed to read theme/tokens directory: {e}"))? {
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
  let path = theme_tokens_dir(&app)?.join(&name);
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
  let dir = theme_tokens_dir(&app)?;
  let path = dir.join(&payload.file_name);
  let data = payload.content.into_bytes();
  crate::core::security::ensure_json_payload_size(&data, "Custom theme")?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}
