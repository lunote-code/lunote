use std::path::PathBuf;
#[cfg(target_os = "linux")]
use std::process::Command;

#[derive(serde::Deserialize)]
struct ChromeCandidatesFile {
  #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
  darwin: Vec<String>,
  #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
  win32: Vec<String>,
  #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
  linux: Vec<String>,
  #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
  #[serde(default, rename = "linuxRelativeHome")]
  linux_relative_home: Vec<String>,
  #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
  #[serde(default, rename = "linuxWhichBinaries")]
  linux_which_binaries: Vec<String>,
}

const CANDIDATES_JSON: &str = include_str!(concat!(
  env!("CARGO_MANIFEST_DIR"),
  "/../scripts/export/chrome-executable-candidates.json"
));

fn load_candidates_file() -> ChromeCandidatesFile {
  serde_json::from_str(CANDIDATES_JSON).expect("chrome-executable-candidates.json must be valid")
}

#[cfg(target_os = "windows")]
fn expand_win_path(template: &str) -> String {
  let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
  let pf86 =
    std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
  template
    .replace("{ProgramFiles(x86)}", &pf86)
    .replace("{ProgramFiles}", &pf)
}

#[cfg(target_os = "linux")]
fn home_dir() -> Option<PathBuf> {
  for key in ["HOME", "USERPROFILE"] {
    if let Ok(val) = std::env::var(key) {
      let path = PathBuf::from(val);
      if path.is_absolute() {
        return Some(path);
      }
    }
  }
  None
}

pub fn chrome_executable_candidates() -> Vec<PathBuf> {
  let file = load_candidates_file();
  #[cfg(target_os = "macos")]
  {
    return file.darwin.into_iter().map(PathBuf::from).collect();
  }
  #[cfg(target_os = "windows")]
  {
    return file
      .win32
      .into_iter()
      .map(|template| PathBuf::from(expand_win_path(&template)))
      .collect();
  }
  #[cfg(target_os = "linux")]
  {
    let mut candidates: Vec<PathBuf> = file.linux.into_iter().map(PathBuf::from).collect();
    if let Some(home) = home_dir() {
      for rel in file.linux_relative_home {
        candidates.push(home.join(rel));
      }
    }
    return candidates;
  }
  #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
  {
    let _ = file;
    Vec::new()
  }
}

#[cfg(target_os = "linux")]
fn which_binary(name: &str) -> Option<PathBuf> {
  let output = Command::new("which").arg(name).output().ok()?;
  if !output.status.success() {
    return None;
  }
  let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if path.is_empty() {
    return None;
  }
  let candidate = PathBuf::from(path);
  candidate.is_file().then_some(candidate)
}

#[cfg(target_os = "linux")]
fn linux_which_chrome_executable() -> Option<PathBuf> {
  let names = load_candidates_file().linux_which_binaries;
  for name in names {
    if let Some(found) = which_binary(&name) {
      return Some(found);
    }
  }
  None
}

pub fn find_existing_chrome_executable() -> Option<PathBuf> {
  if let Some(found) = chrome_executable_candidates()
    .into_iter()
    .find(|candidate| candidate.is_file())
  {
    return Some(found);
  }

  #[cfg(target_os = "linux")]
  {
    return linux_which_chrome_executable();
  }

  #[cfg(not(target_os = "linux"))]
  None
}

/// Reject arbitrary binaries when `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH` is set.
pub fn is_trusted_chrome_executable(path: &std::path::Path) -> bool {
  if !path.is_file() {
    return false;
  }
  let canonical = path
    .canonicalize()
    .unwrap_or_else(|_| path.to_path_buf());

  for candidate in chrome_executable_candidates() {
    if !candidate.is_file() {
      continue;
    }
    let resolved = candidate
      .canonicalize()
      .unwrap_or_else(|_| candidate.clone());
    if resolved == canonical {
      return true;
    }
  }

  #[cfg(target_os = "linux")]
  {
    if let Some(which) = linux_which_chrome_executable() {
      let resolved = which
        .canonicalize()
        .unwrap_or_else(|_| which.clone());
      if resolved == canonical {
        return true;
      }
    }
  }

  let Some(base) = path.file_name().and_then(|n| n.to_str()) else {
    return false;
  };
  let base_lower = base.to_lowercase();
  let file = load_candidates_file();
  if file
    .linux_which_binaries
    .iter()
    .any(|name| base_lower == name.to_lowercase())
  {
    return true;
  }
  matches!(
    base_lower.as_str(),
    "google chrome" | "chromium" | "microsoft edge" | "brave browser" | "chrome.exe" | "msedge.exe"
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn candidates_json_parses() {
    let file = load_candidates_file();
    assert!(!file.darwin.is_empty());
    assert!(!file.win32.is_empty());
    assert!(!file.linux.is_empty());
    assert!(!file.linux_which_binaries.is_empty());
  }

  #[test]
  fn platform_candidates_are_non_empty() {
    let candidates = chrome_executable_candidates();
    assert!(!candidates.is_empty());
  }

  #[test]
  fn linux_json_covers_common_distro_and_nix_paths() {
    let file = load_candidates_file();
    let linux = file.linux.join("\n");
    assert!(linux.contains("/usr/bin/chromium"));
    assert!(linux.contains("/usr/local/bin/chromium"));
    assert!(linux.contains("brave-browser"));

    let rel = file.linux_relative_home.join("\n");
    assert!(rel.contains(".nix-profile/bin/chromium"));
  }

  #[test]
  fn trusted_chrome_rejects_unknown_binary_name() {
    let fake = std::env::temp_dir().join("lunote-fake-chrome-bin");
    let _ = std::fs::write(&fake, b"#!/bin/sh\n");
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let _ = std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755));
    }
    assert!(!is_trusted_chrome_executable(&fake));
    let _ = std::fs::remove_file(fake);
  }

  #[test]
  fn trusted_chrome_accepts_known_linux_binary_names() {
    let fake = std::env::temp_dir().join("google-chrome-stable");
    let _ = std::fs::write(&fake, b"#!/bin/sh\n");
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let _ = std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755));
    }
    assert!(is_trusted_chrome_executable(&fake));
    let _ = std::fs::remove_file(fake);
  }
}
