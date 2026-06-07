#[cfg(any(test, all(unix, not(target_os = "macos"))))]
use std::path::Path;
#[cfg(all(unix, not(target_os = "macos")))]
use std::process::Command;

/// Percent-encode one `file://` path segment.
#[cfg(any(test, all(unix, not(target_os = "macos"))))]
fn encode_uri_path_segment(segment: &str) -> String {
  let mut out = String::with_capacity(segment.len());
  for &byte in segment.as_bytes() {
    let unreserved =
      byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~');
    if unreserved {
      out.push(byte as char);
    } else {
      out.push('%');
      out.push_str(&format!("{byte:02X}"));
    }
  }
  out
}

/// Build a `file://` URI for D-Bus FileManager1 and similar APIs.
#[cfg(any(test, all(unix, not(target_os = "macos"))))]
pub fn path_to_file_uri(path: &Path) -> Result<String, String> {
  let abs = std::fs::canonicalize(path).map_err(|e| format!("Failed to resolve path: {e}"))?;
  let normalized = abs.to_string_lossy().replace('\\', "/");
  let encoded_path = normalized
    .split('/')
    .map(encode_uri_path_segment)
    .collect::<Vec<_>>()
    .join("/");
  Ok(format!("file://{encoded_path}"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn run_command(program: &str, args: &[&str]) -> bool {
  Command::new(program)
    .args(args)
    .status()
    .map(|status| status.success())
    .unwrap_or(false)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn try_select_in_file_manager(program: &str, select_flag: &str, path: &Path) -> bool {
  let path_str = path.to_string_lossy();
  run_command(program, &[select_flag, path_str.as_ref()])
}

#[cfg(all(unix, not(target_os = "macos")))]
fn try_dbus_file_manager_show_items(file_uri: &str) -> bool {
  run_command(
    "dbus-send",
    &[
      "--session",
      "--print-reply",
      "--dest=org.freedesktop.FileManager1",
      "/org/freedesktop/FileManager1",
      "org.freedesktop.FileManager1.ShowItems",
      &format!("array:string:\"{file_uri}\""),
      "string:\"\"",
    ],
  )
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_parent_directory(path: &Path) -> Result<(), String> {
  let dir = path
    .parent()
    .ok_or_else(|| "Invalid path".to_string())?;
  Command::new("xdg-open")
    .arg(dir)
    .spawn()
    .map_err(|e| format!("Failed to open directory: {e}"))?;
  Ok(())
}

/// Reveal a path in the Linux file manager, selecting the file when supported.
#[cfg(all(unix, not(target_os = "macos")))]
pub fn reveal_path_in_file_manager(resolved: &Path) -> Result<(), String> {
  const SELECTORS: [(&str, &str); 4] = [
    ("nautilus", "--select"),
    ("dolphin", "--select"),
    ("nemo", "--select"),
    ("pcmanfm", "--select"),
  ];

  for (program, flag) in SELECTORS {
    if try_select_in_file_manager(program, flag, resolved) {
      return Ok(());
    }
  }

  if let Ok(file_uri) = path_to_file_uri(resolved) {
    if try_dbus_file_manager_show_items(&file_uri) {
      return Ok(());
    }
  }

  open_parent_directory(resolved)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn path_to_file_uri_percent_encodes_non_ascii_segments() {
    let dir = std::env::temp_dir().join("lunote-reveal-测试");
    let _ = std::fs::create_dir_all(&dir);
    let file = dir.join("note.md");
    std::fs::write(&file, "# test").expect("write temp file");
    let uri = path_to_file_uri(&file).expect("file uri");
    assert!(uri.starts_with("file://"));
    assert!(uri.contains("%") || !file.to_string_lossy().contains('测'));
  }

  #[test]
  fn path_to_file_uri_uses_forward_slashes() {
    let file = std::env::temp_dir().join("lunote-reveal-uri-test.md");
    std::fs::write(&file, "# test").expect("write temp file");
    let uri = path_to_file_uri(&file).expect("file uri");
    assert!(!uri.contains('\\'));
  }
}
