use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use base64::Engine;

use super::atomic_io;
use super::path_safety::{ensure_no_parent_dir_components, ensure_under_allowed_root};
use super::security;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsTreeNode {
  pub name: String,
  pub path: String,
  pub kind: String,
  pub modified_at_ms: Option<i64>,
  pub created_at_ms: Option<i64>,
  pub children: Vec<FsTreeNode>,
}

fn file_time_ms(meta: &std::fs::Metadata) -> (Option<i64>, Option<i64>) {
  let modified = meta
    .modified()
    .ok()
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .and_then(|d| i64::try_from(d.as_millis()).ok());
  let created = meta
    .created()
    .ok()
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .and_then(|d| i64::try_from(d.as_millis()).ok());
  (modified, created)
}

fn should_skip_dir_entry(name: &str) -> bool {
  name.starts_with('.') || matches!(name, "node_modules" | "target" | "dist" | "build")
}

fn is_markdown_file(path: &Path) -> bool {
  path
    .extension()
    .and_then(|e| e.to_str())
    .map(|e| {
      let l = e.to_lowercase();
      l == "md" || l == "markdown"
    })
    .unwrap_or(false)
}

fn build_tree_nodes(dir: &Path) -> Result<Vec<FsTreeNode>, String> {
  let mut entries: Vec<_> = std::fs::read_dir(dir)
    .map_err(|e| format!("Failed to read directory: {e}"))?
    .filter_map(Result::ok)
    .collect();

  entries.retain(|e| {
    let name = e.file_name();
    let name = name.to_string_lossy();
    !should_skip_dir_entry(name.as_ref())
  });

  entries.sort_by(|a, b| {
    let ta = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
    let tb = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
    match (ta, tb) {
      (true, false) => std::cmp::Ordering::Less,
      (false, true) => std::cmp::Ordering::Greater,
      _ => a
        .file_name()
        .to_string_lossy()
        .to_lowercase()
        .cmp(&b.file_name().to_string_lossy().to_lowercase()),
    }
  });

  let mut nodes = Vec::new();
  for entry in entries {
    let path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    let ft = entry.file_type().map_err(|e| format!("Failed to read type: {e}"))?;
    let meta = entry.metadata().ok();
    let (modified_at_ms, created_at_ms) = meta
      .as_ref()
      .map(file_time_ms)
      .unwrap_or((None, None));
    if ft.is_dir() {
      let children = build_tree_nodes(&path)?;
      nodes.push(FsTreeNode {
        name,
        path: path.to_string_lossy().to_string(),
        kind: "dir".to_string(),
        modified_at_ms,
        created_at_ms,
        children,
      });
    } else if is_markdown_file(&path) {
      nodes.push(FsTreeNode {
        name,
        path: path.to_string_lossy().to_string(),
        kind: "file".to_string(),
        modified_at_ms,
        created_at_ms,
        children: Vec::new(),
      });
    }
  }

  Ok(nodes)
}

pub fn collect_workspace_tree(root: &str) -> Result<Vec<FsTreeNode>, String> {
  let root_path = security::ensure_listable_workspace_root(root)?;
  build_tree_nodes(&root_path)
}

fn ensure_under_root(root: &Path, candidate: &Path) -> Result<(), String> {
  ensure_under_allowed_root(candidate, root).map(|_| ())
}

pub fn collect_markdown_files(root: &str) -> Result<Vec<String>, String> {
  let root_path = security::ensure_listable_workspace_root(root)?;

  let mut files = Vec::new();
  for entry in WalkDir::new(&root_path).into_iter().filter_map(Result::ok) {
    let p = entry.path();
    if !p.is_file() {
      continue;
    }
    if let Some(ext) = p.extension().and_then(|it| it.to_str()) {
      let ext_l = ext.to_lowercase();
      if ext_l == "md" || ext_l == "markdown" {
        let resolved = ensure_under_allowed_root(p, &root_path)?;
        files.push(resolved.to_string_lossy().to_string());
      }
    }
  }
  files.sort();
  Ok(files)
}

pub fn read_file(root: &str, path: &str) -> Result<String, String> {
  let root_path = PathBuf::from(root);
  let note_path = PathBuf::from(path);
  ensure_no_parent_dir_components(&note_path)?;
  let resolved = ensure_under_allowed_root(&note_path, &root_path)?;
  let meta = std::fs::metadata(&resolved).map_err(|e| format!("Failed to read file information: {e}"))?;
  security::ensure_note_file_size(meta.len(), "note")?;
  std::fs::read_to_string(resolved).map_err(|e| format!("Failed to read file: {e}"))
}

pub fn read_file_base64(root: &str, path: &str) -> Result<String, String> {
  let root_path = PathBuf::from(root);
  let p = PathBuf::from(path);
  ensure_no_parent_dir_components(&p)?;
  let resolved = ensure_under_allowed_root(&p, &root_path)?;
  let bytes = std::fs::read(&resolved).map_err(|e| format!("Failed to read file: {e}"))?;
  security::ensure_binary_payload_size(&bytes, "document")?;
  Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteFileStat {
  pub modified_secs: u64,
  pub size: u64,
}

pub fn note_file_stat(root: &str, path: &str) -> Result<NoteFileStat, String> {
  let root_path = PathBuf::from(root);
  let note_path = PathBuf::from(path);
  ensure_no_parent_dir_components(&note_path)?;
  let resolved = ensure_under_allowed_root(&note_path, &root_path)?;
  let meta = std::fs::metadata(&resolved).map_err(|e| format!("Failed to read file information: {e}"))?;
  let modified_secs = meta
    .modified()
    .ok()
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|d| d.as_secs())
    .unwrap_or(0);
  Ok(NoteFileStat {
    modified_secs,
    size: meta.len(),
  })
}

pub fn save_file(
  root: &str,
  path: &str,
  content: &str,
  expected_modified_secs: Option<u64>,
) -> Result<(), String> {
  let root_path = PathBuf::from(root);
  let note_path = PathBuf::from(path);
  let resolved = ensure_under_allowed_root(&note_path, &root_path)?;
  if let Some(expected) = expected_modified_secs {
    let on_disk = if resolved.is_file() {
      let meta = std::fs::metadata(&resolved).map_err(|e| format!("Failed to read file information: {e}"))?;
      meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
    } else {
      0
    };
    if on_disk != expected {
      return Err(format!(
        "FILE_CONFLICT: The file on disk has been modified (expected mtime={expected}, actual={on_disk})"
      ));
    }
  }
  if let Some(parent) = resolved.parent() {
    std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
  }
  security::ensure_note_payload_size(content.as_bytes(), "note")?;
  atomic_io::atomic_write(&resolved, content.as_bytes()).map_err(|e| format!("Failed to save file: {e}"))
}

/// `relative_path` is relative to the parent directory of the note (e.g. `note.assets/paste-1.png`).
pub fn save_note_asset_file(
  root: &str,
  note_path: &str,
  relative_path: &str,
  data_base64: &str,
) -> Result<(), String> {
  let root_path = PathBuf::from(root);
  let note_path_buf = PathBuf::from(note_path);
  ensure_no_parent_dir_components(&note_path_buf)?;
  ensure_under_root(&root_path, &note_path_buf)?;
  let parent = note_path_buf
    .parent()
    .ok_or_else(|| "Invalid note path".to_string())?;
  let rel = Path::new(relative_path);
  if rel.is_absolute() {
    return Err("Resource paths must be relative paths".to_string());
  }
  for comp in rel.components() {
    if matches!(comp, std::path::Component::ParentDir) {
      return Err("Illegal resource path".to_string());
    }
  }
  let target = parent.join(rel);
  let resolved_target = ensure_under_allowed_root(&target, &root_path)?;
  if let Some(p) = resolved_target.parent() {
    std::fs::create_dir_all(p).map_err(|e| format!("Failed to create resource directory: {e}"))?;
  }
  security::ensure_base64_payload_within_limit(data_base64, "picture")?;
  let trimmed = data_base64.trim().replace('\n', "");
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(trimmed.as_bytes())
    .map_err(|e| format!("Image data decoding failed: {e}"))?;
  security::ensure_binary_payload_size(&bytes, "picture")?;
  atomic_io::atomic_write(&resolved_target, &bytes).map_err(|e| format!("Failed to write image: {e}"))
}

/// Determine whether the relative resource path in the same directory of the note exists (consistent with the `save_note_asset_file` parsing rules).
pub fn note_asset_exists(root: &str, note_path: &str, relative_path: &str) -> Result<bool, String> {
  let root_path = PathBuf::from(root);
  let note_path_buf = PathBuf::from(note_path);
  ensure_under_root(&root_path, &note_path_buf)?;
  let parent = note_path_buf
    .parent()
    .ok_or_else(|| "Invalid note path".to_string())?;
  let rel = Path::new(relative_path);
  if rel.is_absolute() {
    return Err("Resource paths must be relative paths".to_string());
  }
  for comp in rel.components() {
    if matches!(comp, std::path::Component::ParentDir) {
      return Err("Illegal resource path".to_string());
    }
  }
  let root_canon = root_path
    .canonicalize()
    .map_err(|e| format!("Unable to resolve root directory: {e}"))?;
  let parent_canon = parent
    .canonicalize()
    .map_err(|e| format!("Unable to parse note directory: {e}"))?;
  let full = parent_canon.join(rel);
  let full_resolved = ensure_under_allowed_root(&full, &root_canon)?;
  Ok(full_resolved.exists())
}

pub fn delete_note_file(root: &str, path: &str) -> Result<(), String> {
  let root_path = PathBuf::from(root);
  let root_canon = root_path
    .canonicalize()
    .map_err(|e| format!("Unable to resolve root directory: {e}"))?;
  let p = PathBuf::from(path);
  ensure_no_parent_dir_components(&p)?;
  let resolved = ensure_under_allowed_root(&p, &root_path)?;
  let resolved_canon = resolved
    .canonicalize()
    .map_err(|e| format!("Unable to resolve path: {e}"))?;
  if resolved_canon == root_canon {
    return Err("Cannot delete workspace root".to_string());
  }
  if resolved.is_dir() {
    std::fs::remove_dir_all(&resolved).map_err(|e| format!("Delete failed: {e}"))
  } else if resolved.is_file() {
    std::fs::remove_file(&resolved).map_err(|e| format!("Delete failed: {e}"))
  } else {
    Err("Path does not exist".to_string())
  }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameNotePayload {
  pub root: String,
  pub old_path: String,
  pub new_name: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNotePayload {
  pub root: String,
  pub old_path: String,
  pub dest_dir: String,
}

fn is_strict_subpath(parent: &Path, child: &Path) -> bool {
  if parent == child {
    return false;
  }
  let parent_canon = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
  let child_canon = child.canonicalize().unwrap_or_else(|_| child.to_path_buf());
  if child_canon == parent_canon {
    return false;
  }
  child_canon
    .strip_prefix(&parent_canon)
    .map(|rest| {
      let s = rest.to_string_lossy();
      s.starts_with('/') || s.starts_with('\\')
    })
    .unwrap_or(false)
}

pub fn move_note_file(payload: &MoveNotePayload) -> Result<String, String> {
  let root_path = PathBuf::from(&payload.root);
  let old = PathBuf::from(&payload.old_path);
  ensure_no_parent_dir_components(&old)?;
  let resolved_old = ensure_under_allowed_root(&old, &root_path)?;
  let dest = PathBuf::from(&payload.dest_dir);
  ensure_no_parent_dir_components(&dest)?;
  let resolved_dest = ensure_under_allowed_root(&dest, &root_path)?;
  if !resolved_dest.is_dir() {
    return Err("The target folder does not exist".to_string());
  }
  let parent = resolved_old
    .parent()
    .ok_or_else(|| "Invalid path".to_string())?;
  let parent_cmp = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
  let dest_cmp = resolved_dest.canonicalize().unwrap_or(resolved_dest.clone());
  if parent_cmp == dest_cmp {
    return Ok(resolved_old.to_string_lossy().to_string());
  }
  let file_name = resolved_old
    .file_name()
    .ok_or_else(|| "Invalid path".to_string())?;
  let new_path = resolved_dest.join(file_name);
  ensure_under_allowed_root(&new_path, &root_path)?;
  if new_path.exists() {
    return Err("A file or folder with the same name already exists in the target location".to_string());
  }

  if resolved_old.is_dir() {
    let root_canon = root_path
      .canonicalize()
      .unwrap_or_else(|_| root_path.clone());
    let old_canon = resolved_old
      .canonicalize()
      .unwrap_or(resolved_old.clone());
    if old_canon == root_canon {
      return Err("Cannot move the workspace root folder".to_string());
    }
    if is_strict_subpath(&old_canon, &dest_cmp) {
      return Err("Cannot move a folder into itself or its subfolder".to_string());
    }
    std::fs::rename(&resolved_old, &new_path).map_err(|e| format!("Move failed: {e}"))?;
    return Ok(new_path.to_string_lossy().to_string());
  }

  if !resolved_old.is_file() {
    return Err("Source does not exist".to_string());
  }
  if !is_markdown_file(&resolved_old) {
    return Err("Only Markdown files can be moved".to_string());
  }
  std::fs::rename(&resolved_old, &new_path).map_err(|e| format!("Move failed: {e}"))?;
  Ok(new_path.to_string_lossy().to_string())
}

pub fn rename_note_file(payload: &RenameNotePayload) -> Result<String, String> {
  let root_path = PathBuf::from(&payload.root);
  let old = PathBuf::from(&payload.old_path);
  ensure_no_parent_dir_components(&old)?;
  let resolved_old = ensure_under_allowed_root(&old, &root_path)?;
  let name = payload.new_name.trim();
  if name.is_empty() {
    return Err("Name is empty".to_string());
  }
  if name.contains('/') || name.contains('\\') {
    return Err("Names cannot contain path separators".to_string());
  }
  let parent = resolved_old
    .parent()
    .ok_or_else(|| "Invalid path".to_string())?;
  let new_path = parent.join(name);
  ensure_under_allowed_root(&new_path, &root_path)?;
  if new_path.exists() {
    return Err("A file or folder with the same name already exists".to_string());
  }

  if resolved_old.is_dir() {
    let root_canon = root_path
      .canonicalize()
      .unwrap_or_else(|_| root_path.clone());
    let old_canon = resolved_old
      .canonicalize()
      .unwrap_or(resolved_old.clone());
    if old_canon == root_canon {
      return Err("Cannot rename the workspace root folder".to_string());
    }
    std::fs::rename(&resolved_old, &new_path).map_err(|e| format!("Rename failed: {e}"))?;
    return Ok(new_path.to_string_lossy().to_string());
  }

  if !resolved_old.is_file() {
    return Err("Source does not exist".to_string());
  }
  std::fs::rename(&resolved_old, &new_path).map_err(|e| format!("Rename failed: {e}"))?;
  Ok(new_path.to_string_lossy().to_string())
}

fn sanitize_note_stem(raw: &str) -> Result<String, String> {
  let mut s = raw.trim();
  if s.is_empty() {
    return Err("File name is empty".to_string());
  }
  let lower = s.to_lowercase();
  if lower.ends_with(".markdown") {
    s = s[..s.len() - 9].trim();
  } else if lower.ends_with(".md") {
    s = s[..s.len() - 3].trim();
  }
  if s.is_empty() {
    return Err("File name is empty".to_string());
  }
  if s.contains('/') || s.contains('\\') || s == "." || s == ".." {
    return Err("Invalid file name".to_string());
  }
  Ok(s.to_string())
}

fn note_heading_from_stem(stem: &str) -> String {
  let t = stem.trim().replace(['\r', '\n'], " ");
  let t = t.trim_start_matches('#').trim();
  if t.is_empty() {
    "new note".to_string()
  } else {
    t.to_string()
  }
}

fn unique_note_path_in(parent: &Path, stem: &str) -> PathBuf {
  let mut path = parent.join(format!("{stem}.md"));
  let mut i = 2u32;
  while path.exists() {
    path = parent.join(format!("{stem}{i}.md"));
    i += 1;
  }
  path
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNotePayload {
  pub root: String,
  #[serde(default)]
  pub parent_path: Option<String>,
  #[serde(default)]
  pub stem: Option<String>,
  #[serde(default)]
  pub content: Option<String>,
  /// Vault-relative path such as `Daily/2026-05-28.md` (no auto-renaming).
  #[serde(default)]
  pub relative_path: Option<String>,
}

fn default_note_content(stem: &str) -> String {
  let title = note_heading_from_stem(stem);
  format!("---\ntitle: {title}\n---\n\n# {title}\n\n")
}

pub fn create_note(payload: &CreateNotePayload) -> Result<String, String> {
  let root_path = PathBuf::from(&payload.root);
  if !root_path.is_dir() {
    return Err("Invalid working directory".to_string());
  }

  if let Some(rel) = payload.relative_path.as_deref() {
    let rel = rel.trim().replace('\\', "/");
    if rel.is_empty() || rel.contains("..") {
      return Err("Invalid note path".to_string());
    }
    let path = root_path.join(&rel);
    ensure_under_root(&root_path, &path)?;
    if path.exists() {
      return Err("Note already exists".to_string());
    }
    if let Some(parent) = path.parent() {
      std::fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create parent folder: {e}"))?;
    }
    let stem = path
      .file_stem()
      .and_then(|s| s.to_str())
      .unwrap_or("note");
    let content = payload
      .content
      .clone()
      .unwrap_or_else(|| default_note_content(stem));
    crate::core::security::ensure_note_payload_size(content.as_bytes(), "Create note")?;
    atomic_io::atomic_write(&path, content.as_bytes())
      .map_err(|e| format!("Creation failed: {e}"))?;
    return Ok(path.to_string_lossy().to_string());
  }

  let stem_raw = payload
    .stem
    .as_deref()
    .ok_or_else(|| "File name is empty".to_string())?;
  let stem = sanitize_note_stem(stem_raw)?;
  let parent = match payload.parent_path.as_deref() {
    None | Some("") => root_path.clone(),
    Some(parent_path) => {
      let parent = PathBuf::from(parent_path);
      if !parent.is_dir() {
        return Err("The parent directory does not exist or is not a folder".to_string());
      }
      ensure_under_root(&root_path, &parent)?;
      parent
    }
  };
  let path = unique_note_path_in(&parent, &stem);
  ensure_under_allowed_root(&path, &root_path)?;
  let content = payload
    .content
    .clone()
    .unwrap_or_else(|| default_note_content(&stem));
  crate::core::security::ensure_note_payload_size(content.as_bytes(), "Create note")?;
  atomic_io::atomic_write(&path, content.as_bytes()).map_err(|e| format!("Creation failed: {e}"))?;
  Ok(path.to_string_lossy().to_string())
}

pub fn create_new_note(root: &str) -> Result<String, String> {
  create_note(&CreateNotePayload {
    root: root.to_string(),
    parent_path: None,
    stem: Some("new note".to_string()),
    content: None,
    relative_path: None,
  })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParentDirPayload {
  pub root: String,
  pub parent_path: String,
}

/// Create notes in an existing parent directory (automatically avoiding the same name).
pub fn create_new_note_in_parent(root: &str, parent_path: &str) -> Result<String, String> {
  create_note(&CreateNotePayload {
    root: root.to_string(),
    parent_path: Some(parent_path.to_string()),
    stem: Some("new note".to_string()),
    content: None,
    relative_path: None,
  })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderPayload {
  pub root: String,
  pub parent_path: String,
  pub name: String,
}

pub fn create_workspace_folder(payload: &CreateFolderPayload) -> Result<String, String> {
  let root_path = PathBuf::from(&payload.root);
  if !root_path.is_dir() {
    return Err("Invalid working directory".to_string());
  }
  let parent = PathBuf::from(&payload.parent_path);
  if !parent.is_dir() {
    return Err("The parent directory does not exist or is not a folder".to_string());
  }
  ensure_under_root(&root_path, &parent)?;
  let n = payload.name.trim();
  if n.is_empty() {
    return Err("Folder name is empty".to_string());
  }
  if n.contains('/') || n.contains('\\') || n == ".." || n == "." {
    return Err("Invalid folder name".to_string());
  }
  let new_dir = parent.join(n);
  if new_dir.exists() {
    return Err("A file or folder with the same name already exists".to_string());
  }
  std::fs::create_dir(&new_dir).map_err(|e| format!("Failed to create folder: {e}"))?;
  Ok(new_dir.to_string_lossy().to_string())
}

pub fn import_markdown_file(root: &str, source: &str) -> Result<String, String> {
  let root_path = PathBuf::from(root);
  if !root_path.is_dir() {
    return Err("Invalid working directory".to_string());
  }
  let src = security::ensure_user_picked_import_read(source)?;
  let ext = src
    .extension()
    .and_then(|e| e.to_str())
    .map(|e| e.to_lowercase())
    .filter(|e| e == "md" || e == "markdown")
    .ok_or_else(|| "Please select .md / .markdown file".to_string())?;
  let stem = src
    .file_stem()
    .and_then(|s| s.to_str())
    .unwrap_or("imported");
  let mut name = format!("{stem}.{ext}");
  let mut dest = root_path.join(&name);
  let mut n = 2u32;
  while dest.exists() {
    name = format!("{stem}-{n}.{ext}");
    dest = root_path.join(&name);
    n += 1;
  }
  std::fs::copy(&src, &dest).map_err(|e| format!("Import failed: {e}"))?;
  Ok(dest.to_string_lossy().to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportNotePayload {
  pub path: String,
  pub content: String,
  pub workspace_root: String,
}

pub fn export_note_to_path(payload: &ExportNotePayload) -> Result<(), String> {
  let resolved = security::ensure_export_allowed(&payload.path, &payload.workspace_root)?;
  if let Some(par) = resolved.parent() {
    std::fs::create_dir_all(par).map_err(|e| format!("Failed to create directory: {e}"))?;
  }
  atomic_io::atomic_write(&resolved, payload.content.as_bytes()).map_err(|e| format!("Export failed: {e}"))?;
  Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBinaryPayload {
  pub path: String,
  pub data_base64: String,
  pub workspace_root: String,
}

pub fn export_binary_to_path(payload: &ExportBinaryPayload) -> Result<(), String> {
  security::ensure_export_base64_payload_within_limit(&payload.data_base64, "Export data")?;
  let trimmed = payload.data_base64.trim().replace('\n', "");
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(trimmed.as_str())
    .map_err(|e| format!("Base64 decoding failed: {e}"))?;
  security::ensure_export_binary_payload_size(&bytes, "Export data")?;
  let resolved = security::ensure_export_allowed(&payload.path, &payload.workspace_root)?;
  if let Some(par) = resolved.parent() {
    std::fs::create_dir_all(par).map_err(|e| format!("Failed to create directory: {e}"))?;
  }
  atomic_io::atomic_write(&resolved, &bytes).map_err(|e| format!("Export failed: {e}"))?;
  Ok(())
}

const MAX_EXTERNAL_IMPORT_ENTRIES: usize = 200;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportExternalPathsPayload {
  pub root: String,
  pub dest_dir: String,
  pub sources: Vec<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportExternalPathsResult {
  pub imported_paths: Vec<String>,
  pub file_count: u32,
  pub folder_count: u32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDroppedFileBytesPayload {
  pub root: String,
  pub dest_dir: String,
  pub file_name: String,
  pub data_base64: String,
}

pub fn workspace_path_is_directory(root: &str, path: &str) -> Result<bool, String> {
  let root_path = security::ensure_listable_workspace_root(root)?;
  let note_path = PathBuf::from(path);
  ensure_no_parent_dir_components(&note_path)?;
  let resolved = ensure_under_allowed_root(&note_path, &root_path)?;
  Ok(resolved.is_dir())
}

pub fn import_dropped_file_bytes(payload: &ImportDroppedFileBytesPayload) -> Result<String, String> {
  let root_path = security::ensure_listable_workspace_root(&payload.root)?;
  let dest_path = PathBuf::from(payload.dest_dir.trim());
  ensure_no_parent_dir_components(&dest_path)?;
  let resolved_dest = ensure_under_allowed_root(&dest_path, &root_path)?;
  if !resolved_dest.is_dir() {
    return Err("The target folder does not exist".to_string());
  }
  let name = payload.file_name.trim();
  if name.is_empty() || name.contains('/') || name.contains('\\') || name == ".." || name == "." {
    return Err("Invalid file name".to_string());
  }
  security::ensure_base64_payload_within_limit(&payload.data_base64, "Import file")?;
  let trimmed = payload.data_base64.trim().replace('\n', "");
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(trimmed.as_str())
    .map_err(|e| format!("Base64 decoding failed: {e}"))?;
  security::ensure_binary_payload_size(&bytes, "Import file")?;
  let src_name = std::ffi::OsStr::new(name);
  let dest = unique_import_dest(&resolved_dest, src_name);
  ensure_under_root(&root_path, &dest)?;
  if let Some(par) = dest.parent() {
    std::fs::create_dir_all(par).map_err(|e| format!("Failed to create directory: {e}"))?;
  }
  atomic_io::atomic_write(&dest, &bytes).map_err(|e| format!("Import failed: {e}"))?;
  Ok(dest.to_string_lossy().to_string())
}

fn unique_import_dest(parent: &Path, file_name: &std::ffi::OsStr) -> PathBuf {
  let mut candidate = parent.join(file_name);
  if !candidate.exists() {
    return candidate;
  }
  let name = file_name.to_string_lossy();
  let path = Path::new(name.as_ref());
  let stem = path
    .file_stem()
    .and_then(|s| s.to_str())
    .unwrap_or("imported");
  let ext = path
    .extension()
    .and_then(|e| e.to_str())
    .map(|e| format!(".{e}"))
    .unwrap_or_default();
  for n in 2..=999u32 {
    candidate = parent.join(format!("{stem}-{n}{ext}"));
    if !candidate.exists() {
      return candidate;
    }
  }
  parent.join(format!("{stem}-999{ext}"))
}

fn copy_import_file(src: &Path, dest_parent: &Path, root: &Path) -> Result<PathBuf, String> {
  let file_name = src
    .file_name()
    .ok_or_else(|| "Invalid file name".to_string())?;
  let dest = unique_import_dest(dest_parent, file_name);
  ensure_under_root(root, &dest)?;
  let meta = std::fs::metadata(src).map_err(|e| format!("Failed to read file information: {e}"))?;
  security::ensure_note_file_size(meta.len(), "Import file")?;
  std::fs::copy(src, &dest).map_err(|e| format!("Copy failed: {e}"))?;
  Ok(dest)
}

fn should_skip_import_dir_name(name: &str) -> bool {
  should_skip_dir_entry(name) || name.ends_with(".assets")
}

fn copy_import_dir_recursive(
  src: &Path,
  dest_parent: &Path,
  root: &Path,
  imported: &mut Vec<String>,
  file_count: &mut u32,
  folder_count: &mut u32,
  entry_budget: &mut usize,
) -> Result<PathBuf, String> {
  let folder_name = src
    .file_name()
    .ok_or_else(|| "Invalid folder name".to_string())?;
  let dest_root = unique_import_dest(dest_parent, folder_name);
  ensure_under_root(root, &dest_root)?;
  std::fs::create_dir_all(&dest_root).map_err(|e| format!("Failed to create folder: {e}"))?;
  *folder_count += 1;
  imported.push(dest_root.to_string_lossy().to_string());
  *entry_budget = entry_budget.saturating_sub(1);
  if *entry_budget == 0 {
    return Err("Import exceeds maximum file count".to_string());
  }

  for entry in WalkDir::new(src)
    .min_depth(1)
    .into_iter()
    .filter_entry(|e| !should_skip_import_dir_name(&e.file_name().to_string_lossy()))
    .filter_map(Result::ok)
  {
    if *entry_budget == 0 {
      return Err("Import exceeds maximum file count".to_string());
    }
    let rel = entry
      .path()
      .strip_prefix(src)
      .map_err(|_| "Invalid import path".to_string())?;
    let target = dest_root.join(rel);
    ensure_under_root(root, &target)?;
    if entry.file_type().is_dir() {
      let name = entry.file_name().to_string_lossy();
      if should_skip_import_dir_name(&name) {
        continue;
      }
      std::fs::create_dir_all(&target).map_err(|e| format!("Failed to create folder: {e}"))?;
      continue;
    }
    if !entry.file_type().is_file() {
      continue;
    }
    let meta = entry
      .metadata()
      .map_err(|e| format!("Failed to read file information: {e}"))?;
    security::ensure_note_file_size(meta.len(), "Import file")?;
    if let Some(par) = target.parent() {
      std::fs::create_dir_all(par).map_err(|e| format!("Failed to create folder: {e}"))?;
    }
    std::fs::copy(entry.path(), &target).map_err(|e| format!("Copy failed: {e}"))?;
    imported.push(target.to_string_lossy().to_string());
    *file_count += 1;
    *entry_budget = entry_budget.saturating_sub(1);
  }
  Ok(dest_root)
}

pub fn import_external_paths_into_workspace(
  payload: &ImportExternalPathsPayload,
) -> Result<ImportExternalPathsResult, String> {
  let root_path = security::ensure_listable_workspace_root(&payload.root)?;
  let dest_path = PathBuf::from(payload.dest_dir.trim());
  ensure_no_parent_dir_components(&dest_path)?;
  let resolved_dest = ensure_under_allowed_root(&dest_path, &root_path)?;
  if !resolved_dest.is_dir() {
    return Err("The target folder does not exist".to_string());
  }
  let dest_name = resolved_dest
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("");
  if dest_name.ends_with(".assets") {
    return Err("Cannot import into attachment folders".to_string());
  }

  let dest_canon = resolved_dest
    .canonicalize()
    .unwrap_or(resolved_dest.clone());

  let mut imported_paths = Vec::new();
  let mut file_count = 0u32;
  let mut folder_count = 0u32;
  let mut entry_budget = MAX_EXTERNAL_IMPORT_ENTRIES;

  for source in &payload.sources {
    if entry_budget == 0 {
      return Err("Import exceeds maximum file count".to_string());
    }
    let resolved_src = security::ensure_external_drop_source(source)?;
    if ensure_under_allowed_root(&resolved_src, &root_path).is_ok() {
      return Err("Use workspace move for files already in this vault".to_string());
    }
    let src_canon = resolved_src
      .canonicalize()
      .unwrap_or(resolved_src.clone());
    if is_strict_subpath(&src_canon, &dest_canon) {
      return Err("Cannot import a folder into itself or its subfolder".to_string());
    }

    if resolved_src.is_file() {
      let dest = copy_import_file(&resolved_src, &resolved_dest, &root_path)?;
      imported_paths.push(dest.to_string_lossy().to_string());
      file_count += 1;
      entry_budget = entry_budget.saturating_sub(1);
    } else if resolved_src.is_dir() {
      copy_import_dir_recursive(
        &resolved_src,
        &resolved_dest,
        &root_path,
        &mut imported_paths,
        &mut file_count,
        &mut folder_count,
        &mut entry_budget,
      )?;
    }
  }

  Ok(ImportExternalPathsResult {
    imported_paths,
    file_count,
    folder_count,
  })
}

/// Display the file (or directory) in the system file manager.
pub fn reveal_path_in_explorer(path: &str, workspace_root: &str) -> Result<(), String> {
  let resolved = security::ensure_reveal_allowed(path, workspace_root)?;
  if !resolved.exists() {
    return Err("path does not exist".to_string());
  }
  #[cfg(target_os = "macos")]
  {
    let path_str = resolved.to_string_lossy().to_string();
    std::process::Command::new("open")
      .arg("-R")
      .arg(&path_str)
      .status()
      .map_err(|e| format!("Failed to open Finder: {e}"))?;
  }
  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("explorer")
      .arg(format!("/select,{}", resolved.display()))
      .spawn()
      .map_err(|e| format!("Failed to open explorer: {e}"))?;
  }
  #[cfg(all(unix, not(target_os = "macos")))]
  {
    super::shell_reveal::reveal_path_in_file_manager(&resolved)?;
  }
  Ok(())
}
