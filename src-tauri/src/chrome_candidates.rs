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
}
