use std::path::{Path, PathBuf};

use base64::Engine;
use tauri::{AppHandle, Manager, State};

use crate::{
  app_settings::{self, AppSettings},
  core::{files, path_safety, search, security},
  luna_paths,
  AppState, RecentMenuPaths, ThemeMenuCssNames,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_dialog::FilePath;

pub(crate) mod document_history;

#[derive(serde::Deserialize)]
pub struct RootPayload {
  pub root: String,
}

#[derive(serde::Deserialize)]
pub struct NotePayload {
  pub root: String,
  pub path: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePayload {
  pub root: String,
  pub path: String,
  pub content: String,
  /// Optimistic locking: consistent with `note_file_stat.modifiedSecs`; if omitted, no verification will be performed.
  pub expected_modified_secs: Option<u64>,
  /// Skip mtime verification when true (after user confirms retaining local version).
  #[serde(default)]
  pub force_overwrite: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAssetPayload {
  pub root: String,
  pub path: String,
  pub relative_path: String,
  pub data_base64: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteAssetExistsPayload {
  pub root: String,
  pub path: String,
  pub relative_path: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadBinaryPayload {
  pub root: String,
  pub path: String,
}

#[derive(serde::Deserialize)]
pub struct SearchPayload {
  pub query: String,
  pub limit: Option<usize>,
  #[serde(default)]
  pub workspace_root: Option<String>,
}

#[derive(serde::Serialize)]
pub struct IndexResponse {
  pub count: usize,
  pub skipped: usize,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshotPayload {
  pub workspace_id: String,
  pub snapshot: serde_json::Value,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIdPayload {
  pub workspace_id: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AssetMeta {
  pub id: String,
  pub original_name: String,
  pub relative_path: String,
  pub absolute_path: String,
  #[serde(default)]
  pub resolved_path: Option<String>,
  #[serde(default)]
  pub storage_mode: Option<String>,
  pub mime_type: String,
  pub created_at: i64,
  #[serde(default)]
  pub reference_count: Option<u32>,
  #[serde(default)]
  pub last_referenced_at: Option<i64>,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndex {
  pub assets: std::collections::HashMap<String, AssetMeta>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLunaAssetPayload {
  pub workspace_id: String,
  pub asset_id: String,
  pub original_name: String,
  pub mime_type: String,
  pub target_dir: String,
  pub storage_mode: String,
  pub data_base64: String,
  /** The root directory of the current workspace; used to verify the writing range in relative_to_document mode*/
  pub workspace_root: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteLunaAssetIndexPayload {
  pub workspace_id: String,
  pub workspace_root: String,
  pub index: AssetIndex,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopedPathPayload {
  pub path: String,
  pub workspace_root: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathExistsPayload {
  pub path: String,
  pub workspace_root: String,
}

#[tauri::command]
pub fn ensure_luna_dirs() -> Result<luna_paths::LunaPaths, String> {
  luna_paths::ensure_luna_dirs()
}

#[tauri::command]
pub fn get_luna_paths() -> Result<luna_paths::LunaPaths, String> {
  luna_paths::ensure_luna_dirs()
}

#[tauri::command]
pub fn read_luna_workspace(
  payload: WorkspaceIdPayload,
) -> Result<Option<serde_json::Value>, String> {
  luna_paths::read_workspace_snapshot(&payload.workspace_id)
}

#[tauri::command]
pub fn write_luna_workspace(payload: WorkspaceSnapshotPayload) -> Result<(), String> {
  let data = serde_json::to_vec(&payload.snapshot).map_err(|e| e.to_string())?;
  security::ensure_json_payload_size(&data, "Workspace snapshot")?;
  luna_paths::write_workspace_snapshot(&payload.workspace_id, &payload.snapshot)
}

#[tauri::command]
pub fn append_luna_log(line: String, kind: Option<String>) -> Result<(), String> {
  let clamped = security::clamp_log_line(&line);
  match kind.as_deref() {
    Some("crash") => luna_paths::append_crash_log(&clamped),
    _ => luna_paths::append_app_log(&clamped),
  }
}

fn safe_workspace_id(workspace_id: &str) -> Result<String, String> {
  let trimmed = workspace_id.trim();
  if trimmed.is_empty() {
    return Err("workspaceId is empty".to_string());
  }
  Ok(
    trimmed
      .chars()
      .map(|ch| {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
          ch
        } else {
          '_'
        }
      })
      .collect(),
  )
}

fn safe_asset_file_name(asset_id: &str, original_name: &str) -> Result<String, String> {
  let safe_id = safe_workspace_id(asset_id)?;
  let base = Path::new(original_name)
    .file_name()
    .and_then(|it| it.to_str())
    .unwrap_or("asset.bin")
    .chars()
    .map(|ch| if ch == '/' || ch == '\\' || ch == ':' { '_' } else { ch })
    .collect::<String>();
  let trimmed = base.trim();
  let file_name = if trimmed.is_empty() { "asset.bin" } else { trimmed };
  Ok(format!("{safe_id}___{file_name}"))
}

const ASSET_DISK_SEP: &str = "___";

fn parse_asset_disk_name(file_name: &str) -> (String, String) {
  if let Some((id, original)) = file_name.split_once(ASSET_DISK_SEP) {
    return (id.to_string(), original.to_string());
  }
  (file_name.to_string(), file_name.to_string())
}

fn ensure_safe_target_dir(
  target_dir: &str,
  storage_mode: &str,
  workspace_root: &str,
  configured_absolute_root: Option<&str>,
) -> Result<PathBuf, String> {
  let trimmed = target_dir.trim();
  if trimmed.is_empty() {
    return Err("Asset target directory is empty".to_string());
  }
  let dir = PathBuf::from(trimmed);
  path_safety::ensure_no_parent_dir_components(&dir)?;
  path_safety::ensure_absolute_path(&dir)?;

  let allowed_root = if storage_mode == "absolute_path" {
    let configured = configured_absolute_root
      .map(str::trim)
      .filter(|s| !s.is_empty())
      .ok_or_else(|| "Absolute path asset directory is not configured".to_string())?;
    PathBuf::from(configured)
  } else {
    let root = workspace_root.trim();
    if root.is_empty() {
      return Err("The workspace root directory is empty".to_string());
    }
    PathBuf::from(root)
  };

  if storage_mode == "absolute_path" {
    std::fs::create_dir_all(&allowed_root)
      .map_err(|e| format!("Failed to create configured asset catalog: {e}"))?;
  }

  path_safety::ensure_under_allowed_root(&dir, &allowed_root)?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create asset catalog: {e}"))?;
  Ok(dir)
}

fn workspace_assets_dir(workspace_id: &str) -> Result<PathBuf, String> {
  let safe_id = safe_workspace_id(workspace_id)?;
  let dir = luna_paths::get_workspace_path()?.join(&safe_id).join("assets");
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create assets directory: {e}"))?;
  Ok(dir)
}

fn asset_index_file(workspace_id: &str) -> Result<PathBuf, String> {
  Ok(workspace_assets_dir(workspace_id)?.join("index.json"))
}

fn resolve_workspace_root(root: &str) -> Result<String, String> {
  let resolved = security::ensure_listable_workspace_root(root)?;
  Ok(resolved.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_luna_asset_file(app: AppHandle, payload: SaveLunaAssetPayload) -> Result<AssetMeta, String> {
  luna_paths::ensure_luna_dirs()?;
  let settings = app_settings::read_app_settings(&app);
  let configured_absolute_root = if payload.storage_mode == "absolute_path" {
    let ap = settings.asset_storage.absolute_path.trim();
    if ap.is_empty() {
      None
    } else {
      Some(ap.to_string())
    }
  } else {
    None
  };
  let dir = ensure_safe_target_dir(
    &payload.target_dir,
    &payload.storage_mode,
    &payload.workspace_root,
    configured_absolute_root.as_deref(),
  )?;
  let file_name = safe_asset_file_name(&payload.asset_id, &payload.original_name)?;
  let target = dir.join(&file_name);
  security::ensure_base64_payload_within_limit(&payload.data_base64, "resource")?;
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(payload.data_base64.as_bytes())
    .map_err(|e| format!("Failed to parse resource data: {e}"))?;
  security::ensure_binary_payload_size(&bytes, "resource")?;
  crate::core::atomic_io::atomic_write(&target, &bytes).map_err(|e| format!("Failed to write resource: {e}"))?;
  let safe_workspace = safe_workspace_id(&payload.workspace_id)?;
  let absolute_path = target.to_string_lossy().to_string();
  Ok(AssetMeta {
    id: payload.asset_id,
    original_name: payload.original_name,
    relative_path: format!("workspace/{safe_workspace}/assets/{file_name}"),
    absolute_path: absolute_path.clone(),
    resolved_path: Some(absolute_path),
    storage_mode: Some(payload.storage_mode),
    mime_type: payload.mime_type,
    created_at: std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| e.to_string())?
      .as_millis() as i64,
    reference_count: Some(0),
    last_referenced_at: None,
  })
}

#[tauri::command]
pub fn read_luna_asset_index(payload: WorkspaceIdPayload) -> Result<AssetIndex, String> {
  luna_paths::ensure_luna_dirs()?;
  let path = asset_index_file(&payload.workspace_id)?;
  if !path.is_file() {
    return scan_luna_asset_index(payload);
  }
  let data = std::fs::read(&path).map_err(|e| e.to_string())?;
  serde_json::from_slice(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_luna_asset_index(payload: WriteLunaAssetIndexPayload) -> Result<(), String> {
  luna_paths::ensure_luna_dirs()?;
  for meta in payload.index.assets.values() {
    security::validate_asset_meta_path(&meta.absolute_path, &payload.workspace_root)?;
    if let Some(resolved) = meta.resolved_path.as_deref() {
      security::validate_asset_meta_path(resolved, &payload.workspace_root)?;
    }
  }
  let path = asset_index_file(&payload.workspace_id)?;
  let data = serde_json::to_vec_pretty(&payload.index).map_err(|e| e.to_string())?;
  security::ensure_json_payload_size(&data, "Asset Index")?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_luna_asset_index(payload: WorkspaceIdPayload) -> Result<AssetIndex, String> {
  let dir = workspace_assets_dir(&payload.workspace_id)?;
  let safe_workspace = safe_workspace_id(&payload.workspace_id)?;
  let mut index = AssetIndex::default();
  for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if !path.is_file() || path.file_name().and_then(|it| it.to_str()) == Some("index.json") {
      continue;
    }
    let Some(file_name) = path.file_name().and_then(|it| it.to_str()) else {
      continue;
    };
    let (id, original_name) = parse_asset_disk_name(file_name);
    let meta = AssetMeta {
      id: id.clone(),
      original_name,
      relative_path: format!("workspace/{safe_workspace}/assets/{file_name}"),
      absolute_path: path.to_string_lossy().to_string(),
      resolved_path: Some(path.to_string_lossy().to_string()),
      storage_mode: None,
      mime_type: "application/octet-stream".to_string(),
      created_at: entry
        .metadata()
        .ok()
        .and_then(|m| m.created().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0),
      reference_count: Some(0),
      last_referenced_at: None,
    };
    index.assets.insert(id, meta);
  }
  Ok(index)
}

#[tauri::command]
pub fn path_exists(payload: PathExistsPayload) -> Result<bool, String> {
  security::ensure_scoped_path_exists(&payload.path, &payload.workspace_root)
}

#[tauri::command]
pub fn register_workspace_asset_scope(app: AppHandle, workspace_root: String) -> Result<(), String> {
  let trimmed = workspace_root.trim();
  if trimmed.is_empty() {
    return Ok(());
  }
  let resolved = security::ensure_listable_workspace_root(trimmed)?;
  app.asset_protocol_scope()
    .allow_directory(&resolved, true)
    .map_err(|e| format!("Failed to register resource protocol scope: {e}"))
}

#[tauri::command]
pub fn open_trusted_path(app: AppHandle, payload: ScopedPathPayload) -> Result<(), String> {
  let resolved = security::ensure_open_allowed(&payload.path, &payload.workspace_root)?;
  app
    .opener()
    .open_path(resolved.to_string_lossy(), None::<&str>)
    .map_err(|e| format!("Failed to open file: {e}"))
}

fn dialog_file_path_to_string(path: FilePath) -> Result<String, String> {
  path
    .into_path()
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|_| "Selected path is not a local file".to_string())
}

fn read_picked_file_base64(path: &str) -> Result<(String, String), String> {
  let resolved = security::ensure_user_picked_import_read(path)?;
  let file_name = resolved
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("file.bin")
    .to_string();
  let bytes = std::fs::read(&resolved).map_err(|e| format!("Failed to read file: {e}"))?;
  let data_base64 = base64::engine::general_purpose::STANDARD.encode(bytes);
  Ok((file_name, data_base64))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedImportFile {
  pub file_name: String,
  pub mime_type: String,
  pub data_base64: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadImportFilesPayload {
  pub paths: Vec<String>,
}

/// Read user-selected paths (from JS `open()` dialog) into base64 payloads.
#[tauri::command]
pub fn read_import_files_base64(payload: ReadImportFilesPayload) -> Result<Vec<PickedImportFile>, String> {
  let mut out = Vec::with_capacity(payload.paths.len());
  for path in &payload.paths {
    let (file_name, data_base64) = read_picked_file_base64(path)?;
    out.push(PickedImportFile {
      file_name: file_name.clone(),
      mime_type: guess_import_mime(&file_name),
      data_base64,
    });
  }
  Ok(out)
}

fn guess_import_mime(file_name: &str) -> String {
  let ext = Path::new(file_name)
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_ascii_lowercase();
  match ext.as_str() {
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "gif" => "image/gif",
    "webp" => "image/webp",
    "svg" => "image/svg+xml",
    "bmp" => "image/bmp",
    "ico" => "image/x-icon",
    "avif" => "image/avif",
    "heif" | "heic" => "image/heif",
    "pdf" => "application/pdf",
    "md" | "markdown" => "text/markdown",
    _ => "application/octet-stream",
  }
  .to_string()
}

#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
  let validated = security::validate_external_open_url(&url)?;
  app
    .opener()
    .open_url(&validated, None::<&str>)
    .map_err(|e| format!("Failed to open URL: {e}"))
}

#[tauri::command]
pub fn list_markdown_files(payload: RootPayload) -> Result<Vec<String>, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::collect_markdown_files(&root)
}

#[tauri::command]
pub fn list_workspace_tree(payload: RootPayload) -> Result<Vec<files::FsTreeNode>, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::collect_workspace_tree(&root)
}

#[tauri::command]
pub fn read_note(payload: NotePayload) -> Result<String, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::read_file(&root, &payload.path)
}

#[tauri::command]
pub fn save_note(payload: SavePayload) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::save_file(
    &root,
    &payload.path,
    &payload.content,
    if payload.force_overwrite {
      None
    } else {
      payload.expected_modified_secs
    },
  )
}

#[tauri::command]
pub fn save_note_asset(payload: SaveAssetPayload) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::save_note_asset_file(
    &root,
    &payload.path,
    &payload.relative_path,
    &payload.data_base64,
  )
}

#[tauri::command]
pub fn note_asset_exists(payload: NoteAssetExistsPayload) -> Result<bool, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::note_asset_exists(&root, &payload.path, &payload.relative_path)
}

#[tauri::command]
pub fn read_workspace_file_base64(payload: ReadBinaryPayload) -> Result<String, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::read_file_base64(&root, &payload.path)
}

#[tauri::command]
pub fn sync_recent_menu(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
  let trimmed: Vec<String> = paths.into_iter().take(8).collect();
  let state = app.state::<RecentMenuPaths>();
  let mut guard = state.0.lock().map_err(|_| "Internal status error".to_string())?;
  * guard = trimmed;
  Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncThemeCssMenuPayload {
  pub names: Vec<String>,
}

#[tauri::command]
pub fn sync_theme_css_menu(app: AppHandle, payload: SyncThemeCssMenuPayload) -> Result<(), String> {
  let names: Vec<String> = payload.names.into_iter().take(24).collect();
  let state = app.state::<ThemeMenuCssNames>();
  let mut guard = state.0.lock().map_err(|_| "Internal status error".to_string())?;
  * guard = names;
  Ok(())
}

/// The command is retained to be compatible with front-end calls; the in-app menu maintains the full-screen check state by the front-end itself.
#[tauri::command]
pub fn sync_view_fullscreen_menu_checked(_app: AppHandle, _checked: bool) -> Result<(), String> {
  Ok(())
}

#[tauri::command]
pub fn watch_workspace(app: AppHandle, payload: RootPayload) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  crate::core::workspace_watch::watch_workspace_root(&app, &root)
}

#[tauri::command]
pub fn unwatch_workspace(app: AppHandle, payload: RootPayload) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  crate::core::workspace_watch::unwatch_workspace_root(&app, &root)
}

#[tauri::command]
pub fn note_file_stat(payload: NotePayload) -> Result<files::NoteFileStat, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::note_file_stat(&root, &payload.path)
}

fn index_notes_impl(state: &AppState, root: &str) -> Result<IndexResponse, String> {
  use std::collections::HashSet;
  let _index_guard = state
    .index_notes_lock
    .lock()
    .map_err(|_| "Indexing task in progress".to_string())?;

  let files = files::collect_markdown_files(root)?;
  let root_changed = {
    let indexed_root = state
      .indexed_root
      .lock()
      .map_err(|_| "Abnormal index directory status".to_string())?;
    indexed_root.as_deref() != Some(root)
  };

  let mut fingerprints = state
    .note_index_fingerprints
    .lock()
    .map_err(|_| "Abnormal index fingerprint status".to_string())?;
  if root_changed {
    fingerprints.clear();
  }

  let current_paths: HashSet<String> = files.iter().cloned().collect();
  let removed: Vec<String> = fingerprints
    .keys()
    .filter(|path| !current_paths.contains(*path))
    .cloned()
    .collect();
  for path in &removed {
    fingerprints.remove(path);
  }

  fn file_fingerprint(path: &str) -> Result<(u64, u64), String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("Failed to read file information: {e}"))?;
    let modified_secs = meta
      .modified()
      .ok()
      .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
      .map(|d| d.as_secs())
      .unwrap_or(0);
    Ok((modified_secs, meta.len()))
  }

  let mut notes = Vec::new();
  let mut skipped = 0usize;

  if root_changed {
    for file in files {
      let meta = match std::fs::metadata(&file) {
        Ok(m) => m,
        Err(e) => {
          log::warn!("index_notes skip unreadable stat {file}: {e}");
          skipped += 1;
          continue;
        }
      };
      if security::ensure_note_file_size(meta.len(), "note").is_err() {
        log::warn!("index_notes skip oversized file {file} ({} bytes)", meta.len());
        skipped += 1;
        continue;
      }
      let content = match std::fs::read_to_string(&file) {
        Ok(text) => text,
        Err(e) => {
          log::warn!("index_notes skip unreadable file {file}: {e}");
          skipped += 1;
          continue;
        }
      };
      let title = Path::new(&file)
        .file_name()
        .and_then(|it| it.to_str())
        .unwrap_or("untitled")
        .to_string();
      if let Ok(fp) = file_fingerprint(&file) {
        fingerprints.insert(file.clone(), fp);
      }
      notes.push((file, title, content));
    }
    let conn = state
      .search_conn
      .lock()
      .map_err(|_| "Search connection status abnormal".to_string())?;
    let count = search::rebuild_index(&conn, &notes)?;
    let mut indexed_root = state
      .indexed_root
      .lock()
      .map_err(|_| "Abnormal index directory status".to_string())?;
    * indexed_root = Some(root.to_string());
    return Ok(IndexResponse { count, skipped });
  }

  let mut upserts = Vec::new();
  for file in files {
    let fingerprint = match file_fingerprint(&file) {
      Ok(fp) => fp,
      Err(e) => {
        log::warn!("index_notes skip unreadable stat {file}: {e}");
        skipped += 1;
        continue;
      }
    };
    if fingerprints.get(&file).copied() == Some(fingerprint) {
      continue;
    }
    if security::ensure_note_file_size(fingerprint.1, "note").is_err() {
      log::warn!("index_notes skip oversized file {file} ({} bytes)", fingerprint.1);
      skipped += 1;
      continue;
    }
    let content = match std::fs::read_to_string(&file) {
      Ok(text) => text,
      Err(e) => {
        log::warn!("index_notes skip unreadable file {file}: {e}");
        skipped += 1;
        continue;
      }
    };
    let title = Path::new(&file)
      .file_name()
      .and_then(|it| it.to_str())
      .unwrap_or("untitled")
      .to_string();
    fingerprints.insert(file.clone(), fingerprint);
    upserts.push((file, title, content));
  }

  let conn = state
    .search_conn
    .lock()
    .map_err(|_| "Search connection status abnormal".to_string())?;
  let count = if upserts.is_empty() && removed.is_empty() {
    0
  } else {
    search::apply_index_delta(&conn, &upserts, &removed)?
  };

  let mut indexed_root = state
    .indexed_root
    .lock()
    .map_err(|_| "Abnormal index directory status".to_string())?;
  * indexed_root = Some(root.to_string());
  Ok(IndexResponse { count, skipped })
}

#[tauri::command]
pub async fn index_notes(
  app: AppHandle,
  payload: RootPayload,
) -> Result<IndexResponse, String> {
  let root = resolve_workspace_root(&payload.root)?;
  tauri::async_runtime::spawn_blocking(move || {
    let state = app.state::<AppState>();
    index_notes_impl(&state, &root)
  })
  .await
  .map_err(|e| format!("Indexing task failed: {e}"))?
}

#[tauri::command]
pub fn search_notes(
  state: State<'_, AppState>,
  payload: SearchPayload,
) -> Result<Vec<search::SearchResult>, String> {
  let conn = state
    .search_conn
    .lock()
    .map_err(|_| "Search connection status abnormal".to_string())?;
  let mut results = search::query(
    &conn,
    &security::clamp_search_query(&payload.query)?,
    payload.limit.unwrap_or(30),
  )?;
  if let Some(root) = payload
    .workspace_root
    .as_deref()
    .map(str::trim)
    .filter(|s| !s.is_empty())
  {
    results.retain(|hit| security::path_under_workspace(&hit.path, root));
  } else if let Ok(indexed_root) = state.indexed_root.lock() {
    if let Some(root) = indexed_root.as_deref() {
      results.retain(|hit| security::path_under_workspace(&hit.path, root));
    }
  }
  Ok(results)
}

#[tauri::command]
pub fn delete_note(payload: NotePayload) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::delete_note_file(&root, &payload.path)
}

#[tauri::command]
pub fn rename_note(mut payload: files::RenameNotePayload) -> Result<String, String> {
  payload.root = resolve_workspace_root(&payload.root)?;
  files::rename_note_file(&payload)
}

#[tauri::command]
pub fn move_note(mut payload: files::MoveNotePayload) -> Result<String, String> {
  payload.root = resolve_workspace_root(&payload.root)?;
  files::move_note_file(&payload)
}

#[tauri::command]
pub fn create_new_note(payload: RootPayload) -> Result<String, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::create_new_note(&root)
}

#[tauri::command]
pub fn create_note(mut payload: files::CreateNotePayload) -> Result<String, String> {
  payload.root = resolve_workspace_root(&payload.root)?;
  files::create_note(&payload)
}

#[tauri::command]
pub fn create_new_note_in_parent(payload: files::ParentDirPayload) -> Result<String, String> {
  let root = resolve_workspace_root(&payload.root)?;
  files::create_new_note_in_parent(&root, &payload.parent_path)
}

#[tauri::command]
pub fn create_workspace_folder(mut payload: files::CreateFolderPayload) -> Result<String, String> {
  payload.root = resolve_workspace_root(&payload.root)?;
  files::create_workspace_folder(&payload)
}

#[tauri::command]
pub fn import_external_paths_into_workspace(
  mut payload: files::ImportExternalPathsPayload,
) -> Result<files::ImportExternalPathsResult, String> {
  payload.root = resolve_workspace_root(&payload.root)?;
  files::import_external_paths_into_workspace(&payload)
}

#[tauri::command]
pub fn import_dropped_file_bytes(
  mut payload: files::ImportDroppedFileBytesPayload,
) -> Result<String, String> {
  payload.root = resolve_workspace_root(&payload.root)?;
  files::import_dropped_file_bytes(&payload)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathPayload {
  pub root: String,
  pub path: String,
}

#[tauri::command]
pub fn workspace_path_is_directory(mut payload: WorkspacePathPayload) -> Result<bool, String> {
  payload.root = resolve_workspace_root(&payload.root)?;
  files::workspace_path_is_directory(&payload.root, &payload.path)
}

#[tauri::command]
pub fn import_markdown_via_dialog(app: AppHandle, root: String) -> Result<Option<String>, String> {
  let root = resolve_workspace_root(&root)?;
  let picked = app
    .dialog()
    .file()
    .add_filter("Markdown", &["md", "markdown"])
    .blocking_pick_file();
  let Some(path) = picked else {
    return Ok(None);
  };
  let source = dialog_file_path_to_string(path)?;
  let dest = files::import_markdown_file(&root, &source)?;
  Ok(Some(dest))
}

#[tauri::command]
pub fn export_note(payload: files::ExportNotePayload) -> Result<(), String> {
  files::export_note_to_path(&payload)
}

#[tauri::command]
pub fn export_note_binary(payload: files::ExportBinaryPayload) -> Result<(), String> {
  files::export_binary_to_path(&payload)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderHtmlToPdfPayload {
  pub html: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderHtmlToPdfToPathPayload {
  pub html: String,
  pub path: String,
  pub workspace_root: String,
}

#[tauri::command]
pub async fn render_html_to_pdf_base64(payload: RenderHtmlToPdfPayload) -> Result<String, String> {
  let html = payload.html;
  tauri::async_runtime::spawn_blocking(move || crate::pdf_render::render_html_to_pdf_base64(&html))
    .await
    .map_err(|e| format!("PDF rendering task failed: {e}"))?
}

#[tauri::command]
pub async fn render_html_to_pdf_to_path(payload: RenderHtmlToPdfToPathPayload) -> Result<(), String> {
  let html = payload.html;
  let path = payload.path;
  let workspace_root = payload.workspace_root;
  tauri::async_runtime::spawn_blocking(move || {
    let bytes = crate::pdf_render::render_html_to_pdf_bytes(&html)?;
    security::ensure_export_binary_payload_size(&bytes, "PDF export data")?;
    let resolved = security::ensure_export_allowed(&path, &workspace_root)?;
    if let Some(par) = resolved.parent() {
      std::fs::create_dir_all(par).map_err(|e| format!("Failed to create directory: {e}"))?;
    }
    crate::core::atomic_io::atomic_write(&resolved, &bytes).map_err(|e| format!("Export failed: {e}"))?;
    Ok(())
  })
  .await
  .map_err(|e| format!("PDF export task failed: {e}"))?
}

#[tauri::command]
pub fn reveal_in_explorer(payload: ScopedPathPayload) -> Result<(), String> {
  files::reveal_path_in_explorer(&payload.path, &payload.workspace_root)
}

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
  Ok(app_settings::read_app_settings(&app))
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
  app_settings::write_app_settings(&app, &settings)?;
  Ok(())
}

