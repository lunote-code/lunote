use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

use crate::luna_paths;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginFileEntry {
  pub path: String,
  pub content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginRecord {
  pub id: String,
  pub name: String,
  pub version: String,
  pub installed_at: String,
}

fn plugins_root() -> Result<PathBuf, String> {
  Ok(luna_paths::get_plugins_path()?)
}

fn validate_plugin_id(plugin_id: &str) -> Result<(), String> {
  let trimmed = plugin_id.trim();
  if trimmed.is_empty() {
    return Err("Plugin id is empty".to_string());
  }
  if !trimmed
    .chars()
    .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
  {
    return Err("Plugin id contains illegal characters".to_string());
  }
  Ok(())
}

fn validate_relative_plugin_path(path: &str) -> Result<PathBuf, String> {
  if path.is_empty() {
    return Err("Plugin file path is empty".to_string());
  }
  let rel = Path::new(path);
  for component in rel.components() {
    match component {
      Component::Normal(_) => {}
      _ => return Err("Plugin file path must be relative".to_string()),
    }
  }
  Ok(rel.to_path_buf())
}

#[tauri::command]
pub fn install_plugin_files(plugin_id: String, files: Vec<PluginFileEntry>) -> Result<(), String> {
  validate_plugin_id(&plugin_id)?;
  luna_paths::ensure_luna_dirs()?;
  let root = plugins_root()?.join(&plugin_id);
  fs::create_dir_all(&root).map_err(|e| format!("Failed to create plugin directory: {e}"))?;

  for file in files {
    let rel = validate_relative_plugin_path(&file.path)?;
    let dest = root.join(&rel);
    if let Some(parent) = dest.parent() {
      fs::create_dir_all(parent).map_err(|e| format!("Failed to create plugin subdir: {e}"))?;
    }
    let data = file.content.into_bytes();
    crate::core::security::ensure_json_payload_size(&data, "Plugin file")?;
    crate::core::atomic_io::atomic_write(&dest, &data).map_err(|e| e.to_string())?;
  }

  Ok(())
}

#[tauri::command]
pub fn list_installed_plugins() -> Result<Vec<InstalledPluginRecord>, String> {
  luna_paths::ensure_luna_dirs()?;
  let root = plugins_root()?;
  if !root.is_dir() {
    return Ok(Vec::new());
  }

  let mut out = Vec::new();
  for entry in fs::read_dir(&root).map_err(|e| format!("Failed to read plugins directory: {e}"))? {
    let entry = entry.map_err(|e| format!("Failed to read plugin entry: {e}"))?;
    if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
      continue;
    }
    let manifest_path = entry.path().join("plugin.json");
    if !manifest_path.is_file() {
      continue;
    }
    let raw = fs::read_to_string(&manifest_path).map_err(|e| format!("Failed to read plugin manifest: {e}"))?;
    let manifest: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let fallback_id = entry.file_name().to_string_lossy().to_string();
    let id = manifest
      .get("id")
      .and_then(|value| value.as_str())
      .unwrap_or(fallback_id.as_str())
      .to_string();
    let name = manifest
      .get("name")
      .and_then(|value| value.as_str())
      .unwrap_or(&id)
      .to_string();
    let version = manifest
      .get("version")
      .and_then(|value| value.as_str())
      .unwrap_or("0.0.0")
      .to_string();
    let installed_at = fs::metadata(&manifest_path)
      .ok()
      .and_then(|meta| meta.modified().ok())
      .and_then(|time| {
        time
          .duration_since(std::time::UNIX_EPOCH)
          .ok()
          .map(|duration| duration.as_secs().to_string())
      })
      .unwrap_or_default();

    out.push(InstalledPluginRecord {
      id,
      name,
      version,
      installed_at,
    });
  }

  out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(out)
}

#[tauri::command]
pub fn read_plugin_manifest(plugin_id: String) -> Result<String, String> {
  validate_plugin_id(&plugin_id)?;
  let manifest_path = plugins_root()?.join(&plugin_id).join("plugin.json");
  if !manifest_path.is_file() {
    return Err("Plugin manifest does not exist".to_string());
  }
  fs::read_to_string(&manifest_path).map_err(|e| format!("Failed to read plugin manifest: {e}"))
}

#[tauri::command]
pub fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
  validate_plugin_id(&plugin_id)?;
  let root = plugins_root()?.join(&plugin_id);
  if root.is_dir() {
    fs::remove_dir_all(&root).map_err(|e| format!("Failed to remove plugin directory: {e}"))?;
  }
  Ok(())
}
