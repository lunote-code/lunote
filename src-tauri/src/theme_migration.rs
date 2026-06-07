use std::fs;
use std::path::{Path, PathBuf};

use crate::luna_paths;

const LAYOUT_MARKER: &str = ".layout-v2";
const STYLE_LAYOUT_MARKER: &str = ".style-layout-v1";

fn is_css_file(name: &str) -> bool {
  name.to_lowercase().ends_with(".css")
}

fn is_json_file(name: &str) -> bool {
  name.to_lowercase().ends_with(".json")
}

fn copy_file_if_missing(src: &Path, dest: &Path) -> Result<bool, String> {
  if dest.is_file() {
    return Ok(false);
  }
  if let Some(parent) = dest.parent() {
    fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
  }
  fs::copy(src, dest).map_err(|e| format!("Failed to copy {}: {e}", src.display()))?;
  Ok(true)
}

fn merge_directory_files(src_dir: &Path, dest_dir: &Path) -> Result<(), String> {
  if !src_dir.is_dir() {
    return Ok(());
  }
  fs::create_dir_all(dest_dir).map_err(|e| format!("Failed to create directory: {e}"))?;
  for entry in fs::read_dir(src_dir).map_err(|e| format!("Failed to read {}: {e}", src_dir.display()))? {
    let entry = entry.map_err(|e| e.to_string())?;
    let file_type = entry.file_type().map_err(|e| e.to_string())?;
    if !file_type.is_file() {
      continue;
    }
    let name = entry.file_name();
    let name = name.to_string_lossy();
    let _ = copy_file_if_missing(&entry.path(), &dest_dir.join(name.as_ref()))?;
  }
  Ok(())
}

fn migrate_legacy_css_root(legacy_root: &Path, theme_root: &Path, style_dir: &Path) -> Result<(), String> {
  if !legacy_root.is_dir() {
    return Ok(());
  }

  fs::create_dir_all(style_dir).map_err(|e| format!("Failed to create style directory: {e}"))?;

  for entry in fs::read_dir(legacy_root).map_err(|e| format!("Failed to read {}: {e}", legacy_root.display()))? {
    let entry = entry.map_err(|e| e.to_string())?;
    let file_type = entry.file_type().map_err(|e| e.to_string())?;
    let name = entry.file_name();
    let name = name.to_string_lossy();

    if file_type.is_dir() {
      if name.eq_ignore_ascii_case("snippets") {
        merge_directory_files(&entry.path(), &theme_root.join("snippets"))?;
      } else if name.eq_ignore_ascii_case("export") {
        merge_directory_files(&entry.path(), &theme_root.join("export"))?;
      } else if name.eq_ignore_ascii_case("style") {
        merge_directory_files(&entry.path(), style_dir)?;
      }
      continue;
    }

    if file_type.is_file() && is_css_file(&name) {
      let _ = copy_file_if_missing(&entry.path(), &style_dir.join(name.as_ref()))?;
    }
  }

  Ok(())
}

fn migrate_root_css_to_style(theme_root: &Path, style_dir: &Path) -> Result<(), String> {
  if !theme_root.is_dir() {
    return Ok(());
  }
  fs::create_dir_all(style_dir).map_err(|e| format!("Failed to create style directory: {e}"))?;

  for entry in fs::read_dir(theme_root).map_err(|e| format!("Failed to read {}: {e}", theme_root.display()))? {
    let entry = entry.map_err(|e| e.to_string())?;
    let file_type = entry.file_type().map_err(|e| e.to_string())?;
    if !file_type.is_file() {
      continue;
    }
    let name = entry.file_name();
    let name = name.to_string_lossy();
    if name.starts_with('.') || !is_css_file(&name) {
      continue;
    }
    let _ = copy_file_if_missing(&entry.path(), &style_dir.join(name.as_ref()))?;
  }

  Ok(())
}

fn migrate_root_json_tokens(theme_root: &Path, tokens_dir: &Path) -> Result<(), String> {
  if !theme_root.is_dir() {
    return Ok(());
  }
  fs::create_dir_all(tokens_dir).map_err(|e| format!("Failed to create tokens directory: {e}"))?;

  for entry in fs::read_dir(theme_root).map_err(|e| format!("Failed to read {}: {e}", theme_root.display()))? {
    let entry = entry.map_err(|e| e.to_string())?;
    let file_type = entry.file_type().map_err(|e| e.to_string())?;
    if !file_type.is_file() {
      continue;
    }
    let name = entry.file_name();
    let name = name.to_string_lossy();
    if name.starts_with('.') || !is_json_file(&name) {
      continue;
    }
    let _ = copy_file_if_missing(&entry.path(), &tokens_dir.join(name.as_ref()))?;
  }

  Ok(())
}

fn rewrite_custom_theme_file_paths(theme_root: &Path, tokens_dir: &Path) -> Result<(), String> {
  let settings_path = luna_paths::user_settings_file()?;
  if !settings_path.is_file() {
    return Ok(());
  }

  let raw = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
  let mut doc: serde_json::Value =
    serde_json::from_str(&raw).map_err(|e| format!("Failed to parse user settings: {e}"))?;

  let Some(theme_path) = doc
    .pointer("/appearance/theme/customThemeFile")
    .and_then(|v| v.as_str())
    .filter(|s| !s.is_empty())
    .map(|s| s.to_string())
  else {
    return Ok(());
  };

  let path = PathBuf::from(&theme_path);
  if path.is_file() {
    return Ok(());
  }

  let file_name = path
    .file_name()
    .map(|name| name.to_string_lossy().to_string())
    .unwrap_or_default();
  if file_name.is_empty() || !is_json_file(&file_name) {
    return Ok(());
  }

  let candidates = [
    tokens_dir.join(&file_name),
    theme_root.join(&file_name),
    luna_paths::get_legacy_config_theme_path()?.join(&file_name),
  ];

  for candidate in candidates {
    if candidate.is_file() {
      if let Some(theme) = doc.pointer_mut("/appearance/theme") {
        if !theme.is_object() {
          *theme = serde_json::json!({});
        }
      } else if let Some(appearance) = doc.get_mut("appearance") {
        if !appearance.is_object() {
          *appearance = serde_json::json!({});
        }
        appearance["theme"] = serde_json::json!({});
      } else {
        doc["appearance"] = serde_json::json!({ "theme": {} });
      }
      doc["appearance"]["theme"]["customThemeFile"] =
        serde_json::Value::String(candidate.to_string_lossy().to_string());
      let next = serde_json::to_vec_pretty(&doc).map_err(|e| e.to_string())?;
      crate::core::atomic_io::atomic_write(&settings_path, &next).map_err(|e| e.to_string())?;
      break;
    }
  }

  Ok(())
}

fn write_theme_readme(theme_root: &Path) -> Result<(), String> {
  let readme = theme_root.join("README.md");
  if readme.is_file() {
    return Ok(());
  }
  let body = r#"# Lunote theme folder

Appearance files use subfolders under `~/.luna/theme/`:

| Path | Purpose |
|------|---------|
| `style/` | External CSS themes (editor UI) |
| `snippets/` | Stackable UI snippet CSS |
| `export/` | Export-only CSS (HTML/PDF/PNG) |
| `tokens/` | JSON color token themes |

On GitHub: copy from `docs/theme-example/` (or starters in `docs/theme/`).

Docs: `docs/theme/README.md` · external CSS: `docs/theme/external-css.md`
"#;
  fs::write(&readme, body).map_err(|e| format!("Failed to write theme README: {e}"))
}

/// One-time migration: `config/Theme` + loose `theme/*.json` → unified `.luna/theme/` layout.
pub fn migrate_theme_layout_if_needed() -> Result<(), String> {
  let theme_root = luna_paths::get_theme_path()?;
  let style_dir = luna_paths::get_theme_style_path()?;
  let snippets_dir = luna_paths::get_theme_snippets_path()?;
  let export_dir = luna_paths::get_theme_export_path()?;
  let tokens_dir = luna_paths::get_theme_tokens_path()?;
  let marker = theme_root.join(LAYOUT_MARKER);
  let style_marker = theme_root.join(STYLE_LAYOUT_MARKER);

  fs::create_dir_all(&theme_root).map_err(|e| e.to_string())?;
  fs::create_dir_all(&style_dir).map_err(|e| e.to_string())?;
  fs::create_dir_all(&snippets_dir).map_err(|e| e.to_string())?;
  fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;
  fs::create_dir_all(&tokens_dir).map_err(|e| e.to_string())?;

  if !marker.is_file() {
    let legacy_css = luna_paths::get_legacy_config_theme_path()?;
    migrate_legacy_css_root(&legacy_css, &theme_root, &style_dir)?;
    migrate_root_json_tokens(&theme_root, &tokens_dir)?;
    fs::write(&marker, "unified .luna/theme layout\n").map_err(|e| e.to_string())?;
  }

  if !style_marker.is_file() {
    migrate_root_css_to_style(&theme_root, &style_dir)?;
    fs::write(&style_marker, "external CSS under .luna/theme/style/\n").map_err(|e| e.to_string())?;
  }

  rewrite_custom_theme_file_paths(&theme_root, &tokens_dir)?;
  write_theme_readme(&theme_root)?;
  Ok(())
}
