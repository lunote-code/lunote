use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use serde::Serialize;

const LUNA_DIR: &str = ".luna";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LunaPaths {
  pub root: String,
  pub config: String,
  pub theme: String,
  pub workspace: String,
  pub cache: String,
  pub logs: String,
  pub state: String,
}

fn home_dir() -> Result<PathBuf, String> {
  //Windows usually only has USERPROFILE; Unix uses HOME
  for key in ["HOME", "USERPROFILE"] {
    if let Some(val) = std::env::var_os(key) {
      let path = PathBuf::from(val);
      if path.is_absolute() {
        return Ok(path);
      }
    }
  }
  Err("Unable to resolve user home directory (requires HOME or USERPROFILE)".to_string())
}

pub fn get_luna_root() -> Result<PathBuf, String> {
  Ok(home_dir()?.join(LUNA_DIR))
}

pub fn get_config_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("config"))
}

pub fn get_workspace_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("workspace"))
}

pub fn get_theme_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("theme"))
}

pub fn get_cache_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("cache"))
}

pub fn get_logs_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("logs"))
}

pub fn get_state_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("state"))
}

pub fn ensure_luna_dirs() -> Result<LunaPaths, String> {
  let root = get_luna_root()?;
  let config = get_config_path()?;
  let theme = get_theme_path()?;
  let workspace = get_workspace_path()?;
  let cache = get_cache_path()?;
  let logs = get_logs_path()?;
  let state = get_state_path()?;

  for dir in [&root, &config, &theme, &workspace, &cache, &logs, &state] {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create Luna directory: {e}"))?;
  }

  Ok(LunaPaths {
    root: root.to_string_lossy().to_string(),
    config: config.to_string_lossy().to_string(),
    theme: theme.to_string_lossy().to_string(),
    workspace: workspace.to_string_lossy().to_string(),
    cache: cache.to_string_lossy().to_string(),
    logs: logs.to_string_lossy().to_string(),
    state: state.to_string_lossy().to_string(),
  })
}

pub fn user_settings_file() -> Result<PathBuf, String> {
  Ok(get_config_path()?.join("user.settings.json"))
}

fn safe_workspace_id(workspace_id: &str) -> Result<String, String> {
  let trimmed = workspace_id.trim();
  if trimmed.is_empty() {
    return Err("workspaceId is empty".to_string());
  }
  let safe: String = trimmed
    .chars()
    .map(|ch| {
      if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
        ch
      } else {
        '_'
      }
    })
    .collect();
  Ok(safe)
}

pub fn workspace_file(workspace_id: &str) -> Result<PathBuf, String> {
  Ok(get_workspace_path()?.join(format!("{}.json", safe_workspace_id(workspace_id)?)))
}

pub fn write_workspace_snapshot(
  workspace_id: &str,
  snapshot: &serde_json::Value,
) -> Result<(), String> {
  ensure_luna_dirs()?;
  let path = workspace_file(workspace_id)?;
  let data = serde_json::to_vec_pretty(snapshot).map_err(|e| e.to_string())?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())
}

pub fn read_workspace_snapshot(workspace_id: &str) -> Result<Option<serde_json::Value>, String> {
  ensure_luna_dirs()?;
  let path = workspace_file(workspace_id)?;
  if !path.is_file() {
    return Ok(None);
  }
  let data = fs::read(&path).map_err(|e| e.to_string())?;
  serde_json::from_slice(&data).map(Some).map_err(|e| e.to_string())
}

pub fn append_app_log(line: &str) -> Result<(), String> {
  ensure_luna_dirs()?;
  let path = get_logs_path()?.join("app.log");
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(path)
    .map_err(|e| e.to_string())?;
  writeln!(file, "{line}").map_err(|e| e.to_string())
}
