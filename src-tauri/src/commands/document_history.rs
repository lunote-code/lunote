use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::time::Instant;

use uuid::Uuid;

use crate::{
  core::{files, security, workspace_encryption},
  luna_paths,
};

use super::{resolve_note_crypto_key, resolve_workspace_root, safe_workspace_id, NotePayload, WorkspaceCryptoState};
use tauri::State;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocumentHistoryEntry {
  pub id: String,
  pub workspace_id: String,
  pub path: String,
  pub created_at: i64,
  pub source: String,
  #[serde(default)]
  pub title: Option<String>,
  #[serde(default)]
  pub excerpt: Option<String>,
  pub content_hash: String,
  pub size: usize,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocumentHistorySnapshot {
  pub entry: DocumentHistoryEntry,
  pub content: String,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocumentHistoryIndex {
  pub entries: Vec<DocumentHistoryEntry>,
}

const MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH: usize = 50;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentSnapshotPayload {
  pub root: String,
  pub path: String,
  pub content: String,
  #[serde(default)]
  pub title: Option<String>,
  #[serde(default)]
  pub source: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDocumentSnapshotPayload {
  pub root: String,
  pub path: String,
  pub snapshot_id: String,
}

#[tauri::command]
pub fn create_document_snapshot(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: CreateDocumentSnapshotPayload,
) -> Result<DocumentHistoryEntry, String> {
  create_document_snapshot_impl(&crypto, payload)
}

fn create_document_snapshot_impl(
  crypto: &WorkspaceCryptoState,
  payload: CreateDocumentSnapshotPayload,
) -> Result<DocumentHistoryEntry, String> {
  let root = resolve_workspace_root(&payload.root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let key = resolve_note_crypto_key(&crypto, &root)?;
  let _ = files::read_file(&root, &payload.path, key.as_ref())?;
  let created_at = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_millis() as i64;
  let snapshot_id = format!("snap-{created_at}-{}", Uuid::new_v4());
  let title = payload
    .title
    .and_then(normalize_snapshot_title)
    .or_else(|| parse_frontmatter_title(&payload.content));
  let entry = DocumentHistoryEntry {
    id: snapshot_id.clone(),
    workspace_id: workspace_id.clone(),
    path: payload.path,
    created_at,
    source: payload.source.unwrap_or_else(|| "manual".to_string()),
    title,
    excerpt: build_snapshot_excerpt(&payload.content),
    content_hash: hash_document_content(&payload.content),
    size: payload.content.len(),
  };
  let snapshot = DocumentHistorySnapshot {
    entry: entry.clone(),
    content: payload.content,
  };
  let mut index = read_document_history_index(&workspace_id, key.as_ref())?;
  index.entries.retain(|item| item.id != entry.id);
  index.entries.push(entry.clone());
  index.entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
  let pruned_entries = prune_document_history_entries_for_path(&mut index, &entry.path);
  write_document_history_snapshot(&workspace_id, &snapshot, key.as_ref())?;
  for stale_entry in pruned_entries {
    let stale_path = document_history_snapshot_file(&workspace_id, &stale_entry.id)?;
    if stale_path.is_file() {
      std::fs::remove_file(&stale_path).map_err(|e| e.to_string())?;
    }
  }
  write_document_history_index(&workspace_id, &index, key.as_ref())?;
  Ok(entry)
}

#[tauri::command]
pub fn list_document_snapshots(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: NotePayload,
) -> Result<Vec<DocumentHistoryEntry>, String> {
  list_document_snapshots_impl(&crypto, payload)
}

fn list_document_snapshots_impl(
  crypto: &WorkspaceCryptoState,
  payload: NotePayload,
) -> Result<Vec<DocumentHistoryEntry>, String> {
  let started_at = Instant::now();
  log::info!(
    "[history] list_document_snapshots:start root={} path={}",
    payload.root,
    payload.path
  );
  let root = resolve_workspace_root(&payload.root)?;
  log::info!(
    "[history] list_document_snapshots:root_resolved root={} path={} elapsed_ms={}",
    root,
    payload.path,
    started_at.elapsed().as_millis()
  );
  let key = resolve_note_crypto_key(crypto, &root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let index = read_document_history_index(&workspace_id, key.as_ref())?;
  let mut entries = index
    .entries
    .into_iter()
    .filter(|entry| entry.path == payload.path)
    .collect::<Vec<_>>();
  entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
  log::info!(
    "[history] list_document_snapshots:ok workspace_id={} path={} count={} elapsed_ms={}",
    workspace_id,
    payload.path,
    entries.len(),
    started_at.elapsed().as_millis()
  );
  Ok(entries)
}

#[tauri::command]
pub fn read_document_snapshot(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: ReadDocumentSnapshotPayload,
) -> Result<DocumentHistorySnapshot, String> {
  read_document_snapshot_impl(&crypto, payload)
}

fn read_document_snapshot_impl(
  crypto: &WorkspaceCryptoState,
  payload: ReadDocumentSnapshotPayload,
) -> Result<DocumentHistorySnapshot, String> {
  let root = resolve_workspace_root(&payload.root)?;
  let key = resolve_note_crypto_key(crypto, &root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let snapshot = read_document_history_snapshot(&workspace_id, &payload.snapshot_id, key.as_ref())?;
  validate_document_history_snapshot(snapshot, &workspace_id, &payload.path)
}

#[tauri::command]
pub fn delete_document_snapshot(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: ReadDocumentSnapshotPayload,
) -> Result<(), String> {
  delete_document_snapshot_impl(&crypto, payload)
}

fn delete_document_snapshot_impl(
  crypto: &WorkspaceCryptoState,
  payload: ReadDocumentSnapshotPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  let key = resolve_note_crypto_key(crypto, &root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let snapshot = read_document_history_snapshot(&workspace_id, &payload.snapshot_id, key.as_ref())?;
  let snapshot = validate_document_history_snapshot(snapshot, &workspace_id, &payload.path)?;
  let path = document_history_snapshot_file(&workspace_id, &payload.snapshot_id)?;
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
  }
  let mut index = read_document_history_index(&workspace_id, key.as_ref())?;
  index
    .entries
    .retain(|entry| !(entry.id == snapshot.entry.id && entry.path == snapshot.entry.path));
  write_document_history_index(&workspace_id, &index, key.as_ref())
}

#[tauri::command]
pub fn delete_all_document_snapshots(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: NotePayload,
) -> Result<usize, String> {
  delete_all_document_snapshots_impl(&crypto, payload)
}

fn delete_all_document_snapshots_impl(
  crypto: &WorkspaceCryptoState,
  payload: NotePayload,
) -> Result<usize, String> {
  let root = resolve_workspace_root(&payload.root)?;
  let key = resolve_note_crypto_key(crypto, &root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let mut index = read_document_history_index(&workspace_id, key.as_ref())?;
  let mut removed = Vec::new();
  index.entries.retain(|entry| {
    if entry.path == payload.path {
      removed.push(entry.clone());
      false
    } else {
      true
    }
  });
  for entry in &removed {
    let snapshot_path = document_history_snapshot_file(&workspace_id, &entry.id)?;
    if snapshot_path.is_file() {
      std::fs::remove_file(&snapshot_path).map_err(|e| e.to_string())?;
    }
  }
  write_document_history_index(&workspace_id, &index, key.as_ref())?;
  Ok(removed.len())
}

fn workspace_history_dir(workspace_id: &str) -> Result<PathBuf, String> {
  let safe_id = safe_workspace_id(workspace_id)?;
  let dir = luna_paths::get_history_path()?.join(&safe_id);
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create history directory: {e}"))?;
  Ok(dir)
}

fn workspace_history_snapshots_dir(workspace_id: &str) -> Result<PathBuf, String> {
  let dir = workspace_history_dir(workspace_id)?.join("snapshots");
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create snapshots directory: {e}"))?;
  Ok(dir)
}

fn document_history_index_file(workspace_id: &str) -> Result<PathBuf, String> {
  Ok(workspace_history_dir(workspace_id)?.join("index.json"))
}

fn document_history_snapshot_file(workspace_id: &str, snapshot_id: &str) -> Result<PathBuf, String> {
  let safe_snapshot_id = safe_workspace_id(snapshot_id)?;
  Ok(workspace_history_snapshots_dir(workspace_id)?.join(format!("{safe_snapshot_id}.json")))
}

fn read_history_sidecar_json<T: serde::de::DeserializeOwned>(
  path: &PathBuf,
  key: Option<&[u8; 32]>,
) -> Result<T, String> {
  let data = std::fs::read(path).map_err(|e| e.to_string())?;
  let plaintext = workspace_encryption::decode_sidecar_bytes(&data, key)?;
  security::ensure_json_payload_size(&plaintext, "Document history")?;
  serde_json::from_slice(&plaintext).map_err(|e| e.to_string())
}

fn write_history_sidecar_json<T: serde::Serialize>(
  path: &PathBuf,
  value: &T,
  label: &str,
  key: Option<&[u8; 32]>,
) -> Result<(), String> {
  let data = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
  security::ensure_json_payload_size(&data, label)?;
  let encoded = workspace_encryption::encode_sidecar_bytes(&data, key)?;
  crate::core::atomic_io::atomic_write(path, &encoded).map_err(|e| e.to_string())
}

fn read_document_history_index(
  workspace_id: &str,
  key: Option<&[u8; 32]>,
) -> Result<DocumentHistoryIndex, String> {
  luna_paths::ensure_luna_dirs()?;
  let path = document_history_index_file(workspace_id)?;
  if !path.is_file() {
    return Ok(DocumentHistoryIndex::default());
  }
  read_history_sidecar_json(&path, key)
}

fn write_document_history_index(
  workspace_id: &str,
  index: &DocumentHistoryIndex,
  key: Option<&[u8; 32]>,
) -> Result<(), String> {
  let path = document_history_index_file(workspace_id)?;
  write_history_sidecar_json(&path, index, "Document history index", key)
}

fn read_document_history_snapshot(
  workspace_id: &str,
  snapshot_id: &str,
  key: Option<&[u8; 32]>,
) -> Result<DocumentHistorySnapshot, String> {
  let path = document_history_snapshot_file(workspace_id, snapshot_id)?;
  read_history_sidecar_json(&path, key)
}

fn validate_document_history_snapshot(
  snapshot: DocumentHistorySnapshot,
  workspace_id: &str,
  path: &str,
) -> Result<DocumentHistorySnapshot, String> {
  if snapshot.entry.workspace_id != workspace_id {
    return Err("Document history snapshot workspace mismatch".to_string());
  }
  if snapshot.entry.path != path {
    return Err("Document history snapshot path mismatch".to_string());
  }
  Ok(snapshot)
}

fn write_document_history_snapshot(
  workspace_id: &str,
  snapshot: &DocumentHistorySnapshot,
  key: Option<&[u8; 32]>,
) -> Result<(), String> {
  let path = document_history_snapshot_file(workspace_id, &snapshot.entry.id)?;
  write_history_sidecar_json(&path, snapshot, "Document history snapshot", key)
}

fn hash_document_content(content: &str) -> String {
  let mut hasher = DefaultHasher::new();
  content.hash(&mut hasher);
  format!("{:x}", hasher.finish())
}

fn prune_document_history_entries_for_path(
  index: &mut DocumentHistoryIndex,
  path: &str,
) -> Vec<DocumentHistoryEntry> {
  let mut kept_for_path = 0usize;
  let mut retained = Vec::with_capacity(index.entries.len());
  let mut pruned = Vec::new();

  for entry in index.entries.drain(..) {
    if entry.path == path {
      if kept_for_path < MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH {
        kept_for_path += 1;
        retained.push(entry);
      } else {
        pruned.push(entry);
      }
    } else {
      retained.push(entry);
    }
  }

  index.entries = retained;
  pruned
}

fn normalize_snapshot_title(value: String) -> Option<String> {
  let trimmed = value.trim();
  if trimmed.is_empty() || is_weak_snapshot_line(trimmed) {
    None
  } else {
    Some(trimmed.to_string())
  }
}

fn strip_leading_yaml_frontmatter(content: &str) -> &str {
  let bytes = content.as_bytes();
  if bytes.len() < 4 || &bytes[0..3] != b"---" {
    return content;
  }

  let mut idx = 3usize;
  if bytes.get(idx) == Some(&b'\r') {
    idx += 1;
  }
  if bytes.get(idx) != Some(&b'\n') {
    return content;
  }
  idx += 1;

  let rest = &content[idx..];
  if let Some(close) = rest.find("\n---\n") {
    return &rest[close + 5..];
  }
  if let Some(close) = rest.find("\n---\r\n") {
    return &rest[close + 6..];
  }
  if let Some(close) = rest.find("\n---") {
    let after = &rest[close + 4..];
    if after.is_empty() {
      return "";
    }
    if let Some(stripped) = after.strip_prefix("\r\n") {
      return stripped;
    }
    if let Some(stripped) = after.strip_prefix('\n') {
      return stripped;
    }
    return after;
  }

  content
}

fn parse_frontmatter_title(content: &str) -> Option<String> {
  let bytes = content.as_bytes();
  if bytes.len() < 4 || &bytes[0..3] != b"---" {
    return None;
  }

  let mut idx = 3usize;
  if bytes.get(idx) == Some(&b'\r') {
    idx += 1;
  }
  if bytes.get(idx) != Some(&b'\n') {
    return None;
  }
  idx += 1;

  let rest = &content[idx..];
  let close = rest
    .find("\n---\n")
    .or_else(|| rest.find("\n---\r\n"))
    .or_else(|| rest.find("\n---"))?;
  let frontmatter = &rest[..close];

  for line in frontmatter.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
      continue;
    }
    if let Some(raw) = trimmed.strip_prefix("title:") {
      return normalize_snapshot_title(parse_yaml_scalar(raw.trim()));
    }
  }

  None
}

fn parse_yaml_scalar(raw: &str) -> String {
  if raw.is_empty() {
    return String::new();
  }
  if (raw.starts_with('"') && raw.ends_with('"')) || (raw.starts_with('\'') && raw.ends_with('\'')) {
    return raw[1..raw.len().saturating_sub(1)].to_string();
  }
  raw.to_string()
}

fn is_weak_snapshot_line(line: &str) -> bool {
  let trimmed = line.trim();
  trimmed.is_empty()
    || trimmed.chars().all(|ch| ch == '-')
    || trimmed.chars().all(|ch| ch == '*')
    || trimmed.chars().all(|ch| ch == '_')
}

fn normalize_snapshot_line(line: &str) -> Option<String> {
  const MAX_EXCERPT_CHARS: usize = 120;

  let trimmed = line.trim();
  if is_weak_snapshot_line(trimmed) {
    return None;
  }

  let without_heading = trimmed.trim_start_matches('#').trim();
  if without_heading.is_empty() {
    return None;
  }

  let excerpt: String = without_heading.chars().take(MAX_EXCERPT_CHARS).collect();
  if excerpt.is_empty() {
    None
  } else {
    Some(excerpt)
  }
}

fn build_snapshot_excerpt(content: &str) -> Option<String> {
  let body = strip_leading_yaml_frontmatter(content);
  for line in body.lines() {
    if let Some(excerpt) = normalize_snapshot_line(line) {
      return Some(excerpt);
    }
  }
  None
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::ffi::OsString;
  use std::path::{Path, PathBuf};
  use std::sync::{Mutex, OnceLock};

  fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
  }

  struct TempHomeGuard {
    old_home: Option<OsString>,
    old_userprofile: Option<OsString>,
    temp_root: PathBuf,
  }

  impl Drop for TempHomeGuard {
    fn drop(&mut self) {
      match &self.old_home {
        Some(value) => std::env::set_var("HOME", value),
        None => std::env::remove_var("HOME"),
      }
      match &self.old_userprofile {
        Some(value) => std::env::set_var("USERPROFILE", value),
        None => std::env::remove_var("USERPROFILE"),
      }
      let _ = std::fs::remove_dir_all(&self.temp_root);
    }
  }

  fn setup_temp_home() -> (std::sync::MutexGuard<'static, ()>, TempHomeGuard, PathBuf) {
    let guard = env_lock().lock().unwrap_or_else(|err| err.into_inner());
    let old_home = std::env::var_os("HOME");
    let old_userprofile = std::env::var_os("USERPROFILE");
    let base_home = old_home
      .as_ref()
      .map(PathBuf::from)
      .or_else(|| old_userprofile.as_ref().map(PathBuf::from))
      .expect("resolve original home");
    let temp_root = base_home.join(format!(".lunote-history-test-{}", Uuid::new_v4()));
    let home = temp_root.join("home");
    let workspace = home.join("workspace");
    std::fs::create_dir_all(&home).expect("create temp home");
    std::fs::create_dir_all(&workspace).expect("create temp workspace");
    std::env::set_var("HOME", &home);
    std::env::set_var("USERPROFILE", &home);
    (
      guard,
      TempHomeGuard {
        old_home,
        old_userprofile,
        temp_root,
      },
      workspace,
    )
  }

  fn write_note(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
      std::fs::create_dir_all(parent).expect("create note parent");
    }
    std::fs::write(path, content).expect("write note");
  }

  fn create_snapshot(payload: CreateDocumentSnapshotPayload) -> DocumentHistoryEntry {
    let crypto = WorkspaceCryptoState::new();
    create_document_snapshot_impl(&crypto, payload).expect("create snapshot")
  }

  #[test]
  fn read_document_snapshot_rejects_mismatched_path() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    let beta = workspace.join("beta.md");
    write_note(&alpha, "# alpha\n");
    write_note(&beta, "# beta\n");

    let entry = create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    });

    let err = match read_document_snapshot_impl(&WorkspaceCryptoState::new(), ReadDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: beta.to_string_lossy().to_string(),
      snapshot_id: entry.id,
    }) {
      Ok(_) => panic!("read should reject mismatched path"),
      Err(err) => err,
    };
    assert!(err.contains("path mismatch"));
  }

  #[test]
  fn delete_document_snapshot_rejects_mismatched_path_and_preserves_entry() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    let beta = workspace.join("beta.md");
    write_note(&alpha, "# alpha\n");
    write_note(&beta, "# beta\n");

    let entry = create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    });

    let err = delete_document_snapshot_impl(
      &WorkspaceCryptoState::new(),
      ReadDocumentSnapshotPayload {
        root: workspace.to_string_lossy().to_string(),
        path: beta.to_string_lossy().to_string(),
        snapshot_id: entry.id.clone(),
      },
    )
    .expect_err("delete should reject mismatched path");
    assert!(err.contains("path mismatch"));

    let entries = list_document_snapshots_impl(
      &WorkspaceCryptoState::new(),
      NotePayload {
        root: workspace.to_string_lossy().to_string(),
        path: alpha.to_string_lossy().to_string(),
      },
    )
    .expect("list alpha snapshots");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].id, entry.id);
  }

  #[test]
  fn delete_all_document_snapshots_removes_only_matching_path() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    let beta = workspace.join("beta.md");
    write_note(&alpha, "# alpha\n");
    write_note(&beta, "# beta\n");

    create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot one\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    });
    create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot two\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    });
    create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: beta.to_string_lossy().to_string(),
      content: "# beta snapshot\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    });

    let removed = delete_all_document_snapshots_impl(
      &WorkspaceCryptoState::new(),
      NotePayload {
        root: workspace.to_string_lossy().to_string(),
        path: alpha.to_string_lossy().to_string(),
      },
    )
    .expect("delete alpha snapshots");
    assert_eq!(removed, 2);

    let alpha_entries = list_document_snapshots_impl(
      &WorkspaceCryptoState::new(),
      NotePayload {
        root: workspace.to_string_lossy().to_string(),
        path: alpha.to_string_lossy().to_string(),
      },
    )
    .expect("list alpha snapshots");
    assert!(alpha_entries.is_empty());

    let beta_entries = list_document_snapshots_impl(
      &WorkspaceCryptoState::new(),
      NotePayload {
        root: workspace.to_string_lossy().to_string(),
        path: beta.to_string_lossy().to_string(),
      },
    )
    .expect("list beta snapshots");
    assert_eq!(beta_entries.len(), 1);
  }

  #[test]
  fn utf8_frontmatter_build_snapshot_excerpt_skips_yaml_and_uses_body_heading() {
    let content = "---\ntitle: Atlas\n---\n# Deep Dive\n\nBody text\n";
    assert_eq!(
      build_snapshot_excerpt(content).as_deref(),
      Some("Deep Dive")
    );
    assert_eq!(
      parse_frontmatter_title(content).as_deref(),
      Some("Atlas")
    );
  }

  #[test]
  fn utf8_frontmatter_build_snapshot_excerpt_handles_chinese_title() {
    let content = "---\ntitle: Lunote 代码块保存异常报告\n---\n# 正文标题\n\nBody text\n";
    assert_eq!(
      parse_frontmatter_title(content).as_deref(),
      Some("Lunote 代码块保存异常报告")
    );
    assert_eq!(
      build_snapshot_excerpt(content).as_deref(),
      Some("正文标题")
    );
  }

  #[test]
  fn utf8_frontmatter_strip_yaml_avoids_invalid_byte_boundary() {
    let content = "---\ntitle: Lunote 代码块保存异常报告\n---\n# 正文\n";
    let rest = &content[4..];
    assert!(
      !rest.is_char_boundary(15),
      "fixture must place a multibyte char across the old byte-scan failure index"
    );
    assert_eq!(strip_leading_yaml_frontmatter(content), "# 正文\n");
  }

  #[test]
  fn utf8_frontmatter_strip_yaml_handles_crlf_and_quoted_title() {
    let content = "---\r\ntitle: \"日本語タイトル\"\r\n---\r\n# 見出し\r\n";
    assert_eq!(
      parse_frontmatter_title(content).as_deref(),
      Some("日本語タイトル")
    );
    assert_eq!(
      strip_leading_yaml_frontmatter(content),
      "# 見出し\r\n"
    );
    assert_eq!(
      build_snapshot_excerpt(content).as_deref(),
      Some("見出し")
    );
  }

  #[test]
  fn utf8_frontmatter_strip_yaml_handles_emoji_title() {
    let content = "---\ntitle: 笔记 📝 保存测试\n---\n# Hello\n";
    assert_eq!(
      parse_frontmatter_title(content).as_deref(),
      Some("笔记 📝 保存测试")
    );
    assert_eq!(strip_leading_yaml_frontmatter(content), "# Hello\n");
  }

  #[test]
  fn utf8_frontmatter_create_document_snapshot_survives_chinese_frontmatter() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let note = workspace.join("report.md");
    let content = "---\ntitle: Lunote 代码块保存异常报告\n---\n# 正文标题\n\n保存后自动生成快照。\n";
    write_note(&note, content);

    let entry = create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: note.to_string_lossy().to_string(),
      content: content.to_string(),
      title: None,
      source: Some("save".to_string()),
    });

    assert_eq!(
      entry.title.as_deref(),
      Some("Lunote 代码块保存异常报告")
    );
    assert_eq!(entry.excerpt.as_deref(), Some("正文标题"));
    assert_eq!(entry.source, "save");
  }

  #[test]
  fn build_snapshot_excerpt_ignores_frontmatter_delimiter_line() {
    let content = "---\ntitle: Note\n---\n";
    assert_eq!(build_snapshot_excerpt(content), None);
  }

  #[test]
  fn build_snapshot_excerpt_uses_first_meaningful_line_without_frontmatter() {
    let content = "# Snapshot Title\n\nBody\n";
    assert_eq!(
      build_snapshot_excerpt(content).as_deref(),
      Some("Snapshot Title")
    );
  }

  #[test]
  fn create_document_snapshot_generates_unique_ids() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    write_note(&alpha, "# alpha\n");

    let first = create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot one\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    });
    let second = create_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot two\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    });

    assert_ne!(first.id, second.id);

    let entries = list_document_snapshots_impl(
      &WorkspaceCryptoState::new(),
      NotePayload {
        root: workspace.to_string_lossy().to_string(),
        path: alpha.to_string_lossy().to_string(),
      },
    )
    .expect("list alpha snapshots");
    assert_eq!(entries.len(), 2);
  }

  #[test]
  fn create_document_snapshot_prunes_old_entries_per_path() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    write_note(&alpha, "# alpha\n");

    for idx in 0..(MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH + 5) {
      create_snapshot(CreateDocumentSnapshotPayload {
        root: workspace.to_string_lossy().to_string(),
        path: alpha.to_string_lossy().to_string(),
        content: format!("# alpha snapshot {idx}\n"),
        title: None,
        source: Some("manual".to_string()),
      });
    }

    let entries = list_document_snapshots_impl(
      &WorkspaceCryptoState::new(),
      NotePayload {
        root: workspace.to_string_lossy().to_string(),
        path: alpha.to_string_lossy().to_string(),
      },
    )
    .expect("list alpha snapshots");
    assert_eq!(entries.len(), MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH);

    let workspace_id = safe_workspace_id(&workspace.to_string_lossy()).expect("workspace id");
    let snapshot_dir = workspace_history_snapshots_dir(&workspace_id).expect("history snapshots dir");
    let snapshot_count = std::fs::read_dir(snapshot_dir)
      .expect("read history snapshots dir")
      .count();
    assert_eq!(snapshot_count, MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH);
  }

  const HISTORY_ENCRYPTION_PASSWORD: &str = "test-password-123";

  fn disk_contains(path: &std::path::Path, needle: &[u8]) -> bool {
    let bytes = std::fs::read(path).expect("read history file");
    bytes.windows(needle.len()).any(|window| window == needle)
  }

  #[test]
  fn document_history_encrypted_snapshot_is_ciphertext_and_roundtrips() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = workspace.to_string_lossy().to_string();
    let crypto = WorkspaceCryptoState::new();
    let note = workspace.join("alpha.md");
    write_note(&note, "# alpha\n");
    crate::core::workspace_encryption::enable_workspace_encryption(
      &crypto,
      &root,
      HISTORY_ENCRYPTION_PASSWORD,
    )
    .expect("enable encryption");

    let content = "# classified history body\n";
    let entry = create_document_snapshot_impl(
      &crypto,
      CreateDocumentSnapshotPayload {
        root: root.clone(),
        path: note.to_string_lossy().to_string(),
        content: content.to_string(),
        title: Some("Classified Title".to_string()),
        source: Some("manual".to_string()),
      },
    )
    .expect("create encrypted snapshot");

    let workspace_id = safe_workspace_id(&root).expect("workspace id");
    let snapshot_path = document_history_snapshot_file(&workspace_id, &entry.id).expect("snapshot path");
    let index_path = document_history_index_file(&workspace_id).expect("index path");
    let snapshot_bytes = std::fs::read(&snapshot_path).expect("read snapshot file");
    let index_bytes = std::fs::read(&index_path).expect("read index file");
    assert!(workspace_encryption::is_encrypted_payload(&snapshot_bytes));
    assert!(workspace_encryption::is_encrypted_payload(&index_bytes));
    assert!(!disk_contains(&snapshot_path, content.as_bytes()));
    assert!(!disk_contains(&index_path, b"Classified Title"));

    let snapshot = read_document_snapshot_impl(
      &crypto,
      ReadDocumentSnapshotPayload {
        root: root.clone(),
        path: note.to_string_lossy().to_string(),
        snapshot_id: entry.id.clone(),
      },
    )
    .expect("read encrypted snapshot");
    assert_eq!(snapshot.content, content);
    assert_eq!(snapshot.entry.title.as_deref(), Some("Classified Title"));

    let listed = list_document_snapshots_impl(
      &crypto,
      NotePayload {
        root,
        path: note.to_string_lossy().to_string(),
      },
    )
    .expect("list encrypted snapshots");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, entry.id);
  }

  #[test]
  fn document_history_encrypted_locked_read_fails() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = workspace.to_string_lossy().to_string();
    let crypto = WorkspaceCryptoState::new();
    let note = workspace.join("alpha.md");
    write_note(&note, "# alpha\n");
    crate::core::workspace_encryption::enable_workspace_encryption(
      &crypto,
      &root,
      HISTORY_ENCRYPTION_PASSWORD,
    )
    .expect("enable encryption");
    let entry = create_document_snapshot_impl(
      &crypto,
      CreateDocumentSnapshotPayload {
        root: root.clone(),
        path: note.to_string_lossy().to_string(),
        content: "# locked history\n".to_string(),
        title: None,
        source: Some("manual".to_string()),
      },
    )
    .expect("create snapshot");

    crate::core::workspace_encryption::lock_workspace(&crypto, &root);
    let list_err = match list_document_snapshots_impl(
      &crypto,
      NotePayload {
        root: root.clone(),
        path: note.to_string_lossy().to_string(),
      },
    ) {
      Ok(_) => panic!("locked list must fail"),
      Err(err) => err,
    };
    assert_eq!(list_err, "WORKSPACE_LOCKED");
    let read_err = match read_document_snapshot_impl(
      &crypto,
      ReadDocumentSnapshotPayload {
        root,
        path: note.to_string_lossy().to_string(),
        snapshot_id: entry.id,
      },
    ) {
      Ok(_) => panic!("locked read must fail"),
      Err(err) => err,
    };
    assert_eq!(read_err, "WORKSPACE_LOCKED");
  }

  #[test]
  fn document_history_encrypted_legacy_plaintext_readable_when_unlocked() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = workspace.to_string_lossy().to_string();
    let crypto = WorkspaceCryptoState::new();
    let note = workspace.join("alpha.md");
    write_note(&note, "# alpha\n");
    crate::core::workspace_encryption::enable_workspace_encryption(
      &crypto,
      &root,
      HISTORY_ENCRYPTION_PASSWORD,
    )
    .expect("enable encryption");

    let workspace_id = safe_workspace_id(&root).expect("workspace id");
    let leftover = DocumentHistorySnapshot {
      entry: DocumentHistoryEntry {
        id: "snap-legacy-1".to_string(),
        workspace_id: workspace_id.clone(),
        path: note.to_string_lossy().to_string(),
        created_at: 1,
        source: "manual".to_string(),
        title: Some("Leftover Title".to_string()),
        excerpt: Some("leftover excerpt".to_string()),
        content_hash: "abc".to_string(),
        size: 16,
      },
      content: "# leftover body\n".to_string(),
    };
    write_document_history_snapshot(&workspace_id, &leftover, None).expect("write leftover snapshot");
    write_document_history_index(
      &workspace_id,
      &DocumentHistoryIndex {
        entries: vec![leftover.entry.clone()],
      },
      None,
    )
    .expect("write leftover index");

    let listed = list_document_snapshots_impl(
      &crypto,
      NotePayload {
        root: root.clone(),
        path: note.to_string_lossy().to_string(),
      },
    )
    .expect("list leftover snapshots");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].title.as_deref(), Some("Leftover Title"));
    let snapshot = read_document_snapshot_impl(
      &crypto,
      ReadDocumentSnapshotPayload {
        root,
        path: note.to_string_lossy().to_string(),
        snapshot_id: leftover.entry.id,
      },
    )
    .expect("read leftover snapshot");
    assert_eq!(snapshot.content, "# leftover body\n");
  }
}
