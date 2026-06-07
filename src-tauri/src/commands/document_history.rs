use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

use uuid::Uuid;

use crate::{
  core::{files, security},
  luna_paths,
};

use super::{resolve_workspace_root, safe_workspace_id, NotePayload};

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
  payload: CreateDocumentSnapshotPayload,
) -> Result<DocumentHistoryEntry, String> {
  let root = resolve_workspace_root(&payload.root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let _ = files::read_file(&root, &payload.path)?;
  let created_at = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_millis() as i64;
  let snapshot_id = format!("snap-{created_at}-{}", Uuid::new_v4());
  let entry = DocumentHistoryEntry {
    id: snapshot_id.clone(),
    workspace_id: workspace_id.clone(),
    path: payload.path,
    created_at,
    source: payload.source.unwrap_or_else(|| "manual".to_string()),
    title: payload.title,
    excerpt: build_snapshot_excerpt(&payload.content),
    content_hash: hash_document_content(&payload.content),
    size: payload.content.len(),
  };
  let snapshot = DocumentHistorySnapshot {
    entry: entry.clone(),
    content: payload.content,
  };
  let mut index = read_document_history_index(&workspace_id)?;
  index.entries.retain(|item| item.id != entry.id);
  index.entries.push(entry.clone());
  index.entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
  let pruned_entries = prune_document_history_entries_for_path(&mut index, &entry.path);
  write_document_history_snapshot(&workspace_id, &snapshot)?;
  for stale_entry in pruned_entries {
    let stale_path = document_history_snapshot_file(&workspace_id, &stale_entry.id)?;
    if stale_path.is_file() {
      std::fs::remove_file(&stale_path).map_err(|e| e.to_string())?;
    }
  }
  write_document_history_index(&workspace_id, &index)?;
  Ok(entry)
}

#[tauri::command]
pub fn list_document_snapshots(payload: NotePayload) -> Result<Vec<DocumentHistoryEntry>, String> {
  let root = resolve_workspace_root(&payload.root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let index = read_document_history_index(&workspace_id)?;
  let mut entries = index
    .entries
    .into_iter()
    .filter(|entry| entry.path == payload.path)
    .collect::<Vec<_>>();
  entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
  Ok(entries)
}

#[tauri::command]
pub fn read_document_snapshot(
  payload: ReadDocumentSnapshotPayload,
) -> Result<DocumentHistorySnapshot, String> {
  let root = resolve_workspace_root(&payload.root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let snapshot = read_document_history_snapshot(&workspace_id, &payload.snapshot_id)?;
  validate_document_history_snapshot(snapshot, &workspace_id, &payload.path)
}

#[tauri::command]
pub fn delete_document_snapshot(payload: ReadDocumentSnapshotPayload) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let snapshot = read_document_history_snapshot(&workspace_id, &payload.snapshot_id)?;
  let snapshot = validate_document_history_snapshot(snapshot, &workspace_id, &payload.path)?;
  let path = document_history_snapshot_file(&workspace_id, &payload.snapshot_id)?;
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
  }
  let mut index = read_document_history_index(&workspace_id)?;
  index
    .entries
    .retain(|entry| !(entry.id == snapshot.entry.id && entry.path == snapshot.entry.path));
  write_document_history_index(&workspace_id, &index)
}

#[tauri::command]
pub fn delete_all_document_snapshots(payload: NotePayload) -> Result<usize, String> {
  let root = resolve_workspace_root(&payload.root)?;
  let workspace_id = safe_workspace_id(&root)?;
  let mut index = read_document_history_index(&workspace_id)?;
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
  write_document_history_index(&workspace_id, &index)?;
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

fn read_document_history_index(workspace_id: &str) -> Result<DocumentHistoryIndex, String> {
  luna_paths::ensure_luna_dirs()?;
  let path = document_history_index_file(workspace_id)?;
  if !path.is_file() {
    return Ok(DocumentHistoryIndex::default());
  }
  let data = std::fs::read(&path).map_err(|e| e.to_string())?;
  serde_json::from_slice(&data).map_err(|e| e.to_string())
}

fn write_document_history_index(workspace_id: &str, index: &DocumentHistoryIndex) -> Result<(), String> {
  let path = document_history_index_file(workspace_id)?;
  let data = serde_json::to_vec_pretty(index).map_err(|e| e.to_string())?;
  security::ensure_json_payload_size(&data, "Document history index")?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())
}

fn read_document_history_snapshot(
  workspace_id: &str,
  snapshot_id: &str,
) -> Result<DocumentHistorySnapshot, String> {
  let path = document_history_snapshot_file(workspace_id, snapshot_id)?;
  let data = std::fs::read(&path).map_err(|e| e.to_string())?;
  serde_json::from_slice(&data).map_err(|e| e.to_string())
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
) -> Result<(), String> {
  let path = document_history_snapshot_file(workspace_id, &snapshot.entry.id)?;
  let data = serde_json::to_vec_pretty(snapshot).map_err(|e| e.to_string())?;
  security::ensure_json_payload_size(&data, "Document history snapshot")?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())
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

fn build_snapshot_excerpt(content: &str) -> Option<String> {
  const MAX_EXCERPT_CHARS: usize = 120;

  let first_line = content
    .lines()
    .map(str::trim)
    .find(|line| !line.is_empty())?;

  let excerpt: String = first_line.chars().take(MAX_EXCERPT_CHARS).collect();
  if excerpt.is_empty() {
    None
  } else {
    Some(excerpt)
  }
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

  #[test]
  fn read_document_snapshot_rejects_mismatched_path() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    let beta = workspace.join("beta.md");
    write_note(&alpha, "# alpha\n");
    write_note(&beta, "# beta\n");

    let entry = create_document_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    })
    .expect("create alpha snapshot");

    let err = match read_document_snapshot(ReadDocumentSnapshotPayload {
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

    let entry = create_document_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    })
    .expect("create alpha snapshot");

    let err = delete_document_snapshot(ReadDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: beta.to_string_lossy().to_string(),
      snapshot_id: entry.id.clone(),
    })
    .expect_err("delete should reject mismatched path");
    assert!(err.contains("path mismatch"));

    let entries = list_document_snapshots(NotePayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
    })
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

    create_document_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot one\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    })
    .expect("create alpha snapshot one");
    create_document_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot two\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    })
    .expect("create alpha snapshot two");
    create_document_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: beta.to_string_lossy().to_string(),
      content: "# beta snapshot\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    })
    .expect("create beta snapshot");

    let removed = delete_all_document_snapshots(NotePayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
    })
    .expect("delete alpha snapshots");
    assert_eq!(removed, 2);

    let alpha_entries = list_document_snapshots(NotePayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
    })
    .expect("list alpha snapshots");
    assert!(alpha_entries.is_empty());

    let beta_entries = list_document_snapshots(NotePayload {
      root: workspace.to_string_lossy().to_string(),
      path: beta.to_string_lossy().to_string(),
    })
    .expect("list beta snapshots");
    assert_eq!(beta_entries.len(), 1);
  }

  #[test]
  fn create_document_snapshot_generates_unique_ids() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    write_note(&alpha, "# alpha\n");

    let first = create_document_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot one\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    })
    .expect("create first snapshot");
    let second = create_document_snapshot(CreateDocumentSnapshotPayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
      content: "# alpha snapshot two\n".to_string(),
      title: None,
      source: Some("manual".to_string()),
    })
    .expect("create second snapshot");

    assert_ne!(first.id, second.id);

    let entries = list_document_snapshots(NotePayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
    })
    .expect("list alpha snapshots");
    assert_eq!(entries.len(), 2);
  }

  #[test]
  fn create_document_snapshot_prunes_old_entries_per_path() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let alpha = workspace.join("alpha.md");
    write_note(&alpha, "# alpha\n");

    for idx in 0..(MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH + 5) {
      create_document_snapshot(CreateDocumentSnapshotPayload {
        root: workspace.to_string_lossy().to_string(),
        path: alpha.to_string_lossy().to_string(),
        content: format!("# alpha snapshot {idx}\n"),
        title: None,
        source: Some("manual".to_string()),
      })
      .expect("create snapshot");
    }

    let entries = list_document_snapshots(NotePayload {
      root: workspace.to_string_lossy().to_string(),
      path: alpha.to_string_lossy().to_string(),
    })
    .expect("list alpha snapshots");
    assert_eq!(entries.len(), MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH);

    let workspace_id = safe_workspace_id(&workspace.to_string_lossy()).expect("workspace id");
    let snapshot_dir = workspace_history_snapshots_dir(&workspace_id).expect("history snapshots dir");
    let snapshot_count = std::fs::read_dir(snapshot_dir)
      .expect("read history snapshots dir")
      .count();
    assert_eq!(snapshot_count, MAX_DOCUMENT_HISTORY_SNAPSHOTS_PER_PATH);
  }
}
