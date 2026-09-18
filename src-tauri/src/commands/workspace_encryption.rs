use tauri::{AppHandle, Emitter, Manager, State};

use std::sync::Arc;

use crate::core::workspace_encryption::{
  self, MigrationProgress, WorkspaceCryptoState, WorkspaceEncryptionStatus,
};

use super::resolve_workspace_root;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRootPayload {
  pub root: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePasswordPayload {
  pub root: String,
  pub password: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangePasswordPayload {
  pub root: String,
  pub current_password: String,
  pub new_password: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEncryptionMigrationProgressPayload {
  pub root: String,
  pub phase: String,
  pub processed: u32,
  pub total: u32,
}

pub const WORKSPACE_ENCRYPTION_MIGRATION_PROGRESS_EVENT: &str =
  "luna:workspace-encryption-migration-progress";

fn emit_migration_progress(app: &AppHandle, root: &str, progress: MigrationProgress) {
  let _ = app.emit(
    WORKSPACE_ENCRYPTION_MIGRATION_PROGRESS_EVENT,
    WorkspaceEncryptionMigrationProgressPayload {
      root: root.to_string(),
      phase: progress.phase.as_str().to_string(),
      processed: progress.processed,
      total: progress.total,
    },
  );
}

#[tauri::command]
pub fn get_workspace_encryption_status(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: WorkspaceRootPayload,
) -> Result<WorkspaceEncryptionStatus, String> {
  let root = resolve_workspace_root(&payload.root)?;
  workspace_encryption::status_for_root(&crypto, &root)
}

#[tauri::command]
pub fn unlock_workspace(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: WorkspacePasswordPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  workspace_encryption::unlock_workspace(&crypto, &root, &payload.password)
}

#[tauri::command]
pub fn decrypt_legacy_encrypted_images(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: WorkspaceRootPayload,
) -> Result<u32, String> {
  let root = resolve_workspace_root(&payload.root)?;
  workspace_encryption::decrypt_legacy_encrypted_images(&crypto, &root)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEncryptImagesPayload {
  pub root: String,
  pub enabled: bool,
}

#[tauri::command]
pub fn set_workspace_encrypt_images(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: WorkspaceEncryptImagesPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  workspace_encryption::set_workspace_encrypt_images(&crypto, &root, payload.enabled)
}

#[tauri::command]
pub fn lock_workspace(
  app: AppHandle,
  crypto: State<'_, WorkspaceCryptoState>,
  payload: WorkspaceRootPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  workspace_encryption::lock_workspace(&crypto, &root);
  if let Some(state) = app.try_state::<crate::AppState>() {
    super::drop_search_index_for_locked_root(&state, &root);
  }
  Ok(())
}

#[tauri::command]
pub fn cancel_workspace_encryption_migration(
  crypto: State<'_, WorkspaceCryptoState>,
  payload: WorkspaceRootPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  workspace_encryption::cancel_workspace_encryption_migration(&crypto, &root)
}

#[tauri::command]
pub async fn enable_workspace_encryption(
  app: AppHandle,
  payload: WorkspacePasswordPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  let password = payload.password;
  tauri::async_runtime::spawn_blocking(move || {
    let crypto = app.state::<WorkspaceCryptoState>();
    let reporter: workspace_encryption::MigrationProgressReporter = Some(Arc::new({
      let app = app.clone();
      let root = root.clone();
      move |progress| emit_migration_progress(&app, &root, progress)
    }));
    workspace_encryption::enable_workspace_encryption_with_progress(
      &crypto,
      &root,
      &password,
      reporter,
    )
  })
  .await
  .map_err(|e| format!("Encryption task failed: {e}"))?
}

#[tauri::command]
pub async fn disable_workspace_encryption(
  app: AppHandle,
  payload: WorkspacePasswordPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  let password = payload.password;
  tauri::async_runtime::spawn_blocking(move || {
    let crypto = app.state::<WorkspaceCryptoState>();
    let reporter: workspace_encryption::MigrationProgressReporter = Some(Arc::new({
      let app = app.clone();
      let root = root.clone();
      move |progress| emit_migration_progress(&app, &root, progress)
    }));
    workspace_encryption::disable_workspace_encryption_with_progress(
      &crypto,
      &root,
      &password,
      reporter,
    )
  })
  .await
  .map_err(|e| format!("Decryption task failed: {e}"))?
}

#[tauri::command]
pub async fn change_workspace_encryption_password(
  app: AppHandle,
  payload: WorkspaceChangePasswordPayload,
) -> Result<(), String> {
  let root = resolve_workspace_root(&payload.root)?;
  let current_password = payload.current_password;
  let new_password = payload.new_password;
  tauri::async_runtime::spawn_blocking(move || {
    let crypto = app.state::<WorkspaceCryptoState>();
    let reporter: workspace_encryption::MigrationProgressReporter = Some(Arc::new({
      let app = app.clone();
      let root = root.clone();
      move |progress| emit_migration_progress(&app, &root, progress)
    }));
    workspace_encryption::change_workspace_encryption_password_with_progress(
      &crypto,
      &root,
      &current_password,
      &new_password,
      reporter,
    )
  })
  .await
  .map_err(|e| format!("Password change task failed: {e}"))?
}
