use std::path::{Component, Path, PathBuf};

/// Reject `..` components in paths to prevent directory traversal.
pub fn ensure_no_parent_dir_components(path: &Path) -> Result<(), String> {
  if path
    .components()
    .any(|c| matches!(c, Component::ParentDir))
  {
    return Err("Path cannot contain ..".to_string());
  }
  Ok(())
}

pub fn ensure_absolute_path(path: &Path) -> Result<(), String> {
  if !path.is_absolute() {
    return Err("The path must be an absolute path".to_string());
  }
  Ok(())
}

/// Resolve the path into a form that can be used for prefix comparison; canonicalize if it exists, or resolve the most recent ancestor if it does not exist.
fn resolve_path_prefix(path: &Path) -> Result<PathBuf, String> {
  ensure_no_parent_dir_components(path)?;
  if path.as_os_str().is_empty() {
    return Err("Invalid path".to_string());
  }
  if path.exists() {
    return path
      .canonicalize()
      .map_err(|e| format!("Unable to resolve path: {e}"));
  }
  match path.parent() {
    None => Ok(path.to_path_buf()),
    Some(parent) if parent.as_os_str().is_empty() => Ok(path.to_path_buf()),
    Some(parent) => {
      let resolved_parent = resolve_path_prefix(parent)?;
      let file_name = path
        .file_name()
        .ok_or_else(|| "Invalid path".to_string())?;
      Ok(resolved_parent.join(file_name))
    }
  }
}

#[cfg(windows)]
fn path_component_eq(a: Component<'_>, b: Component<'_>) -> bool {
  a.as_os_str().to_string_lossy().to_lowercase()
    == b.as_os_str().to_string_lossy().to_lowercase()
}

#[cfg(not(windows))]
fn path_component_eq(a: Component<'_>, b: Component<'_>) -> bool {
  a == b
}

fn is_same_or_under(resolved: &Path, root: &Path) -> bool {
  let root_components: Vec<_> = root.components().collect();
  let resolved_components: Vec<_> = resolved.components().collect();
  if resolved_components.len() < root_components.len() {
    return false;
  }
  root_components
    .iter()
    .copied()
    .zip(resolved_components.iter().copied())
    .all(|(a, b)| path_component_eq(a, b))
}

/// After normalization, verify that `candidate` is located within `allowed_root` (including the root directory itself).
pub fn ensure_under_allowed_root(candidate: &Path, allowed_root: &Path) -> Result<PathBuf, String> {
  ensure_no_parent_dir_components(candidate)?;
  ensure_no_parent_dir_components(allowed_root)?;
  let resolved_root = resolve_path_prefix(allowed_root)?;
  let resolved_candidate = resolve_path_prefix(candidate)?;
  if !is_same_or_under(&resolved_candidate, &resolved_root) {
    return Err("The target path is not within the allowed directory".to_string());
  }
  Ok(resolved_candidate)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn allows_exact_root_match() {
    let dir = std::env::temp_dir().join("lunote-path-root");
    let _ = std::fs::create_dir_all(&dir);
    let resolved = ensure_under_allowed_root(&dir, &dir).expect("same path should pass");
    assert_eq!(resolved, dir.canonicalize().expect("canonical root"));
  }

  #[cfg(windows)]
  #[test]
  fn windows_prefix_compare_ignores_case_for_missing_paths() {
    let root = PathBuf::from(r"C:\Users\Lunote\Vault");
    let candidate = PathBuf::from(r"c:\users\lunote\vault\Daily\Note.md");
    let resolved = ensure_under_allowed_root(&candidate, &root).expect("windows path case-insensitive");
    assert_eq!(resolved, candidate);
  }
}
