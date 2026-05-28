use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;

use crate::core::security;

/// Percent-encode one `file://` path segment (aligned with `mediaSources.fileUrl` in the frontend).
fn encode_uri_path_segment(segment: &str) -> String {
  let mut out = String::with_capacity(segment.len());
  for &byte in segment.as_bytes() {
    let unreserved = byte.is_ascii_alphanumeric()
      || matches!(byte, b'-' | b'_' | b'.' | b'~');
    if unreserved {
      out.push(byte as char);
    } else {
      out.push('%');
      out.push_str(&format!("{byte:02X}"));
    }
  }
  out
}

fn path_to_file_url(path: &Path) -> Result<String, String> {
  let abs = std::fs::canonicalize(path).map_err(|e| format!("Failed to parse HTML path: {e}"))?;
  let normalized = abs.to_string_lossy().replace('\\', "/");
  let prefix = if normalized.starts_with('/') {
    "file://"
  } else {
    "file:///"
  };
  let encoded_path = normalized
    .split('/')
    .map(encode_uri_path_segment)
    .collect::<Vec<_>>()
    .join("/");
  Ok(format!("{prefix}{encoded_path}"))
}

fn candidate_exists(path: &Path) -> Option<PathBuf> {
  if path.is_file() {
    Some(path.to_path_buf())
  } else {
    None
  }
}

fn find_chrome_executable() -> Result<PathBuf, String> {
  if let Ok(from_env) = std::env::var("CHROME_PATH") {
    let trimmed = from_env.trim();
    if !trimmed.is_empty() {
      let p = PathBuf::from(trimmed);
      if p.is_file() {
        return Ok(p);
      }
      return Err(format!("The file pointed to by CHROME_PATH does not exist: {trimmed}"));
    }
  }

  if let Ok(from_env) = std::env::var("PUPPETEER_EXECUTABLE_PATH") {
    let trimmed = from_env.trim();
    if !trimmed.is_empty() {
      let p = PathBuf::from(trimmed);
      if p.is_file() {
        return Ok(p);
      }
    }
  }

  let mut candidates: Vec<PathBuf> = Vec::new();
  #[cfg(target_os = "macos")]
  {
    candidates.extend([
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ]
    .into_iter()
    .map(PathBuf::from));
  }
  #[cfg(target_os = "windows")]
  {
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let pf86 =
      std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
    candidates.extend([
      format!("{pf}\\Google\\Chrome\\Application\\chrome.exe"),
      format!("{pf86}\\Google\\Chrome\\Application\\chrome.exe"),
      format!("{pf}\\Microsoft\\Edge\\Application\\msedge.exe"),
      format!("{pf86}\\Microsoft\\Edge\\Application\\msedge.exe"),
    ]
    .into_iter()
    .map(PathBuf::from));
  }
  #[cfg(target_os = "linux")]
  {
    candidates.extend(
      [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
      ]
      .into_iter()
      .map(PathBuf::from),
    );
  }

  for candidate in candidates {
    if let Some(found) = candidate_exists(&candidate) {
      return Ok(found);
    }
  }

  Err(
    "Chrome/Chromium/Edge not found. Please install Google Chrome, or set the CHROME_PATH environment variable."
      .to_string(),
  )
}

fn remove_dir_best_effort(dir: &Path) {
  let _ = std::fs::remove_dir_all(dir);
}

/// Render HTML to PDF (vector output for desktop export) using native headless Chrome.
pub fn render_html_to_pdf_bytes(html: &str) -> Result<Vec<u8>, String> {
  security::ensure_pdf_html_payload_size(html)?;
  let sanitized = crate::core::security::sanitize_pdf_html(html);
  security::ensure_pdf_html_payload_size(&sanitized)?;
  let stamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|e| format!("System time error: {e}"))?
    .as_nanos();
  let temp_dir = std::env::temp_dir().join(format!("lunote-pdf-{stamp}"));
  std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temporary directory: {e}"))?;

  let html_path = temp_dir.join("export.html");
  let pdf_path = temp_dir.join("export.pdf");

  let write_result = std::fs::write(&html_path, sanitized);
  if write_result.is_err() {
    remove_dir_best_effort(&temp_dir);
    return Err(format!("Failed to write temporary HTML: {}", write_result.unwrap_err()));
  }

  let chrome = find_chrome_executable();
  if chrome.is_err() {
    remove_dir_best_effort(&temp_dir);
    return Err(chrome.unwrap_err());
  }
  let chrome = chrome.unwrap();

  let file_url = path_to_file_url(&html_path);
  if file_url.is_err() {
    remove_dir_best_effort(&temp_dir);
    return Err(file_url.unwrap_err());
  }
  let file_url = file_url.unwrap();

  let pdf_arg = format!("--print-to-pdf={}", pdf_path.display());
  let output = Command::new(&chrome)
    .arg("--headless=new")
    .arg("--disable-gpu")
    .arg("--no-first-run")
    .arg("--no-default-browser-check")
    .arg("--disable-extensions")
    .arg("--run-all-compositor-stages-before-draw")
    .arg("--virtual-time-budget=15000")
    .arg("--no-pdf-header-footer")
    .arg(&pdf_arg)
    .arg(&file_url)
    .output();

  if output.is_err() {
    remove_dir_best_effort(&temp_dir);
    return Err(format!("Failed to launch Chrome: {}", output.unwrap_err()));
  }
  let output = output.unwrap();

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    remove_dir_best_effort(&temp_dir);
    return Err(format!("Chrome printing PDF failed: {stderr}"));
  }

  if !pdf_path.is_file() {
    remove_dir_best_effort(&temp_dir);
    return Err("Chrome is not generating the PDF file".to_string());
  }

  let bytes = std::fs::read(&pdf_path).map_err(|e| format!("Failed to read PDF: {e}"))?;
  remove_dir_best_effort(&temp_dir);
  security::ensure_export_binary_payload_size(&bytes, "PDF export")?;
  Ok(bytes)
}

pub fn render_html_to_pdf_base64(html: &str) -> Result<String, String> {
  let bytes = render_html_to_pdf_bytes(html)?;
  let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
  security::ensure_export_base64_payload_within_limit(&encoded, "PDF export data")?;
  Ok(encoded)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn path_to_file_url_percent_encodes_non_ascii_segments() {
    let dir = std::env::temp_dir().join("lunote-pdf-url-测试");
    let _ = std::fs::create_dir_all(&dir);
    let file = dir.join("export.html");
    std::fs::write(&file, "<html></html>").expect("write temp html");
    let url = path_to_file_url(&file).expect("file url");
    assert!(url.contains("%"), "expected percent-encoding in file URL: {url}");
    assert!(url.starts_with("file://"));
  }
}
