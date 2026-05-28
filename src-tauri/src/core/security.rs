use std::path::{Path, PathBuf};

use crate::{app_settings, luna_paths};

use super::path_safety;

const MAX_JSON_BYTES: usize = 10 * 1024 * 1024;
const MAX_IMPORT_BYTES: usize = 20 * 1024 * 1024;
pub const MAX_NOTE_BYTES: usize = MAX_IMPORT_BYTES;
const MAX_EXPORT_BYTES: usize = 150 * 1024 * 1024;
pub const MAX_CLIPBOARD_IMAGE_BYTES: usize = MAX_IMPORT_BYTES;
/** Self-contained HTML passed to headless Chrome for PDF export */
pub const MAX_PDF_HTML_BYTES: usize = 50 * 1024 * 1024;
pub const MAX_CLIPBOARD_IMAGE_DIMENSION: u32 = 8192;
pub const MAX_CLIPBOARD_IMAGE_PIXELS: u64 = 16_777_216; // 4096×4096
const MAX_SEARCH_QUERY_LEN: usize = 256;
const MAX_LOG_LINE_LEN: usize = 16 * 1024;

fn home_dir() -> Result<PathBuf, String> {
  luna_paths::get_luna_root()?
    .parent()
    .map(Path::to_path_buf)
    .ok_or_else(|| "Unable to resolve user home directory".to_string())
}

fn luna_root() -> Result<PathBuf, String> {
  luna_paths::get_luna_root()
}

fn theme_root() -> Result<PathBuf, String> {
  Ok(luna_paths::get_config_path()?.join("Theme"))
}

/// Sensitive relative path prefix that prohibits reading and writing in the user's home directory
fn is_sensitive_under_home(resolved: &Path, home: &Path) -> bool {
  let Ok(rel) = resolved.strip_prefix(home) else {
    return false;
  };
  let rel = rel.to_string_lossy().replace('\\', "/");
  let rel = rel.trim_start_matches('/');
  const DENY: &[&str] = &[
    ".ssh",
    ".gnupg",
    ".aws/credentials",
    ".aws/config",
    ".kube",
    ".docker",
    ".netrc",
    ".npmrc",
    "Library/Keychains",
  ];
  DENY.iter().any(|deny| rel == *deny || rel.starts_with(&format!("{deny}/")))
}

fn is_system_path(resolved: &Path) -> bool {
  let s = resolved.to_string_lossy().replace('\\', "/");
  if cfg!(unix) {
    return s.starts_with("/etc")
      || s.starts_with("/usr")
      || s.starts_with("/bin")
      || s.starts_with("/sbin")
      || s.starts_with("/var")
      || s.starts_with("/System")
      || s.starts_with("/private/etc");
  }
  if cfg!(windows) {
    let upper = s.to_ascii_uppercase();
    return upper.contains(":\\WINDOWS\\")
      || upper.contains(":\\PROGRAM FILES\\")
      || upper.contains(":\\PROGRAM FILES (X86)\\");
  }
  false
}

fn is_under_any(resolved: &Path, roots: &[PathBuf]) -> bool {
  roots.iter().any(|root| path_safety::ensure_under_allowed_root(resolved, root).is_ok())
}

fn standard_export_roots(home: &Path) -> Vec<PathBuf> {
  let mut out = vec![
    home.join("Downloads"),
    home.join("Documents"),
    home.join("Desktop"),
  ];
  if let Ok(temp) = std::env::temp_dir().canonicalize() {
    out.push(temp);
  }
  out
}

pub fn ensure_json_payload_size(data: &[u8], label: &str) -> Result<(), String> {
  if data.len() > MAX_JSON_BYTES {
    return Err(format!("{label} exceeds size limit"));
  }
  Ok(())
}

pub fn clamp_search_query(query: &str) -> Result<String, String> {
  let trimmed = query.trim();
  if trimmed.len() > MAX_SEARCH_QUERY_LEN {
    return Err("Search keyword is too long".to_string());
  }
  Ok(trimmed.to_string())
}

/// Estimated number of bytes before Base64 decoding (the upper limit is the same as the imported file: 20MB).
pub fn ensure_base64_payload_within_limit(data_base64: &str, label: &str) -> Result<(), String> {
  let trimmed = data_base64.trim().replace('\n', "");
  let estimated = trimmed.len().saturating_mul(3) / 4;
  if estimated > MAX_IMPORT_BYTES {
    return Err(format!("{label} exceeds 20MB limit"));
  }
  Ok(())
}

pub fn ensure_binary_payload_size(bytes: &[u8], label: &str) -> Result<(), String> {
  if bytes.len() > MAX_IMPORT_BYTES {
    return Err(format!("{label} exceeds 20MB limit"));
  }
  Ok(())
}

pub fn ensure_note_payload_size(bytes: &[u8], label: &str) -> Result<(), String> {
  if bytes.len() > MAX_NOTE_BYTES {
    return Err(format!("{label} exceeds 20MB limit"));
  }
  Ok(())
}

pub fn ensure_note_file_size(file_len: u64, label: &str) -> Result<(), String> {
  if file_len as usize > MAX_NOTE_BYTES {
    return Err(format!("{label} exceeds 20MB limit"));
  }
  Ok(())
}

pub fn ensure_clipboard_image_file_size(file_len: u64) -> Result<(), String> {
  if file_len as usize > MAX_CLIPBOARD_IMAGE_BYTES {
    return Err(format!(
      "Clipboard image exceeds {}MB limit",
      MAX_CLIPBOARD_IMAGE_BYTES / 1024 / 1024
    ));
  }
  Ok(())
}

pub fn ensure_clipboard_raster_dimensions(width: u32, height: u32) -> Result<(), String> {
  if width == 0 || height == 0 {
    return Err("Clipboard image has invalid dimensions".to_string());
  }
  if width > MAX_CLIPBOARD_IMAGE_DIMENSION || height > MAX_CLIPBOARD_IMAGE_DIMENSION {
    return Err(format!(
      "Clipboard image dimensions exceed {MAX_CLIPBOARD_IMAGE_DIMENSION}px"
    ));
  }
  let pixels = u64::from(width) * u64::from(height);
  if pixels > MAX_CLIPBOARD_IMAGE_PIXELS {
    return Err("Clipboard image pixel count exceeds limit".to_string());
  }
  Ok(())
}

pub fn ensure_pdf_html_payload_size(html: &str) -> Result<(), String> {
  if html.len() > MAX_PDF_HTML_BYTES {
    return Err(format!(
      "PDF export HTML exceeds {}MB limit",
      MAX_PDF_HTML_BYTES / 1024 / 1024
    ));
  }
  Ok(())
}

pub fn ensure_export_base64_payload_within_limit(data_base64: &str, label: &str) -> Result<(), String> {
  let trimmed = data_base64.trim().replace('\n', "");
  let estimated = trimmed.len().saturating_mul(3) / 4;
  if estimated > MAX_EXPORT_BYTES {
    return Err(format!("{label} exceeds 150MB limit"));
  }
  Ok(())
}

pub fn ensure_export_binary_payload_size(bytes: &[u8], label: &str) -> Result<(), String> {
  if bytes.len() > MAX_EXPORT_BYTES {
    return Err(format!("{label} exceeds 150MB limit"));
  }
  Ok(())
}

pub fn clamp_log_line(line: &str) -> String {
  if line.len() <= MAX_LOG_LINE_LEN {
    return line.to_string();
  }
  line.chars().take(MAX_LOG_LINE_LEN).collect()
}

pub fn validate_asset_storage_absolute_path(path: &str) -> Result<(), String> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Ok(());
  }
  let p = PathBuf::from(trimmed);
  path_safety::ensure_no_parent_dir_components(&p)?;
  path_safety::ensure_absolute_path(&p)?;
  let home = home_dir()?;
  let resolved = path_safety::ensure_under_allowed_root(&p, &home)?;
  if is_sensitive_under_home(&resolved, &home) || is_system_path(&resolved) {
    return Err("Asset directory cannot be located in a sensitive system path".to_string());
  }
  Ok(())
}

fn collect_trusted_roots(workspace_root: &str) -> Result<Vec<PathBuf>, String> {
  let mut roots = Vec::new();
  let ws = workspace_root.trim();
  if !ws.is_empty() {
    roots.push(PathBuf::from(ws));
  }
  roots.push(luna_root()?);
  roots.push(theme_root()?);
  Ok(roots)
}

fn resolve_if_allowed(candidate: &Path, allowed_roots: &[PathBuf]) -> Result<PathBuf, String> {
  path_safety::ensure_no_parent_dir_components(candidate)?;
  path_safety::ensure_absolute_path(candidate)?;
  let home = home_dir()?;
  let resolved = if candidate.exists() {
    candidate
      .canonicalize()
      .map_err(|e| format!("Unable to resolve path: {e}"))?
  } else {
    path_safety::ensure_under_allowed_root(candidate, &home)?;
    candidate.to_path_buf()
  };
  if is_system_path(&resolved) {
    return Err("Access to system paths is not allowed".to_string());
  }
  if is_sensitive_under_home(&resolved, &home) {
    return Err("Do not allow access to sensitive paths".to_string());
  }
  if !is_under_any(&resolved, allowed_roots) {
    return Err("Path is not within allowed range".to_string());
  }
  Ok(resolved)
}

pub fn ensure_scoped_path_exists(path: &str, workspace_root: &str) -> Result<bool, String> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Ok(false);
  }
  let allowed = collect_trusted_roots(workspace_root)?;
  let candidate = PathBuf::from(trimmed);
  let resolved = resolve_if_allowed(&candidate, &allowed)?;
  Ok(resolved.exists())
}

pub fn ensure_reveal_allowed(path: &str, workspace_root: &str) -> Result<PathBuf, String> {
  let allowed = collect_trusted_roots(workspace_root)?;
  resolve_if_allowed(&PathBuf::from(path.trim()), &allowed)
}

pub fn ensure_export_allowed(path: &str, workspace_root: &str) -> Result<PathBuf, String> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Err("Export path is empty".to_string());
  }
  let candidate = PathBuf::from(trimmed);
  path_safety::ensure_no_parent_dir_components(&candidate)?;
  path_safety::ensure_absolute_path(&candidate)?;

  let home = home_dir()?;
  if is_system_path(&candidate) {
    return Err("Export to system directories is not allowed".to_string());
  }

  let mut allowed = collect_trusted_roots(workspace_root)?;
  allowed.extend(standard_export_roots(&home));

  let settings = app_settings::read_app_settings_from_disk();
  if settings.asset_storage.mode == "absolute_path" {
    let ap = settings.asset_storage.absolute_path.trim();
    if !ap.is_empty() {
      allowed.push(PathBuf::from(ap));
    }
  }

  let resolved = if candidate.exists() {
    candidate
      .canonicalize()
      .map_err(|e| format!("Unable to resolve path: {e}"))?
  } else if let Some(parent) = candidate.parent() {
    if parent.as_os_str().is_empty() {
      candidate.clone()
    } else if parent.exists() {
      let parent_canon = parent
        .canonicalize()
        .map_err(|e| format!("Unable to resolve parent directory: {e}"))?;
      if is_sensitive_under_home(&parent_canon, &home) {
        return Err("Export to sensitive directories is not allowed".to_string());
      }
      parent_canon.join(
        candidate
          .file_name()
          .ok_or_else(|| "Invalid file name".to_string())?,
      )
    } else {
      candidate.clone()
    }
  } else {
    candidate.clone()
  };

  if is_sensitive_under_home(&resolved, &home) {
    return Err("Export to sensitive directories is not allowed".to_string());
  }

  if !is_under_any(&resolved, &allowed) {
    return Err("The export path must be within the workspace, Downloads, Documents, Desktop or Luna data directory".to_string());
  }

  Ok(resolved)
}

pub fn ensure_open_allowed(path: &str, workspace_root: &str) -> Result<PathBuf, String> {
  ensure_reveal_allowed(path, workspace_root)
}

/// Verify the enumerable workspace root directory (must be under the user's home directory and not a sensitive path).
pub fn ensure_listable_workspace_root(root: &str) -> Result<PathBuf, String> {
  let trimmed = root.trim();
  if trimmed.is_empty() {
    return Err("Workspace path is empty".to_string());
  }
  let candidate = PathBuf::from(trimmed);
  path_safety::ensure_no_parent_dir_components(&candidate)?;
  path_safety::ensure_absolute_path(&candidate)?;
  if is_system_path(&candidate) {
    return Err("Access to system paths is not allowed".to_string());
  }
  let home = home_dir()?;
  let resolved = path_safety::ensure_under_allowed_root(&candidate, &home)?;
  if is_sensitive_under_home(&resolved, &home) {
    return Err("Do not allow access to sensitive paths".to_string());
  }
  if !resolved.is_dir() {
    return Err("Invalid working directory".to_string());
  }
  Ok(resolved)
}

pub fn path_under_workspace(path: &str, workspace_root: &str) -> bool {
  let root = PathBuf::from(workspace_root.trim());
  let candidate = PathBuf::from(path.trim());
  path_safety::ensure_under_allowed_root(&candidate, &root).is_ok()
}

/// Read a file the user chose in a native dialog (not exposed to frontend invoke by path).
pub fn ensure_user_picked_import_read(path: &str) -> Result<PathBuf, String> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Err("Path is empty".to_string());
  }
  let candidate = PathBuf::from(trimmed);
  path_safety::ensure_no_parent_dir_components(&candidate)?;
  path_safety::ensure_absolute_path(&candidate)?;
  if is_system_path(&candidate) {
    return Err("Not allowed to read system path".to_string());
  }
  let home = home_dir()?;
  let resolved = candidate
    .canonicalize()
    .map_err(|e| format!("Unable to resolve path: {e}"))?;
  if is_sensitive_under_home(&resolved, &home) {
    return Err("Do not allow reading of sensitive paths".to_string());
  }
  if !resolved.is_file() {
    return Err("not a file".to_string());
  }
  let meta = std::fs::metadata(&resolved).map_err(|e| format!("Failed to read file information: {e}"))?;
  if meta.len() as usize > MAX_IMPORT_BYTES {
    return Err("File too large".to_string());
  }
  Ok(resolved)
}

pub const MAX_EXTERNAL_OPEN_URL_LEN: usize = 2048;
pub const MAX_EXTERNAL_HTTPS_QUERY_FRAGMENT_LEN: usize = 256;
pub const MAX_MAILTO_QUERY_LEN: usize = 1024;

fn query_and_fragment_len(url: &str) -> usize {
  let q = url.find('?');
  let h = url.find('#');
  match (q, h) {
    (Some(qi), Some(hi)) => url.len() - qi.min(hi),
    (Some(qi), None) => url.len() - qi,
    (None, Some(hi)) => url.len() - hi,
    (None, None) => 0,
  }
}

fn https_url_has_embedded_credentials(url: &str) -> bool {
  let Some(scheme_end) = url.find("://") else {
    return false;
  };
  let rest = &url[scheme_end + 3..];
  rest.contains('@')
}

/// Validate URLs before opening in the system browser (blocks data-exfil style long query strings).
pub fn validate_external_open_url(raw: &str) -> Result<String, String> {
  let url = raw.trim();
  if url.is_empty() {
    return Err("URL is empty".to_string());
  }
  if url.len() > MAX_EXTERNAL_OPEN_URL_LEN {
    return Err("URL is too long".to_string());
  }
  let low = url.to_ascii_lowercase();
  if low.starts_with("javascript:")
    || low.starts_with("data:")
    || low.starts_with("vbscript:")
    || low.starts_with("file:")
    || low.starts_with("note:")
  {
    return Err("Disallowed URL scheme".to_string());
  }
  if low.starts_with("mailto:") {
    let query_len = url.find('?').map(|i| url.len() - i).unwrap_or(0);
    if query_len > MAX_MAILTO_QUERY_LEN {
      return Err("mailto URL query is too long".to_string());
    }
    return Ok(url.to_string());
  }
  if low.starts_with("tel:") {
    if url.len() > 64 {
      return Err("tel URL is too long".to_string());
    }
    return Ok(url.to_string());
  }
  if !low.starts_with("https://") && !low.starts_with("http://") {
    return Err("Only http(s), mailto and tel links can be opened".to_string());
  }
  if https_url_has_embedded_credentials(url) {
    return Err("URLs with embedded credentials are not allowed".to_string());
  }
  if query_and_fragment_len(url) > MAX_EXTERNAL_HTTPS_QUERY_FRAGMENT_LEN {
    return Err("URL query or fragment is too long".to_string());
  }
  Ok(url.to_string())
}

pub fn validate_asset_meta_path(raw: &str, workspace_root: &str) -> Result<(), String> {
  if raw.trim().is_empty() {
    return Ok(());
  }
  let mut roots = collect_trusted_roots(workspace_root)?;
  let settings = app_settings::read_app_settings_from_disk();
  if settings.asset_storage.mode == "absolute_path" {
    let ap = settings.asset_storage.absolute_path.trim();
    if !ap.is_empty() {
      roots.push(PathBuf::from(ap));
    }
  }
  resolve_if_allowed(&PathBuf::from(raw.trim()), &roots)?;
  Ok(())
}

fn starts_with_ascii_case_insensitive(bytes: &[u8], offset: usize, needle: &[u8]) -> bool {
  if offset + needle.len() > bytes.len() {
    return false;
  }
  bytes[offset..offset + needle.len()]
    .iter()
    .zip(needle.iter())
    .all(|(b, n)| b.to_ascii_lowercase() == *n)
}

fn find_ascii_case_insensitive(bytes: &[u8], start: usize, needle: &[u8]) -> Option<usize> {
  if needle.is_empty() || start >= bytes.len() || needle.len() > bytes.len().saturating_sub(start) {
    return None;
  }
  let end = bytes.len() - needle.len();
  let mut i = start;
  while i <= end {
    if starts_with_ascii_case_insensitive(bytes, i, needle) {
      return Some(i);
    }
    i += 1;
  }
  None
}

fn is_tag_name_char(b: u8) -> bool {
  b.is_ascii_alphanumeric() || b == b'-'
}

fn strip_tag_block(html: &str, tag: &[u8]) -> String {
  let close = format!("</{}>", String::from_utf8_lossy(tag));
  let close_bytes = close.as_bytes();
  let open = format!("<{}", String::from_utf8_lossy(tag));
  let open_bytes = open.as_bytes();
  let mut out = String::with_capacity(html.len());
  let mut byte_index = 0;
  let bytes = html.as_bytes();
  while byte_index < bytes.len() {
    if starts_with_ascii_case_insensitive(bytes, byte_index, open_bytes) {
      let after_open = byte_index + open_bytes.len();
      if after_open < bytes.len() && is_tag_name_char(bytes[after_open]) {
        byte_index += 1;
        continue;
      }
      if let Some(close_start) =
        find_ascii_case_insensitive(bytes, after_open, close_bytes)
      {
        byte_index = close_start + close_bytes.len();
        continue;
      }
      if let Some(gt) = bytes[after_open..].iter().position(|&b| b == b'>') {
        byte_index = after_open + gt + 1;
        continue;
      }
      break;
    }
    let ch = html[byte_index..]
      .chars()
      .next()
      .unwrap_or('\u{FFFD}');
    let len = ch.len_utf8();
    out.push(ch);
    byte_index += len;
  }
  out
}

fn strip_on_attrs_from_tag(tag: &str) -> String {
  let mut out = String::with_capacity(tag.len());
  let bytes = tag.as_bytes();
  let mut i = 0;
  if !tag.starts_with('<') {
    return tag.to_string();
  }
  out.push('<');
  i += 1;
  while i < bytes.len() && bytes[i] != b'>' {
    if bytes[i].is_ascii_whitespace() && i + 3 < bytes.len() && bytes[i + 1] == b'o' && bytes[i + 2] == b'n' {
      let mut j = i + 1;
      while j < bytes.len() && is_tag_name_char(bytes[j]) {
        j += 1;
      }
      if j > i + 2 && j < bytes.len() && bytes[j] == b'=' {
        j += 1;
        while j < bytes.len() && bytes[j].is_ascii_whitespace() {
          j += 1;
        }
        if j < bytes.len() {
          let quote = bytes[j];
          if quote == b'"' || quote == b'\'' {
            j += 1;
            while j < bytes.len() && bytes[j] != quote {
              j += 1;
            }
            if j < bytes.len() {
              j += 1;
            }
          } else {
            while j < bytes.len() && !bytes[j].is_ascii_whitespace() && bytes[j] != b'>' {
              j += 1;
            }
          }
          i = j;
          continue;
        }
      }
    }
    let ch = tag[i..].chars().next().unwrap_or('\u{FFFD}');
    let len = ch.len_utf8();
    out.push(ch);
    i += len;
  }
  if i < bytes.len() {
    out.push('>');
  }
  out
}

fn strip_event_handler_attrs(html: &str) -> String {
  let mut out = String::with_capacity(html.len());
  let mut i = 0;
  while i < html.len() {
    if html[i..].starts_with('<') {
      if let Some(end) = html[i..].find('>') {
        let tag = &html[i..=i + end];
        out.push_str(&strip_on_attrs_from_tag(tag));
        i += end + 1;
        continue;
      }
    }
    let ch = html[i..].chars().next().unwrap_or('\u{FFFD}');
    let len = ch.len_utf8();
    out.push(ch);
    i += len;
  }
  out
}

const PDF_FORBIDDEN_TAGS: &[&str] = &[
  // Keep `<style>`: export HTML is app-generated and relies on inline CSS for code blocks, TOC, etc.
  "script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "link",
  "base", "frame", "frameset", "applet",
];

pub fn sanitize_pdf_html(html: &str) -> String {
  let mut out = html.to_string();
  for tag in PDF_FORBIDDEN_TAGS {
    out = strip_tag_block(&out, tag.as_bytes());
  }
  strip_event_handler_attrs(&out)
}

#[cfg(test)]
mod sanitize_pdf_tests {
  use super::sanitize_pdf_html;

  #[test]
  fn sanitize_pdf_html_preserves_utf8_outside_script() {
    let html = "<p>中文笔记</p><script>alert(1)</script><p>更多内容 🎉</p>";
    let out = sanitize_pdf_html(html);
    assert!(!out.contains("<script"));
    assert!(out.contains("中文笔记"));
    assert!(out.contains("更多内容"));
    assert!(out.contains("🎉"));
  }

  #[test]
  fn sanitize_pdf_html_strips_iframe_and_onclick() {
    let html = r#"<p>ok</p><iframe src="https://evil.test"></iframe><img onclick="alert(1)" src="x">"#;
    let out = sanitize_pdf_html(html);
    assert!(!out.to_ascii_lowercase().contains("iframe"));
    assert!(!out.contains("onclick"));
    assert!(out.contains("ok"));
  }

  #[test]
  fn sanitize_pdf_html_preserves_inline_style_blocks() {
    let html = "<style>.md-export-toc{background:#f6f8fa}</style><nav class=\"md-export-toc\">目录</nav>";
    let out = sanitize_pdf_html(html);
    assert!(out.contains("<style>"));
    assert!(out.contains(".md-export-toc"));
    assert!(out.contains("目录"));
  }

}

#[cfg(test)]
mod external_open_url_tests {
  use super::validate_external_open_url;

  #[test]
  fn validate_external_open_url_allows_short_https() {
    assert!(validate_external_open_url("https://github.com/lunote-code/lunote/releases/latest").is_ok());
  }

  #[test]
  fn validate_external_open_url_rejects_long_query() {
    let leak = format!("https://evil.test/x?{}", "a".repeat(300));
    assert!(validate_external_open_url(&leak).is_err());
  }

  #[test]
  fn validate_external_open_url_rejects_javascript() {
    assert!(validate_external_open_url("javascript:alert(1)").is_err());
  }

  #[test]
  fn validate_external_open_url_allows_mailto_subject() {
    assert!(validate_external_open_url("mailto:?subject=Hello").is_ok());
  }
}
