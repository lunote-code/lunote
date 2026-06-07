use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;

use crate::chrome_candidates;
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

  if let Some(found) = chrome_candidates::find_existing_chrome_executable() {
    return Ok(found);
  }

  Err(
    "Chrome/Chromium/Edge not found for PDF export. Install a Chromium-based browser (e.g. google-chrome-stable or chromium), or set CHROME_PATH to the browser executable. HTML and Word export do not require Chrome."
      .to_string(),
  )
}

/// CLI flags for headless Chrome PDF printing.
///
/// **Linux sandbox trade-off:** adds `--no-sandbox` / `--disable-setuid-sandbox` so PDF export
/// works in containers and minimal desktops where Chrome's setuid sandbox cannot start. Chrome
/// isolation is weaker; mitigation is that export HTML is always passed through
/// [`security::sanitize_pdf_html`] immediately before write (app-generated content only).
pub(crate) fn chrome_pdf_cli_args(pdf_path: &Path, file_url: &str) -> Vec<String> {
  let mut args = vec![
    "--headless=new".to_string(),
    "--disable-gpu".to_string(),
    "--no-first-run".to_string(),
    "--no-default-browser-check".to_string(),
    "--disable-extensions".to_string(),
    "--run-all-compositor-stages-before-draw".to_string(),
    "--virtual-time-budget=15000".to_string(),
    "--no-pdf-header-footer".to_string(),
  ];
  #[cfg(target_os = "linux")]
  {
    args.push("--no-sandbox".to_string());
    args.push("--disable-setuid-sandbox".to_string());
  }
  args.push(format!("--print-to-pdf={}", pdf_path.display()));
  args.push(file_url.to_string());
  args
}

fn remove_dir_best_effort(dir: &Path) {
  let _ = std::fs::remove_dir_all(dir);
}

/// Render HTML to PDF (vector output for desktop export) using native headless Chrome.
/// Input HTML is sanitized before Chrome loads the temp file (see [`chrome_pdf_cli_args`] sandbox note on Linux).
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

  let mut cmd = Command::new(&chrome);
  for arg in chrome_pdf_cli_args(&pdf_path, &file_url) {
    cmd.arg(arg);
  }
  let output = cmd.output();

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

  #[test]
  fn chrome_pdf_cli_args_include_linux_sandbox_bypass() {
    let args = chrome_pdf_cli_args(Path::new("/tmp/export.pdf"), "file:///tmp/export.html");
    #[cfg(target_os = "linux")]
    {
      assert!(args.iter().any(|arg| arg == "--no-sandbox"));
      assert!(args.iter().any(|arg| arg == "--disable-setuid-sandbox"));
    }
    #[cfg(not(target_os = "linux"))]
    {
      assert!(!args.iter().any(|arg| arg == "--no-sandbox"));
    }
    assert!(args.iter().any(|arg| arg.starts_with("--print-to-pdf=")));
  }

  #[test]
  fn pdf_export_sanitizes_script_tags_before_chrome() {
    let html = "<p>ok</p><script>alert(1)</script>";
    let sanitized = security::sanitize_pdf_html(html);
    assert!(!sanitized.contains("<script"));
    assert!(sanitized.contains("ok"));
  }
}
