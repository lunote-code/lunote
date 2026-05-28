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
  let p = PathBuf::from(path);
  ensure_no_parent_dir_components(&p)?;
  let resolved = ensure_under_allowed_root(&p, &root_path)?;
  if !resolved.is_file() {
    return Err("Only files can be deleted".to_string());
  }
  std::fs::remove_file(&resolved).map_err(|e| format!("Delete failed: {e}"))
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

pub fn move_note_file(payload: &MoveNotePayload) -> Result<String, String> {
  let root_path = PathBuf::from(&payload.root);
  let old = PathBuf::from(&payload.old_path);
  ensure_no_parent_dir_components(&old)?;
  let resolved_old = ensure_under_allowed_root(&old, &root_path)?;
  if !resolved_old.is_file() {
    return Err("Source file does not exist".to_string());
  }
  if !is_markdown_file(&resolved_old) {
    return Err("Only Markdown files can be moved".to_string());
  }
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
    return Err("A file with the same name already exists in the target location".to_string());
  }
  std::fs::rename(&resolved_old, &new_path).map_err(|e| format!("Move failed: {e}"))?;
  Ok(new_path.to_string_lossy().to_string())
}

pub fn rename_note_file(payload: &RenameNotePayload) -> Result<String, String> {
  let root_path = PathBuf::from(&payload.root);
  let old = PathBuf::from(&payload.old_path);
  ensure_no_parent_dir_components(&old)?;
  let resolved_old = ensure_under_allowed_root(&old, &root_path)?;
  if !resolved_old.is_file() {
    return Err("Source file does not exist".to_string());
  }
  let name = payload.new_name.trim();
  if name.is_empty() {
    return Err("File name is empty".to_string());
  }
  if name.contains('/') || name.contains('\\') {
    return Err("File names cannot contain path separators".to_string());
  }
  let parent = resolved_old
    .parent()
    .ok_or_else(|| "Invalid path".to_string())?;
  let new_path = parent.join(name);
  ensure_under_allowed_root(&new_path, &root_path)?;
  if new_path.exists() {
    return Err("A file with the same name already exists".to_string());
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
  pub stem: String,
}

pub fn create_note(payload: &CreateNotePayload) -> Result<String, String> {
  let root_path = PathBuf::from(&payload.root);
  if !root_path.is_dir() {
    return Err("Invalid working directory".to_string());
  }
  let stem = sanitize_note_stem(&payload.stem)?;
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
  let heading = note_heading_from_stem(&stem);
  let content = format!("# {heading}\n\n");
  atomic_io::atomic_write(&path, content.as_bytes()).map_err(|e| format!("Creation failed: {e}"))?;
  Ok(path.to_string_lossy().to_string())
}

pub fn create_new_note(root: &str) -> Result<String, String> {
  create_note(&CreateNotePayload {
    root: root.to_string(),
    parent_path: None,
    stem: "new note".to_string(),
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
    stem: "new note".to_string(),
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
    let dir = resolved.parent().ok_or_else(|| "Invalid path".to_string())?;
    std::process::Command::new("xdg-open")
      .arg(dir)
      .spawn()
      .map_err(|e| format!("Failed to open directory: {e}"))?;
  }
  Ok(())
}
