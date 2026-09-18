use std::fs;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::luna_paths;

fn settings_path() -> Result<std::path::PathBuf, String> {
  luna_paths::user_settings_file()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  #[serde(default = "default_version")]
  pub version: u32,
  /// `"system"` or a BCP-47 locale id such as `en`, `zh-CN`.
  #[serde(default = "default_language")]
  pub language: String,
  #[serde(default)]
  pub last_workspace_root: Option<String>,
  #[serde(default)]
  pub last_workspace_id: Option<String>,
  #[serde(default)]
  pub asset_storage: AssetStorageConfig,
  #[serde(default)]
  pub appearance: Option<serde_json::Value>,
  /// commandId → accelerator (such as Mod+Shift+f)
  #[serde(default)]
  pub shortcut_overrides: Option<std::collections::HashMap<String, String>>,
  #[serde(default)]
  pub updates: Option<UpdatesSettings>,
  #[serde(default)]
  pub security: Option<SecuritySettings>,
  #[serde(default)]
  pub ai: Option<AiSettings>,
  #[serde(default)]
  pub ai_connection_test: Option<AiConnectionTestResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionTestResult {
  pub ok: bool,
  pub at: u64,
  #[serde(default)]
  pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
  #[serde(default)]
  pub provider: Option<String>,
  #[serde(default)]
  pub api_key: Option<String>,
  #[serde(default)]
  pub base_url: Option<String>,
  #[serde(default)]
  pub model: Option<String>,
  #[serde(default)]
  pub include_workspace_search: Option<bool>,
  #[serde(default)]
  pub include_graph_neighbors: Option<bool>,
  #[serde(default)]
  pub system_prompt: Option<String>,
  #[serde(default)]
  pub conversation_scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatesSettings {
  #[serde(default)]
  pub auto_check_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySettings {
  #[serde(default)]
  pub auto_lock_minutes: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetStorageConfig {
  #[serde(default = "default_asset_storage_mode")]
  pub mode: String,
  #[serde(default = "default_relative_folder_name")]
  pub relative_folder_name: String,
  #[serde(default)]
  pub absolute_path: String,
}

fn default_version() -> u32 {
  1
}

fn default_language() -> String {
  "system".into()
}

fn default_asset_storage_mode() -> String {
  "relative_to_document".into()
}

fn default_relative_folder_name() -> String {
  "{doc-name}-assets".into()
}

impl Default for AssetStorageConfig {
  fn default() -> Self {
    Self {
      mode: default_asset_storage_mode(),
      relative_folder_name: default_relative_folder_name(),
      absolute_path: String::new(),
    }
  }
}

impl Default for AppSettings {
  fn default() -> Self {
    Self {
      version: 1,
      language: "system".into(),
      last_workspace_root: None,
      last_workspace_id: None,
      asset_storage: AssetStorageConfig::default(),
      appearance: None,
      shortcut_overrides: None,
      updates: None,
      security: None,
      ai: None,
      ai_connection_test: None,
    }
  }
}

impl AppSettings {
  pub fn close_to_tray_enabled(&self) -> bool {
    self
      .appearance
      .as_ref()
      .and_then(|appearance| appearance.get("window"))
      .and_then(|window| window.get("closeToTrayEnabled"))
      .and_then(|value| value.as_bool())
      .unwrap_or(true)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn persists_ai_connection_test() {
    let settings = AppSettings {
      ai_connection_test: Some(AiConnectionTestResult {
        ok: true,
        at: 1_700_000_000_000,
        provider: Some("google".into()),
      }),
      ..AppSettings::default()
    };
    let json = serde_json::to_string(&settings).expect("serialize");
    let parsed: AppSettings = serde_json::from_str(&json).expect("deserialize");
    let test = parsed.ai_connection_test.expect("ai connection test");
    assert!(test.ok);
    assert_eq!(test.at, 1_700_000_000_000);
    assert_eq!(test.provider.as_deref(), Some("google"));
  }

  #[test]
  fn persists_ai_settings() {
    let settings = AppSettings {
      ai: Some(AiSettings {
        provider: Some("anthropic".into()),
        api_key: Some("sk-test".into()),
        base_url: Some("https://api.anthropic.com".into()),
        model: Some("claude-sonnet-4-20250514".into()),
        include_workspace_search: None,
        include_graph_neighbors: None,
        system_prompt: None,
        conversation_scope: None,
      }),
      ..AppSettings::default()
    };
    let json = serde_json::to_string(&settings).expect("serialize");
    let parsed: AppSettings = serde_json::from_str(&json).expect("deserialize");
    let ai = parsed.ai.expect("ai settings");
    assert_eq!(ai.provider.as_deref(), Some("anthropic"));
    assert_eq!(ai.api_key.as_deref(), Some("sk-test"));
    assert_eq!(ai.base_url.as_deref(), Some("https://api.anthropic.com"));
    assert_eq!(ai.model.as_deref(), Some("claude-sonnet-4-20250514"));
  }

  #[test]
  fn persists_security_auto_lock_minutes() {
    let settings = AppSettings {
      security: Some(SecuritySettings {
        auto_lock_minutes: Some(5),
      }),
      ..AppSettings::default()
    };
    let json = serde_json::to_string(&settings).expect("serialize");
    let parsed: AppSettings = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(
      parsed
        .security
        .as_ref()
        .and_then(|security| security.auto_lock_minutes),
      Some(5)
    );
  }

  #[test]
  fn persists_updates_auto_check_disabled() {
    let settings = AppSettings {
      updates: Some(UpdatesSettings {
        auto_check_enabled: Some(false),
      }),
      ..AppSettings::default()
    };
    let json = serde_json::to_string(&settings).expect("serialize");
    let parsed: AppSettings = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(
      parsed
        .updates
        .as_ref()
        .and_then(|u| u.auto_check_enabled),
      Some(false)
    );
  }

  #[test]
  fn defaults_close_to_tray_enabled_when_missing() {
    let settings = AppSettings::default();
    assert!(settings.close_to_tray_enabled());
  }

  #[test]
  fn reads_close_to_tray_enabled_from_appearance_blob() {
    let settings = AppSettings {
      appearance: Some(serde_json::json!({
        "window": {
          "closeToTrayEnabled": false
        }
      })),
      ..AppSettings::default()
    };
    assert!(!settings.close_to_tray_enabled());
  }
}

pub fn read_app_settings(app: &AppHandle) -> AppSettings {
  let _ = app;
  read_app_settings_from_disk()
}

pub fn read_app_settings_from_disk() -> AppSettings {
  let Ok(path) = settings_path() else {
    log::warn!("[app-settings] read_app_settings: settings path unavailable");
    return AppSettings::default();
  };
  let Ok(bytes) = fs::read(&path) else {
    log::warn!(
      "[app-settings] read_app_settings: missing file {}",
      path.display()
    );
    return AppSettings::default();
  };
  let settings: AppSettings = serde_json::from_slice(&bytes).unwrap_or_default();
  log::info!(
    "[app-settings] read_app_settings language={} last_workspace_root={:?} last_workspace_id={:?}",
    settings.language,
    settings.last_workspace_root,
    settings.last_workspace_id
  );
  settings
}

pub fn write_app_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
  let _ = app;
  crate::core::security::validate_asset_storage_absolute_path(&settings.asset_storage.absolute_path)?;
  luna_paths::ensure_luna_dirs()?;
  let path = settings_path()?;
  let data = serde_json::to_vec_pretty(&settings).map_err(|e| e.to_string())?;
  crate::core::security::ensure_json_payload_size(&data, "Apply settings")?;
  crate::core::atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())
}

