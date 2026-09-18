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

pub fn get_history_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("history"))
}

pub fn get_theme_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("theme"))
}

pub fn get_theme_style_path() -> Result<PathBuf, String> {
  Ok(get_theme_path()?.join("style"))
}

pub fn get_theme_snippets_path() -> Result<PathBuf, String> {
  Ok(get_theme_path()?.join("snippets"))
}

pub fn get_theme_export_path() -> Result<PathBuf, String> {
  Ok(get_theme_path()?.join("export"))
}

pub fn get_theme_tokens_path() -> Result<PathBuf, String> {
  Ok(get_theme_path()?.join("tokens"))
}

pub fn get_plugins_path() -> Result<PathBuf, String> {
  Ok(get_luna_root()?.join("plugins"))
}

pub fn get_legacy_config_theme_path() -> Result<PathBuf, String> {
  Ok(get_config_path()?.join("Theme"))
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
  let theme_style = get_theme_style_path()?;
  let theme_snippets = get_theme_snippets_path()?;
  let theme_export = get_theme_export_path()?;
  let theme_tokens = get_theme_tokens_path()?;
  let plugins = get_plugins_path()?;
  let workspace = get_workspace_path()?;
  let history = get_history_path()?;
  let cache = get_cache_path()?;
  let logs = get_logs_path()?;
  let state = get_state_path()?;

  for dir in [
    &root,
    &config,
    &theme,
    &theme_style,
    &theme_snippets,
    &theme_export,
    &theme_tokens,
    &plugins,
    &workspace,
    &history,
    &cache,
    &logs,
    &state,
  ] {
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

pub fn list_document_history_store_files(workspace_root: &str) -> Result<Vec<PathBuf>, String> {
  let workspace_id = safe_workspace_id(workspace_root)?;
  let dir = get_history_path()?.join(workspace_id);
  if !dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut files = Vec::new();
  let index = dir.join("index.json");
  if index.is_file() {
    files.push(index);
  }
  let snapshots = dir.join("snapshots");
  if snapshots.is_dir() {
    for entry in fs::read_dir(&snapshots).map_err(|e| format!("Failed to list history snapshots: {e}"))? {
      let path = entry.map_err(|e| format!("Failed to read history snapshot entry: {e}"))?.path();
      if path.is_file() {
        files.push(path);
      }
    }
  }
  Ok(files)
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

const MAX_LOG_FILE_BYTES: u64 = 5 * 1024 * 1024;

fn maybe_rotate_log_file(path: &PathBuf) -> Result<(), String> {
  let meta = match fs::metadata(path) {
    Ok(meta) => meta,
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
    Err(e) => return Err(e.to_string()),
  };
  if meta.len() <= MAX_LOG_FILE_BYTES {
    return Ok(());
  }
  let backup = path.with_file_name(format!(
    "{}.1",
    path.file_name()
      .map(|name| name.to_string_lossy())
      .unwrap_or_else(|| "log".into())
  ));
  if backup.exists() {
    fs::remove_file(&backup).map_err(|e| e.to_string())?;
  }
  fs::rename(path, backup).map_err(|e| e.to_string())
}

pub fn append_log_line(filename: &str, line: &str) -> Result<(), String> {
  ensure_luna_dirs()?;
  let safe_name = filename
    .chars()
    .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '.' || *ch == '-' || *ch == '_')
    .collect::<String>();
  if safe_name.is_empty() || safe_name != filename {
    return Err("Invalid log filename".to_string());
  }
  let path = get_logs_path()?.join(safe_name);
  maybe_rotate_log_file(&path)?;
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(path)
    .map_err(|e| e.to_string())?;
  writeln!(file, "{line}").map_err(|e| e.to_string())
}

pub fn append_app_log(line: &str) -> Result<(), String> {
  append_log_line("app.log", line)
}

pub fn append_crash_log(line: &str) -> Result<(), String> {
  append_log_line("crash.log", line)
}

pub fn get_ai_conversations_path() -> Result<PathBuf, String> {
  Ok(get_cache_path()?.join("ai-conversations"))
}

fn ai_conversation_storage_id(doc_key: &str) -> Result<String, String> {
  use std::collections::hash_map::DefaultHasher;
  use std::hash::{Hash, Hasher};

  let trimmed = doc_key.trim();
  if trimmed.is_empty() {
    return Err("docKey is empty".to_string());
  }
  let mut hasher = DefaultHasher::new();
  trimmed.hash(&mut hasher);
  Ok(format!("{:016x}", hasher.finish()))
}

pub fn ai_conversation_file(doc_key: &str) -> Result<PathBuf, String> {
  let id = ai_conversation_storage_id(doc_key)?;
  Ok(get_ai_conversations_path()?.join(format!("{id}.json")))
}

pub fn read_ai_conversation_snapshot(doc_key: &str) -> Result<Option<serde_json::Value>, String> {
  ensure_luna_dirs()?;
  let path = ai_conversation_file(doc_key)?;
  if !path.is_file() {
    return Ok(None);
  }
  let data = fs::read(&path).map_err(|e| e.to_string())?;
  serde_json::from_slice(&data).map(Some).map_err(|e| e.to_string())
}

pub fn write_ai_conversation_snapshot(
  doc_key: &str,
  snapshot: &serde_json::Value,
) -> Result<(), String> {
  ensure_luna_dirs()?;
  let dir = get_ai_conversations_path()?;
  fs::create_dir_all(&dir).map_err(|e| format!("Failed to create AI conversations directory: {e}"))?;
  let path = ai_conversation_file(doc_key)?;
  let data = serde_json::to_vec_pretty(snapshot).map_err(|e| e.to_string())?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())
}

pub fn delete_ai_conversation_snapshot(doc_key: &str) -> Result<(), String> {
  ensure_luna_dirs()?;
  let path = ai_conversation_file(doc_key)?;
  if !path.is_file() {
    return Ok(());
  }
  fs::remove_file(&path).map_err(|e| e.to_string())
}
