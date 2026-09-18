use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::Engine;
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::Sha256;
use walkdir::WalkDir;

use super::atomic_io;
use super::files;
use super::parallel_batch;
use super::security;
use crate::luna_paths;

const MAGIC: &[u8; 6] = b"LNOTE\x01";
const VERIFY_MESSAGE: &[u8] = b"lunote-workspace-v1";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const VERIFY_TOKEN_LEN: usize = 16;
const MIN_PASSWORD_LEN: usize = 8;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEncryptionMeta {
  #[serde(default = "default_meta_version")]
  pub version: u32,
  pub enabled: bool,
  pub salt: String,
  pub verify_token: String,
  /// Set after legacy encrypted image attachments have been scanned and migrated to plaintext.
  #[serde(default)]
  pub legacy_images_plaintext: bool,
  /// When true, new image attachments are encrypted at rest (opt-in; default off).
  #[serde(default)]
  pub encrypt_images: bool,
}

fn default_meta_version() -> u32 {
  1
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEncryptionStatus {
  pub enabled: bool,
  pub unlocked: bool,
  pub encrypt_images: bool,
}

pub struct WorkspaceCryptoState {
  unlocked_keys: Mutex<HashMap<String, [u8; 32]>>,
  migrating_roots: Mutex<HashSet<String>>,
  migration_cancel: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl WorkspaceCryptoState {
  pub fn new() -> Self {
    Self {
      unlocked_keys: Mutex::new(HashMap::new()),
      migrating_roots: Mutex::new(HashSet::new()),
      migration_cancel: Mutex::new(HashMap::new()),
    }
  }

  pub fn begin_migration(&self, root: &str) {
    let key = path_compare_key(root);
    if let Ok(mut roots) = self.migrating_roots.lock() {
      roots.insert(key.clone());
    }
    if let Ok(mut cancel) = self.migration_cancel.lock() {
      cancel.insert(key, Arc::new(AtomicBool::new(false)));
    }
  }

  pub fn end_migration(&self, root: &str) {
    let key = path_compare_key(root);
    if let Ok(mut roots) = self.migrating_roots.lock() {
      roots.remove(&key);
    }
    if let Ok(mut cancel) = self.migration_cancel.lock() {
      cancel.remove(&key);
    }
  }

  pub fn cancel_migration(&self, root: &str) -> Result<(), String> {
    let key = path_compare_key(root);
    let cancel = self
      .migration_cancel
      .lock()
      .map_err(|_| "Migration cancel state unavailable".to_string())?;
    let Some(flag) = cancel.get(&key) else {
      return Err("WORKSPACE_NOT_MIGRATING".to_string());
    };
    flag.store(true, Ordering::Release);
    Ok(())
  }

  pub fn migration_cancel_token(&self, root: &str) -> Option<Arc<AtomicBool>> {
    let key = path_compare_key(root);
    self
      .migration_cancel
      .lock()
      .ok()
      .and_then(|cancel| cancel.get(&key).cloned())
  }

  pub fn is_migration_cancelled(token: &Arc<AtomicBool>) -> bool {
    token.load(Ordering::Acquire)
  }

  fn is_migrating(&self, root: &str) -> bool {
    self
      .migrating_roots
      .lock()
      .ok()
      .map(|roots| roots.contains(&path_compare_key(root)))
      .unwrap_or(false)
  }

  pub fn lock_root(&self, root: &str) {
    if let Ok(mut keys) = self.unlocked_keys.lock() {
      if let Some(mut key) = keys.remove(&path_compare_key(root)) {
        key.fill(0);
      }
    }
  }

  pub fn unlock_root(&self, root: &str, key: [u8; 32]) {
    if let Ok(mut keys) = self.unlocked_keys.lock() {
      keys.insert(path_compare_key(root), key);
    }
  }

  pub fn is_unlocked(&self, root: &str) -> bool {
    self
      .unlocked_keys
      .lock()
      .ok()
      .map(|keys| keys.contains_key(&path_compare_key(root)))
      .unwrap_or(false)
  }

  fn key_for_root(&self, root: &str) -> Option<[u8; 32]> {
    self
      .unlocked_keys
      .lock()
      .ok()
      .and_then(|keys| keys.get(&path_compare_key(root)).copied())
  }
}

pub fn workspace_id_from_root(root: &str) -> String {
  path_compare_key(root)
    .chars()
    .map(|ch| {
      if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
        ch
      } else {
        '_'
      }
    })
    .collect()
}

fn path_compare_key(path: &str) -> String {
  let mut s = path.trim().replace('\\', "/");
  if s.starts_with("//?/") {
    s = s[4..].to_string();
  } else if s.starts_with("\\\\?\\") {
    s = s[4..].to_string();
  }
  while s.ends_with('/') {
    s.pop();
  }
  if s.len() >= 2 && s.as_bytes()[1] == b':' {
    s = s.to_ascii_lowercase();
  } else if s.starts_with("//") {
    s = s.to_ascii_lowercase();
  }
  s
}

fn encryption_meta_path(root: &str) -> Result<PathBuf, String> {
  let id = workspace_id_from_root(root);
  Ok(
    luna_paths::get_state_path()?
      .join("workspace-encryption")
      .join(format!("{id}.json")),
  )
}

fn canonical_password(password: &str) -> &str {
  password.trim()
}

fn validate_password(password: &str) -> Result<(), String> {
  let trimmed = canonical_password(password);
  if trimmed.len() < MIN_PASSWORD_LEN {
    return Err(format!(
      "Password must be at least {MIN_PASSWORD_LEN} characters"
    ));
  }
  Ok(())
}

fn derive_key(password: &str, salt: &[u8; SALT_LEN]) -> Result<[u8; 32], String> {
  let params = Params::new(19_456, 2, 1, None).map_err(|e| e.to_string())?;
  let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
  let mut key = [0u8; 32];
  argon
    .hash_password_into(password.as_bytes(), salt, &mut key)
    .map_err(|e| format!("Key derivation failed: {e}"))?;
  Ok(key)
}

fn derive_key_from_user_password(password: &str, salt: &[u8; SALT_LEN]) -> Result<[u8; 32], String> {
  derive_key(canonical_password(password), salt)
}

fn key_matches_verify_token(key: &[u8; 32], expected: &[u8]) -> Result<bool, String> {
  let actual = create_verify_token(key);
  let expected_bytes = base64::engine::general_purpose::STANDARD
    .decode(expected)
    .map_err(|e| format!("Invalid verification token: {e}"))?;
  Ok(expected_bytes.len() == VERIFY_TOKEN_LEN && actual.as_slice() == expected_bytes.as_slice())
}

fn create_verify_token(key: &[u8; 32]) -> [u8; VERIFY_TOKEN_LEN] {
  let mut mac = <HmacSha256 as Mac>::new_from_slice(key)
    .expect("HMAC accepts any key length up to block size");
  mac.update(VERIFY_MESSAGE);
  let result = mac.finalize().into_bytes();
  let mut token = [0u8; VERIFY_TOKEN_LEN];
  token.copy_from_slice(&result[..VERIFY_TOKEN_LEN]);
  token
}

fn verify_password(password: &str, salt: &[u8; SALT_LEN], expected: &[u8]) -> Result<[u8; 32], String> {
  let trimmed = canonical_password(password);
  let trimmed_key = derive_key(trimmed, salt)?;
  if key_matches_verify_token(&trimmed_key, expected)? {
    return Ok(trimmed_key);
  }
  if trimmed != password {
    let raw_key = derive_key(password, salt)?;
    if key_matches_verify_token(&raw_key, expected)? {
      return Ok(raw_key);
    }
  }
  Err("Incorrect password".to_string())
}

pub fn is_encrypted_payload(data: &[u8]) -> bool {
  data.len() >= MAGIC.len() + NONCE_LEN && data.starts_with(MAGIC)
}

pub fn encrypt_content(key: &[u8; 32], plaintext: &str) -> Result<Vec<u8>, String> {
  security::ensure_note_payload_size(plaintext.as_bytes(), "note")?;
  encrypt_bytes(key, plaintext.as_bytes())
}

pub fn encrypt_bytes(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
  security::ensure_binary_payload_size(plaintext, "encrypted file")?;
  let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
  let mut nonce_bytes = [0u8; NONCE_LEN];
  rand::thread_rng().fill_bytes(&mut nonce_bytes);
  let nonce = Nonce::from_slice(&nonce_bytes);
  let ciphertext = cipher
    .encrypt(nonce, plaintext)
    .map_err(|e| format!("Encryption failed: {e}"))?;
  let mut out = Vec::with_capacity(MAGIC.len() + NONCE_LEN + ciphertext.len());
  out.extend_from_slice(MAGIC);
  out.extend_from_slice(&nonce_bytes);
  out.extend_from_slice(&ciphertext);
  Ok(out)
}

pub fn decrypt_bytes(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, String> {
  if !is_encrypted_payload(data) {
    return Err("File is not encrypted".to_string());
  }
  let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
  let nonce = Nonce::from_slice(&data[MAGIC.len()..MAGIC.len() + NONCE_LEN]);
  let ciphertext = &data[MAGIC.len() + NONCE_LEN..];
  let plaintext = cipher
    .decrypt(nonce, ciphertext)
    .map_err(|_| "Decryption failed (incorrect password or corrupted file)".to_string())?;
  security::ensure_binary_payload_size(&plaintext, "encrypted file")?;
  Ok(plaintext)
}

pub fn decrypt_content(key: &[u8; 32], data: &[u8]) -> Result<String, String> {
  let plaintext = decrypt_bytes(key, data)?;
  security::ensure_note_payload_size(&plaintext, "note")?;
  String::from_utf8(plaintext).map_err(|e| format!("Decrypted content is not valid UTF-8: {e}"))
}

pub(crate) fn encode_sidecar_bytes(plaintext: &[u8], key: Option<&[u8; 32]>) -> Result<Vec<u8>, String> {
  if let Some(key) = key {
    return encrypt_bytes(key, plaintext);
  }
  Ok(plaintext.to_vec())
}

pub(crate) fn decode_sidecar_bytes(data: &[u8], key: Option<&[u8; 32]>) -> Result<Vec<u8>, String> {
  if is_encrypted_payload(data) {
    let key = key.ok_or_else(|| "WORKSPACE_LOCKED".to_string())?;
    return decrypt_bytes(key, data);
  }
  Ok(data.to_vec())
}

fn encrypt_sidecar_file(path: &Path, key: &[u8; 32]) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read sidecar: {e}"))?;
  if is_encrypted_payload(&bytes) {
    return Ok(());
  }
  let encrypted = encrypt_bytes(key, &bytes)?;
  atomic_io::atomic_write(path, &encrypted).map_err(|e| format!("Failed to encrypt sidecar: {e}"))
}

fn decrypt_sidecar_file(path: &Path, key: &[u8; 32]) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read sidecar: {e}"))?;
  if !is_encrypted_payload(&bytes) {
    return Ok(());
  }
  let plaintext = decrypt_bytes(key, &bytes)?;
  atomic_io::atomic_write(path, &plaintext).map_err(|e| format!("Failed to decrypt sidecar: {e}"))
}

fn reencrypt_sidecar_file(path: &Path, old_key: &[u8; 32], new_key: &[u8; 32]) -> Result<(), String> {
  reencrypt_binary_file_at_path(path, old_key, new_key, false)
}

fn migrate_history_store(root: &str, action: impl Fn(&Path) -> Result<(), String>) -> Result<(), String> {
  for path in luna_paths::list_document_history_store_files(root)? {
    action(&path)?;
  }
  Ok(())
}

pub fn load_metadata(root: &str) -> Result<Option<WorkspaceEncryptionMeta>, String> {
  let path = encryption_meta_path(root)?;
  if !path.is_file() {
    return Ok(None);
  }
  let raw = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read encryption metadata: {e}"))?;
  let meta: WorkspaceEncryptionMeta =
    serde_json::from_str(&raw).map_err(|e| format!("Invalid encryption metadata: {e}"))?;
  if !meta.enabled {
    return Ok(None);
  }
  Ok(Some(meta))
}

fn write_metadata(root: &str, meta: &WorkspaceEncryptionMeta) -> Result<(), String> {
  luna_paths::ensure_luna_dirs()?;
  let path = encryption_meta_path(root)?;
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent)
      .map_err(|e| format!("Failed to create encryption metadata directory: {e}"))?;
  }
  let data = serde_json::to_vec_pretty(meta).map_err(|e| e.to_string())?;
  atomic_io::atomic_write(&path, &data).map_err(|e| e.to_string())
}

fn remove_metadata(root: &str) -> Result<(), String> {
  let path = encryption_meta_path(root)?;
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to remove encryption metadata: {e}"))?;
  }
  Ok(())
}

fn decode_salt(meta: &WorkspaceEncryptionMeta) -> Result<[u8; SALT_LEN], String> {
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(meta.salt.trim())
    .map_err(|e| format!("Invalid salt: {e}"))?;
  if bytes.len() != SALT_LEN {
    return Err("Invalid salt length".to_string());
  }
  let mut salt = [0u8; SALT_LEN];
  salt.copy_from_slice(&bytes);
  Ok(salt)
}

pub fn status_for_root(crypto: &WorkspaceCryptoState, root: &str) -> Result<WorkspaceEncryptionStatus, String> {
  let meta = load_metadata(root)?;
  let enabled = meta.is_some();
  Ok(WorkspaceEncryptionStatus {
    enabled,
    unlocked: enabled && crypto.is_unlocked(root),
    encrypt_images: meta.map(|m| m.encrypt_images).unwrap_or(false),
  })
}

pub fn encrypt_images_enabled(root: &str) -> bool {
  load_metadata(root)
    .ok()
    .flatten()
    .filter(|meta| meta.enabled)
    .map(|meta| meta.encrypt_images)
    .unwrap_or(false)
}

pub fn resolve_crypto_key(
  crypto: &WorkspaceCryptoState,
  root: &str,
) -> Result<Option<[u8; 32]>, String> {
  if load_metadata(root)?.is_none() {
    return Ok(None);
  }
  if crypto.is_migrating(root) {
    return Err("WORKSPACE_MIGRATING".to_string());
  }
  crypto
    .key_for_root(root)
    .ok_or_else(|| "WORKSPACE_LOCKED".to_string())
    .map(Some)
}

pub fn unlock_workspace(
  crypto: &WorkspaceCryptoState,
  root: &str,
  password: &str,
) -> Result<(), String> {
  let meta = load_metadata(root)?
    .ok_or_else(|| "Workspace encryption is not enabled".to_string())?;
  let salt = decode_salt(&meta)?;
  let key = verify_password(password, &salt, meta.verify_token.as_bytes())?;
  crypto.unlock_root(root, key);
  Ok(())
}

/// One-time migration: decrypt image attachments that were encrypted by older builds.
pub fn decrypt_legacy_encrypted_images(
  crypto: &WorkspaceCryptoState,
  root: &str,
) -> Result<u32, String> {
  let Some(mut meta) = load_metadata(root)? else {
    return Ok(0);
  };
  if meta.legacy_images_plaintext {
    return Ok(0);
  }
  if meta.encrypt_images {
    return Ok(0);
  }
  let key = resolve_crypto_key(crypto, root)?
    .ok_or_else(|| "WORKSPACE_LOCKED".to_string())?;
  let paths = collect_workspace_file_paths(root, is_image_path)?;
  let mut migrated = 0u32;
  for path in paths {
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read image: {e}"))?;
    if is_encrypted_payload(&bytes) {
      decrypt_binary_file_at_path(&path, &key, false)?;
      migrated += 1;
    }
  }
  meta.legacy_images_plaintext = true;
  write_metadata(root, &meta)?;
  Ok(migrated)
}

pub fn cancel_workspace_encryption_migration(
  crypto: &WorkspaceCryptoState,
  root: &str,
) -> Result<(), String> {
  crypto.cancel_migration(root)
}

pub fn lock_workspace(crypto: &WorkspaceCryptoState, root: &str) {
  crypto.lock_root(root);
}

const IMAGE_EXTS: &[&str] = &[
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif", "heic", "heif", "svg", "avif", "ico",
];

const MIGRATION_PROGRESS_INTERVAL: usize = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationPhase {
  Encrypting,
  Decrypting,
  Reencrypting,
}

impl MigrationPhase {
  pub fn as_str(self) -> &'static str {
    match self {
      Self::Encrypting => "encrypting",
      Self::Decrypting => "decrypting",
      Self::Reencrypting => "reencrypting",
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrationProgress {
  pub phase: MigrationPhase,
  pub processed: u32,
  pub total: u32,
}

pub type MigrationProgressReporter = Option<Arc<dyn Fn(MigrationProgress) + Send + Sync>>;

fn collect_encryptable_paths(root: &str) -> Result<Vec<PathBuf>, String> {
  collect_workspace_file_paths(root, is_markdown_path)
}

fn collect_decryptable_paths(root: &str) -> Result<Vec<PathBuf>, String> {
  collect_workspace_file_paths(root, is_decryptable_workspace_path)
}

fn migration_progress_callback(
  reporter: &MigrationProgressReporter,
  phase: MigrationPhase,
) -> parallel_batch::ParallelProgressCallback {
  reporter.as_ref().map(|report| {
    let report = Arc::clone(report);
    Arc::new(move |processed: usize, total: usize| {
      if processed == 0
        || processed == total
        || processed % MIGRATION_PROGRESS_INTERVAL == 0
      {
        report(MigrationProgress {
          phase,
          processed: processed as u32,
          total: total as u32,
        });
      }
    }) as Arc<dyn Fn(usize, usize) + Send + Sync>
  })
}

fn migrate_encryptable_paths(
  crypto: &WorkspaceCryptoState,
  root: &str,
  paths: &[PathBuf],
  phase: MigrationPhase,
  reporter: &MigrationProgressReporter,
  op: Arc<dyn Fn(&Path) -> Result<(), String> + Send + Sync>,
) -> Result<(), String> {
  parallel_batch::parallel_for_each_paths(
    paths,
    migration_progress_callback(reporter, phase),
    crypto.migration_cancel_token(root),
    op,
  )
}

fn rollback_encryptable_paths(paths: &[PathBuf], key: &[u8; 32]) {
  for path in paths {
    if let Ok(bytes) = std::fs::read(path) {
      if is_encrypted_payload(&bytes) {
        let _ = decrypt_file_at_path(path, key, true);
      }
    }
  }
}

fn collect_workspace_file_paths(
  root: &str,
  matcher: fn(&Path) -> bool,
) -> Result<Vec<PathBuf>, String> {
  let root_path = security::ensure_listable_workspace_root(root)?;
  let mut paths = Vec::new();
  for entry in WalkDir::new(&root_path).into_iter().filter_map(Result::ok) {
    let path = entry.path();
    if path.is_file() && matcher(path) {
      paths.push(path.to_path_buf());
    }
  }
  Ok(paths)
}

#[cfg(test)]
pub fn enable_workspace_encryption(
  crypto: &WorkspaceCryptoState,
  root: &str,
  password: &str,
) -> Result<(), String> {
  enable_workspace_encryption_with_progress(crypto, root, password, None)
}

pub fn enable_workspace_encryption_with_progress(
  crypto: &WorkspaceCryptoState,
  root: &str,
  password: &str,
  reporter: MigrationProgressReporter,
) -> Result<(), String> {
  validate_password(password)?;
  if load_metadata(root)?.is_some() {
    return Err("Workspace encryption is already enabled".to_string());
  }
  crypto.begin_migration(root);
  let mut derived_key: Option<[u8; 32]> = None;
  let mut encrypted_paths: Vec<PathBuf> = Vec::new();
  let result = (|| {
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    let key = derive_key_from_user_password(password, &salt)?;
    derived_key = Some(key);
    let verify_token = create_verify_token(&key);
    let paths = collect_encryptable_paths(root)?;
    encrypted_paths = paths.clone();
    let key_for_files = key;
    migrate_encryptable_paths(
      crypto,
      root,
      &paths,
      MigrationPhase::Encrypting,
      &reporter,
      Arc::new(move |path| encrypt_file_at_path(path, &key_for_files, true)),
    )?;
    migrate_history_store(root, |path| encrypt_sidecar_file(path, &key))?;
    let meta = WorkspaceEncryptionMeta {
      version: 1,
      enabled: true,
      salt: base64::engine::general_purpose::STANDARD.encode(salt),
      verify_token: base64::engine::general_purpose::STANDARD.encode(verify_token),
      legacy_images_plaintext: false,
      encrypt_images: false,
    };
    write_metadata(root, &meta)?;
    crypto.unlock_root(root, key);
    Ok(())
  })();
  if let Err(err) = result {
    if let Some(key) = derived_key {
      rollback_encryptable_paths(&encrypted_paths, &key);
      let _ = migrate_history_store(root, |path| decrypt_sidecar_file(path, &key));
      crypto.lock_root(root);
      let _ = remove_metadata(root);
    }
    crypto.end_migration(root);
    return Err(err);
  }
  crypto.end_migration(root);
  Ok(())
}

#[cfg(test)]
pub fn disable_workspace_encryption(
  crypto: &WorkspaceCryptoState,
  root: &str,
  password: &str,
) -> Result<(), String> {
  disable_workspace_encryption_with_progress(crypto, root, password, None)
}

pub fn disable_workspace_encryption_with_progress(
  crypto: &WorkspaceCryptoState,
  root: &str,
  password: &str,
  reporter: MigrationProgressReporter,
) -> Result<(), String> {
  crypto.begin_migration(root);
  let result = (|| {
    let meta = load_metadata(root)?
      .ok_or_else(|| "Workspace encryption is not enabled".to_string())?;
    let salt = decode_salt(&meta)?;
    let key = verify_password(password, &salt, meta.verify_token.as_bytes())?;

    let paths = collect_decryptable_paths(root)?;
    let key_for_files = key;
    migrate_encryptable_paths(
      crypto,
      root,
      &paths,
      MigrationPhase::Decrypting,
      &reporter,
      Arc::new(move |path| decrypt_file_at_path(path, &key_for_files, true)),
    )?;
    migrate_history_store(root, |path| decrypt_sidecar_file(path, &key))?;

    remove_metadata(root)?;
    crypto.lock_root(root);
    Ok(())
  })();
  crypto.end_migration(root);
  result
}

#[cfg(test)]
pub fn change_workspace_encryption_password(
  crypto: &WorkspaceCryptoState,
  root: &str,
  current_password: &str,
  new_password: &str,
) -> Result<(), String> {
  change_workspace_encryption_password_with_progress(
    crypto,
    root,
    current_password,
    new_password,
    None,
  )
}

fn migrate_path_on_password_change(
  path: &Path,
  old_key: &[u8; 32],
  new_key: &[u8; 32],
  bulk: bool,
  encrypt_images: bool,
) -> Result<(), String> {
  if is_markdown_path(path) {
    return reencrypt_file_at_path(path, old_key, new_key, bulk);
  }
  if is_image_path(path) {
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read image: {e}"))?;
    if encrypt_images {
      if is_encrypted_payload(&bytes) {
        return reencrypt_binary_file_at_path(path, old_key, new_key, bulk);
      }
      return encrypt_binary_file_at_path(path, new_key, bulk);
    }
    if is_encrypted_payload(&bytes) {
      return decrypt_binary_file_at_path(path, old_key, bulk);
    }
  }
  Ok(())
}

pub fn change_workspace_encryption_password_with_progress(
  crypto: &WorkspaceCryptoState,
  root: &str,
  current_password: &str,
  new_password: &str,
  reporter: MigrationProgressReporter,
) -> Result<(), String> {
  validate_password(new_password)?;
  crypto.begin_migration(root);
  let result = (|| {
    let meta = load_metadata(root)?
      .ok_or_else(|| "Workspace encryption is not enabled".to_string())?;
    let old_salt = decode_salt(&meta)?;
    let old_key = verify_password(current_password, &old_salt, meta.verify_token.as_bytes())?;

    let mut new_salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut new_salt);
    let new_key = derive_key_from_user_password(new_password, &new_salt)?;
    let verify_token = create_verify_token(&new_key);

    let paths = collect_decryptable_paths(root)?;
    let old_key_for_files = old_key;
    let new_key_for_files = new_key;
    let encrypt_images = meta.encrypt_images;
    migrate_encryptable_paths(
      crypto,
      root,
      &paths,
      MigrationPhase::Reencrypting,
      &reporter,
      Arc::new(move |path| {
        migrate_path_on_password_change(
          path,
          &old_key_for_files,
          &new_key_for_files,
          true,
          encrypt_images,
        )
      }),
    )?;
    migrate_history_store(root, |path| {
      reencrypt_sidecar_file(path, &old_key, &new_key)
    })?;

    let next_meta = WorkspaceEncryptionMeta {
      version: 1,
      enabled: true,
      salt: base64::engine::general_purpose::STANDARD.encode(new_salt),
      verify_token: base64::engine::general_purpose::STANDARD.encode(verify_token),
      legacy_images_plaintext: meta.legacy_images_plaintext,
      encrypt_images: meta.encrypt_images,
    };
    write_metadata(root, &next_meta)?;
    crypto.unlock_root(root, new_key);
    Ok(())
  })();
  crypto.end_migration(root);
  result
}

pub fn read_note_plaintext(root: &str, path: &str, key: Option<&[u8; 32]>) -> Result<String, String> {
  let root_path = PathBuf::from(root);
  let note_path = PathBuf::from(path);
  super::path_safety::ensure_no_parent_dir_components(&note_path)?;
  let resolved = super::path_safety::ensure_under_allowed_root(&note_path, &root_path)?;
  let meta = std::fs::metadata(&resolved).map_err(|e| format!("Failed to read file information: {e}"))?;
  security::ensure_note_file_size(meta.len(), "note")?;
  let bytes = std::fs::read(&resolved).map_err(|e| format!("Failed to read file: {e}"))?;

  if let Some(key) = key {
    if is_encrypted_payload(&bytes) {
      return decrypt_content(key, &bytes);
    }
    String::from_utf8(bytes).map_err(|e| format!("Failed to read file: {e}"))
  } else if is_encrypted_payload(&bytes) {
    Err("WORKSPACE_LOCKED".to_string())
  } else {
    String::from_utf8(bytes).map_err(|e| format!("Failed to read file: {e}"))
  }
}

pub fn write_note_plaintext(
  root: &str,
  _path: &str,
  content: &str,
  key: Option<&[u8; 32]>,
) -> Result<Vec<u8>, String> {
  if load_metadata(root)?.is_some() {
    let key = key.ok_or_else(|| "WORKSPACE_LOCKED".to_string())?;
    return encrypt_content(key, content);
  }
  security::ensure_note_payload_size(content.as_bytes(), "note")?;
  Ok(content.as_bytes().to_vec())
}

pub(crate) fn is_markdown_path(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| {
      let ext_l = ext.to_lowercase();
      ext_l == "md" || ext_l == "markdown"
    })
    .unwrap_or(false)
}

pub(crate) fn is_image_path(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| {
      let ext_l = ext.to_lowercase();
      IMAGE_EXTS.iter().any(|candidate| ext_l == *candidate)
    })
    .unwrap_or(false)
}

fn is_decryptable_workspace_path(path: &Path) -> bool {
  is_markdown_path(path) || is_image_path(path)
}

fn write_encrypted_file(path: &Path, encrypted: &[u8], bulk: bool) -> Result<(), String> {
  if bulk {
    atomic_io::atomic_write_bulk(path, encrypted)
  } else {
    atomic_io::atomic_write(path, encrypted)
  }
  .map_err(|e| format!("Failed to write encrypted file: {e}"))
}

fn write_plain_file(path: &Path, plaintext: &[u8], bulk: bool) -> Result<(), String> {
  if bulk {
    atomic_io::atomic_write_bulk(path, plaintext)
  } else {
    atomic_io::atomic_write(path, plaintext)
  }
  .map_err(|e| format!("Failed to write decrypted file: {e}"))
}

fn encrypt_file_at_path(path: &Path, key: &[u8; 32], bulk: bool) -> Result<(), String> {
  if is_markdown_path(path) {
    encrypt_note_file_at_path(path, key, bulk)
  } else {
    encrypt_binary_file_at_path(path, key, bulk)
  }
}

fn decrypt_file_at_path(path: &Path, key: &[u8; 32], bulk: bool) -> Result<(), String> {
  if is_markdown_path(path) {
    decrypt_note_file_at_path(path, key, bulk)
  } else {
    decrypt_binary_file_at_path(path, key, bulk)
  }
}

fn reencrypt_file_at_path(
  path: &Path,
  old_key: &[u8; 32],
  new_key: &[u8; 32],
  bulk: bool,
) -> Result<(), String> {
  if is_markdown_path(path) {
    reencrypt_note_file_at_path(path, old_key, new_key, bulk)
  } else {
    reencrypt_binary_file_at_path(path, old_key, new_key, bulk)
  }
}

fn encrypt_note_file_at_path(path: &Path, key: &[u8; 32], bulk: bool) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read note for encryption: {e}"))?;
  if is_encrypted_payload(&bytes) {
    return Ok(());
  }
  security::ensure_note_file_size(bytes.len() as u64, "note")?;
  let plaintext = String::from_utf8(bytes).map_err(|e| format!("Note is not valid UTF-8: {e}"))?;
  let encrypted = encrypt_content(key, &plaintext)?;
  write_encrypted_file(path, &encrypted, bulk).map_err(|e| format!("Failed to encrypt note: {e}"))
}

fn encrypt_binary_file_at_path(path: &Path, key: &[u8; 32], bulk: bool) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file for encryption: {e}"))?;
  if is_encrypted_payload(&bytes) {
    return Ok(());
  }
  security::ensure_binary_payload_size(&bytes, "image")?;
  let encrypted = encrypt_bytes(key, &bytes)?;
  write_encrypted_file(path, &encrypted, bulk).map_err(|e| format!("Failed to encrypt file: {e}"))
}

fn decrypt_note_file_at_path(path: &Path, key: &[u8; 32], bulk: bool) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read note for decryption: {e}"))?;
  if !is_encrypted_payload(&bytes) {
    return Ok(());
  }
  let plaintext = decrypt_content(key, &bytes)?;
  write_plain_file(path, plaintext.as_bytes(), bulk).map_err(|e| format!("Failed to decrypt note: {e}"))
}

fn decrypt_binary_file_at_path(path: &Path, key: &[u8; 32], bulk: bool) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file for decryption: {e}"))?;
  if !is_encrypted_payload(&bytes) {
    return Ok(());
  }
  let plaintext = decrypt_bytes(key, &bytes)?;
  write_plain_file(path, &plaintext, bulk).map_err(|e| format!("Failed to decrypt file: {e}"))
}

fn reencrypt_note_file_at_path(
  path: &Path,
  old_key: &[u8; 32],
  new_key: &[u8; 32],
  bulk: bool,
) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read note: {e}"))?;
  let plaintext = if is_encrypted_payload(&bytes) {
    decrypt_content(old_key, &bytes)?
  } else {
    String::from_utf8(bytes).map_err(|e| format!("Note is not valid UTF-8: {e}"))?
  };
  let encrypted = encrypt_content(new_key, &plaintext)?;
  write_encrypted_file(path, &encrypted, bulk).map_err(|e| format!("Failed to re-encrypt note: {e}"))
}

fn reencrypt_binary_file_at_path(
  path: &Path,
  old_key: &[u8; 32],
  new_key: &[u8; 32],
  bulk: bool,
) -> Result<(), String> {
  let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file: {e}"))?;
  let plaintext = if is_encrypted_payload(&bytes) {
    decrypt_bytes(old_key, &bytes)?
  } else {
    bytes
  };
  let encrypted = encrypt_bytes(new_key, &plaintext)?;
  write_encrypted_file(path, &encrypted, bulk).map_err(|e| format!("Failed to re-encrypt file: {e}"))
}

pub fn read_binary_plaintext(
  root: &str,
  path: &str,
  key: Option<&[u8; 32]>,
) -> Result<Vec<u8>, String> {
  let root_path = PathBuf::from(root);
  let note_path = PathBuf::from(path);
  super::path_safety::ensure_no_parent_dir_components(&note_path)?;
  let resolved = super::path_safety::ensure_under_allowed_root(&note_path, &root_path)?;
  let meta = std::fs::metadata(&resolved).map_err(|e| format!("Failed to read file information: {e}"))?;
  security::ensure_note_file_size(meta.len(), "document")?;
  let bytes = std::fs::read(&resolved).map_err(|e| format!("Failed to read file: {e}"))?;
  security::ensure_binary_payload_size(&bytes, "document")?;

  if let Some(key) = key {
    if is_encrypted_payload(&bytes) {
      return decrypt_bytes(key, &bytes);
    }
    Ok(bytes)
  } else if is_encrypted_payload(&bytes) {
    Err("WORKSPACE_LOCKED".to_string())
  } else {
    Ok(bytes)
  }
}

pub fn write_binary_plaintext(
  root: &str,
  _path: &str,
  content: &[u8],
  key: Option<&[u8; 32]>,
) -> Result<Vec<u8>, String> {
  security::ensure_binary_payload_size(content, "document")?;
  if encrypt_images_enabled(root) {
    let key = key.ok_or_else(|| "WORKSPACE_LOCKED".to_string())?;
    return encrypt_bytes(key, content);
  }
  Ok(content.to_vec())
}

pub fn set_workspace_encrypt_images(
  crypto: &WorkspaceCryptoState,
  root: &str,
  enabled: bool,
) -> Result<(), String> {
  let mut meta = load_metadata(root)?
    .ok_or_else(|| "Workspace encryption is not enabled".to_string())?;
  if meta.encrypt_images == enabled {
    return Ok(());
  }
  let key = resolve_crypto_key(crypto, root)?
    .ok_or_else(|| "WORKSPACE_LOCKED".to_string())?;
  let paths = collect_workspace_file_paths(root, is_image_path)?;
  crypto.begin_migration(root);
  let result = (|| {
    for path in paths {
      let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read image: {e}"))?;
      if enabled {
        if !is_encrypted_payload(&bytes) {
          encrypt_binary_file_at_path(&path, &key, false)?;
        }
      } else if is_encrypted_payload(&bytes) {
        decrypt_binary_file_at_path(&path, &key, false)?;
      }
    }
    meta.encrypt_images = enabled;
    if !enabled {
      meta.legacy_images_plaintext = true;
    }
    write_metadata(root, &meta)
  })();
  crypto.end_migration(root);
  result
}

pub fn encrypt_markdown_file_if_needed(path: &Path, key: &[u8; 32]) -> Result<(), String> {
  if !is_markdown_path(path) {
    return Ok(());
  }
  encrypt_note_file_at_path(path, key, false)
}

pub fn import_markdown_into_encrypted_workspace(
  root: &str,
  source: &str,
  key: &[u8; 32],
) -> Result<String, String> {
  let imported = files::import_markdown_file(root, source, None)?;
  let bytes = std::fs::read(&imported).map_err(|e| format!("Failed to read imported note: {e}"))?;
  if !is_encrypted_payload(&bytes) {
    let plaintext = String::from_utf8(bytes).map_err(|e| format!("Imported note is not valid UTF-8: {e}"))?;
    let encrypted = encrypt_content(key, &plaintext)?;
    atomic_io::atomic_write(Path::new(&imported), &encrypted)
      .map_err(|e| format!("Failed to encrypt imported note: {e}"))?;
  }
  Ok(imported)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::core::files;
  use std::ffi::OsString;
  use std::path::{Path, PathBuf};
  use std::sync::{Arc, Mutex, OnceLock};
  use std::thread;
  use uuid::Uuid;

  fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
  }

  struct TempHomeGuard {
    old_home: Option<OsString>,
    old_userprofile: Option<OsString>,
    temp_root: PathBuf,
  }

  impl Drop for TempHomeGuard {
    fn drop(&mut self) {
      match &self.old_home {
        Some(value) => std::env::set_var("HOME", value),
        None => std::env::remove_var("HOME"),
      }
      match &self.old_userprofile {
        Some(value) => std::env::set_var("USERPROFILE", value),
        None => std::env::remove_var("USERPROFILE"),
      }
      let _ = std::fs::remove_dir_all(&self.temp_root);
    }
  }

  fn setup_temp_home() -> (std::sync::MutexGuard<'static, ()>, TempHomeGuard, PathBuf) {
    let guard = env_lock().lock().unwrap_or_else(|err| err.into_inner());
    let old_home = std::env::var_os("HOME");
    let old_userprofile = std::env::var_os("USERPROFILE");
    let base_home = old_home
      .as_ref()
      .map(PathBuf::from)
      .or_else(|| old_userprofile.as_ref().map(PathBuf::from))
      .expect("resolve original home");
    let temp_root = base_home.join(format!(".lunote-encryption-test-{}", Uuid::new_v4()));
    let home = temp_root.join("home");
    let workspace = home.join("workspace");
    std::fs::create_dir_all(&home).expect("create temp home");
    std::fs::create_dir_all(&workspace).expect("create temp workspace");
    std::env::set_var("HOME", &home);
    std::env::set_var("USERPROFILE", &home);
    (
      guard,
      TempHomeGuard {
        old_home,
        old_userprofile,
        temp_root,
      },
      workspace,
    )
  }

  fn root_string(workspace: &Path) -> String {
    workspace.to_string_lossy().to_string()
  }

  fn write_plain_note(workspace: &Path, relative: &str, content: &str) -> PathBuf {
    let path = workspace.join(relative);
    if let Some(parent) = path.parent() {
      std::fs::create_dir_all(parent).expect("create note parent");
    }
    std::fs::write(&path, content).expect("write note");
    path
  }

  fn note_path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
  }

  fn sample_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    for (index, byte) in key.iter_mut().enumerate() {
      *byte = index as u8;
    }
    key
  }

  const TEST_PASSWORD: &str = "test-password-123";

  fn history_dir_for(workspace: &Path) -> PathBuf {
    let root = root_string(workspace);
    let workspace_id: String = root
      .chars()
      .map(|ch| {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
          ch
        } else {
          '_'
        }
      })
      .collect();
    luna_paths::get_history_path()
      .expect("history path")
      .join(workspace_id)
  }

  fn write_plain_history_store(workspace: &Path, index_json: &[u8], snapshot_json: &[u8]) -> (PathBuf, PathBuf) {
    let dir = history_dir_for(workspace);
    let snapshots = dir.join("snapshots");
    std::fs::create_dir_all(&snapshots).expect("create history snapshots dir");
    let index_path = dir.join("index.json");
    let snapshot_path = snapshots.join("snap-1.json");
    std::fs::write(&index_path, index_json).expect("write history index");
    std::fs::write(&snapshot_path, snapshot_json).expect("write history snapshot");
    (index_path, snapshot_path)
  }

  fn disk_contains(path: &Path, needle: &[u8]) -> bool {
    let bytes = std::fs::read(path).expect("read sidecar");
    bytes.windows(needle.len()).any(|window| window == needle)
  }

  #[test]
  fn workspace_encryption_sidecar_plaintext_passthrough_and_locked_ciphertext() {
    let key = sample_key();
    let plaintext = br#"{"title":"sidecar-marker"}"#;
    let encoded = encode_sidecar_bytes(plaintext, Some(&key)).expect("encode sidecar");
    assert!(is_encrypted_payload(&encoded));
    assert!(!encoded.windows(b"sidecar-marker".len()).any(|window| window == b"sidecar-marker"));
    assert_eq!(decode_sidecar_bytes(&encoded, Some(&key)).expect("decode sidecar"), plaintext);
    assert_eq!(
      decode_sidecar_bytes(&encoded, None).expect_err("locked ciphertext"),
      "WORKSPACE_LOCKED"
    );
    assert_eq!(decode_sidecar_bytes(plaintext, None).expect("legacy plaintext"), plaintext);
    assert_eq!(
      decode_sidecar_bytes(plaintext, Some(&key)).expect("legacy plaintext with key"),
      plaintext
    );
  }

  #[test]
  fn workspace_encryption_roundtrip_preserves_utf8_content() {
    let key = sample_key();
    let plaintext = "# 标题\n\n中文内容 📝\n\n- item\n";
    let encrypted = encrypt_content(&key, plaintext).expect("encrypt");
    assert!(is_encrypted_payload(&encrypted));
    let decrypted = decrypt_content(&key, &encrypted).expect("decrypt");
    assert_eq!(decrypted, plaintext);
  }

  #[test]
  fn workspace_encryption_wrong_key_fails_without_corrupting_payload() {
    let key = sample_key();
    let mut wrong_key = key;
    wrong_key[0] ^= 0xff;
    let encrypted = encrypt_content(&key, "# secret\n").expect("encrypt");
    let err = decrypt_content(&wrong_key, &encrypted).expect_err("wrong key must fail");
    assert!(err.contains("Decryption failed"));
    assert!(is_encrypted_payload(&encrypted));
  }

  #[test]
  fn workspace_encryption_tampered_ciphertext_is_rejected() {
    let key = sample_key();
    let mut encrypted = encrypt_content(&key, "# tamper\n").expect("encrypt");
    let last = encrypted.len() - 1;
    encrypted[last] ^= 0x55;
    let err = decrypt_content(&key, &encrypted).expect_err("tampered payload must fail");
    assert!(err.contains("Decryption failed"));
  }

  #[test]
  fn workspace_encryption_enable_encrypts_notes_and_disable_restores_plaintext() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let alpha = write_plain_note(&workspace, "alpha.md", "# alpha\n\nplain body\n");
    let nested = write_plain_note(&workspace, "notes/beta.md", "# beta\n\nnested\n");

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable encryption");

    let alpha_bytes = std::fs::read(&alpha).expect("read alpha");
    let nested_bytes = std::fs::read(&nested).expect("read nested");
    assert!(is_encrypted_payload(&alpha_bytes));
    assert!(is_encrypted_payload(&nested_bytes));

    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    assert_eq!(
      files::read_file(&root, &note_path_string(&alpha), Some(&key)).expect("read alpha"),
      "# alpha\n\nplain body\n"
    );

    lock_workspace(&crypto, &root);
    assert_eq!(
      read_note_plaintext(&root, &note_path_string(&alpha), None).expect_err("locked read"),
      "WORKSPACE_LOCKED"
    );

    unlock_workspace(&crypto, &root, TEST_PASSWORD).expect("unlock");
    disable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("disable encryption");

    let alpha_plain = std::fs::read(&alpha).expect("read alpha plaintext");
    let nested_plain = std::fs::read(&nested).expect("read nested plaintext");
    assert!(!is_encrypted_payload(&alpha_plain));
    assert!(!is_encrypted_payload(&nested_plain));
    assert_eq!(String::from_utf8(alpha_plain).expect("utf8 alpha"), "# alpha\n\nplain body\n");
    assert_eq!(String::from_utf8(nested_plain).expect("utf8 nested"), "# beta\n\nnested\n");
    assert!(load_metadata(&root).expect("load metadata").is_none());
  }

  #[test]
  fn workspace_encryption_enable_encrypts_existing_history_and_disable_restores_plaintext() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    write_plain_note(&workspace, "alpha.md", "# alpha\n");
    let index_json = br#"{"entries":[{"id":"snap-1","title":"history-marker-title"}]}"#;
    let snapshot_json = br#"{"content":"history-marker-body"}"#;
    let (index_path, snapshot_path) = write_plain_history_store(&workspace, index_json, snapshot_json);

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable encryption");

    let index_bytes = std::fs::read(&index_path).expect("read encrypted history index");
    let snapshot_bytes = std::fs::read(&snapshot_path).expect("read encrypted history snapshot");
    assert!(is_encrypted_payload(&index_bytes));
    assert!(is_encrypted_payload(&snapshot_bytes));
    assert!(!disk_contains(&index_path, b"history-marker-title"));
    assert!(!disk_contains(&snapshot_path, b"history-marker-body"));

    disable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("disable encryption");
    assert_eq!(std::fs::read(&index_path).expect("restored index"), index_json);
    assert_eq!(std::fs::read(&snapshot_path).expect("restored snapshot"), snapshot_json);
  }

  #[test]
  fn workspace_encryption_change_password_reencrypts_history() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    write_plain_note(&workspace, "gamma.md", "# gamma\n");
    let index_json = br#"{"entries":[{"id":"snap-1","title":"history-rotate-title"}]}"#;
    let snapshot_json = br#"{"content":"history-rotate-body"}"#;
    let (index_path, snapshot_path) = write_plain_history_store(&workspace, index_json, snapshot_json);
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let old_key = resolve_crypto_key(&crypto, &root)
      .expect("resolve old key")
      .expect("old key present");

    change_workspace_encryption_password(&crypto, &root, TEST_PASSWORD, "new-password-456")
      .expect("change password");

    let index_bytes = std::fs::read(&index_path).expect("read rotated history index");
    let snapshot_bytes = std::fs::read(&snapshot_path).expect("read rotated history snapshot");
    assert!(is_encrypted_payload(&index_bytes));
    assert!(is_encrypted_payload(&snapshot_bytes));
    assert!(decrypt_bytes(&old_key, &index_bytes).is_err());
    assert!(decrypt_bytes(&old_key, &snapshot_bytes).is_err());

    unlock_workspace(&crypto, &root, "new-password-456").expect("unlock with new password");
    let new_key = resolve_crypto_key(&crypto, &root)
      .expect("resolve new key")
      .expect("new key present");
    assert_eq!(
      decode_sidecar_bytes(&index_bytes, Some(&new_key)).expect("decode rotated index"),
      index_json
    );
    assert_eq!(
      decode_sidecar_bytes(&snapshot_bytes, Some(&new_key)).expect("decode rotated snapshot"),
      snapshot_json
    );
  }

  #[test]
  fn workspace_encryption_change_password_reencrypts_notes() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "gamma.md", "# gamma\n\nrotate key\n");
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");

    change_workspace_encryption_password(&crypto, &root, TEST_PASSWORD, "new-password-456")
      .expect("change password");

    assert!(
      unlock_workspace(&crypto, &root, TEST_PASSWORD).is_err(),
      "old password must not unlock after rotation"
    );
    unlock_workspace(&crypto, &root, "new-password-456").expect("unlock with new password");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    assert_eq!(
      files::read_file(&root, &note_path_string(&note), Some(&key)).expect("read note"),
      "# gamma\n\nrotate key\n"
    );
    let bytes = std::fs::read(&note).expect("read encrypted note");
    assert!(is_encrypted_payload(&bytes));
  }

  #[test]
  fn workspace_encryption_unlocks_when_password_has_surrounding_whitespace() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "padded.md", "# padded\n");
    enable_workspace_encryption(&crypto, &root, "  test-password-123  ").expect("enable");

    lock_workspace(&crypto, &root);
    unlock_workspace(&crypto, &root, "test-password-123").expect("unlock trimmed password");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    assert_eq!(
      files::read_file(&root, &note_path_string(&note), Some(&key)).expect("read note"),
      "# padded\n"
    );
  }

  #[test]
  fn workspace_encryption_change_password_reencrypts_images_when_enabled() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "note.md", "# note\n");
    let note_path = note_path_string(&note);
    let asset_bytes = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    let encoded = base64::engine::general_purpose::STANDARD.encode(&asset_bytes);

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    set_workspace_encrypt_images(&crypto, &root, true).expect("enable image encryption");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    files::save_note_asset_file(&root, &note_path, "note.assets/secret.png", &encoded, Some(&key))
      .expect("save encrypted image");
    let asset = workspace.join("note.assets/secret.png");
    assert!(is_encrypted_payload(&std::fs::read(&asset).expect("read encrypted png")));

    change_workspace_encryption_password(&crypto, &root, TEST_PASSWORD, "new-password-456")
      .expect("change password");
    let on_disk = std::fs::read(&asset).expect("read png after rotation");
    assert!(
      is_encrypted_payload(&on_disk),
      "images must stay encrypted after password change when encryptImages is on"
    );

    lock_workspace(&crypto, &root);
    unlock_workspace(&crypto, &root, "new-password-456").expect("unlock with new password");
    let new_key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    let decoded = files::read_file_base64(&root, &asset.to_string_lossy(), Some(&new_key))
      .expect("read png with new key");
    let bytes = base64::engine::general_purpose::STANDARD
      .decode(decoded)
      .expect("decode png base64");
    assert_eq!(bytes, asset_bytes);
  }

  #[test]
  fn workspace_encryption_write_binary_plaintext_rejects_missing_key_when_images_encrypted() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    set_workspace_encrypt_images(&crypto, &root, true).expect("enable image encryption");
    let err = write_binary_plaintext(&root, "note.assets/a.png", &[0x89, 0x50], None)
      .expect_err("missing key must fail closed");
    assert_eq!(err, "WORKSPACE_LOCKED");
  }

  #[test]
  fn workspace_encryption_save_file_writes_encrypted_payload() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note = workspace.join("autosave.md");
    let note_path = note_path_string(&note);
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");

    files::save_file(&root, &note_path, "# autosave\n\nv1\n", None, Some(&key)).expect("save v1");
    let bytes = std::fs::read(&note).expect("read encrypted note");
    assert!(is_encrypted_payload(&bytes));

    files::save_file(&root, &note_path, "# autosave\n\nv2\n", None, Some(&key)).expect("save v2");
    assert_eq!(
      files::read_file(&root, &note_path, Some(&key)).expect("read note"),
      "# autosave\n\nv2\n"
    );
  }

  #[test]
  fn workspace_encryption_rapid_autosave_sequence_never_leaves_plaintext_or_corruption() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note = workspace.join("rapid.md");
    let note_path = note_path_string(&note);
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");

    let mut content = String::from("# rapid\n\n");
    for index in 0..24 {
      content.push_str(&format!("autosave line {index}\n"));
      files::save_file(&root, &note_path, &content, None, Some(&key))
        .unwrap_or_else(|err| panic!("save iteration {index} failed: {err}"));
      let bytes = std::fs::read(&note).expect("read note bytes");
      assert!(
        is_encrypted_payload(&bytes),
        "iteration {index} must remain encrypted on disk"
      );
      let roundtrip = files::read_file(&root, &note_path, Some(&key))
        .unwrap_or_else(|err| panic!("read iteration {index} failed: {err}"));
      assert_eq!(roundtrip, content, "iteration {index} roundtrip mismatch");
    }
  }

  #[test]
  fn workspace_encryption_batch_save_multiple_notes_stays_encrypted() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    let notes_dir = workspace.join("batch-notes");
    std::fs::create_dir_all(&notes_dir).expect("create notes dir");

    for index in 0..12 {
      let note = notes_dir.join(format!("note-{index}.md"));
      let note_path = note_path_string(&note);
      let content = format!("# note {index}\n\nbatch autosave body\n");
      files::save_file(&root, &note_path, &content, None, Some(&key))
        .unwrap_or_else(|err| panic!("batch save {index} failed: {err}"));
      let bytes = std::fs::read(&note).expect("read encrypted note");
      assert!(is_encrypted_payload(&bytes), "note {index} must stay encrypted on disk");
      assert_eq!(
        files::read_file(&root, &note_path, Some(&key)).expect("read note"),
        content
      );
    }
  }

  #[test]
  fn workspace_encryption_concurrent_reads_during_autosave_stay_decryptable() {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note = workspace.join("live-read.md");
    let note_path = note_path_string(&note);
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    files::save_file(&root, &note_path, "# live\n\nseed\n", None, Some(&key)).expect("seed save");

    let stop = Arc::new(AtomicBool::new(false));
    let writer_root = root.clone();
    let writer_path = note_path.clone();
    let writer_stop = Arc::clone(&stop);
    let writer = thread::spawn(move || {
      let mut content = String::from("# live\n\n");
      for index in 0..40 {
        content.push_str(&format!("autosave {index}\n"));
        files::save_file(&writer_root, &writer_path, &content, None, Some(&key))
          .expect("writer save");
        thread::sleep(Duration::from_millis(2));
      }
      writer_stop.store(true, Ordering::Release);
    });

    let mut readers = Vec::new();
    for _ in 0..6 {
      let stop = Arc::clone(&stop);
      let root = root.clone();
      let note_path = note_path.clone();
      readers.push(thread::spawn(move || {
        while !stop.load(Ordering::Acquire) {
          if let Ok(content) = files::read_file(&root, &note_path, Some(&key)) {
            assert!(
              content.starts_with("# live\n\n"),
              "concurrent read returned unexpected content"
            );
          }
          thread::sleep(Duration::from_millis(1));
        }
      }));
    }

    writer.join().expect("join writer");
    for reader in readers {
      reader.join().expect("join reader");
    }

    let bytes = std::fs::read(&note).expect("read final note");
    assert!(is_encrypted_payload(&bytes));
  }

  #[test]
  fn workspace_encryption_locked_workspace_blocks_read_and_key_resolution() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "locked-read.md", "# locked\n\nsecret\n");
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note_path = note_path_string(&note);
    lock_workspace(&crypto, &root);

    assert_eq!(
      resolve_crypto_key(&crypto, &root).expect_err("locked workspace must reject key resolution"),
      "WORKSPACE_LOCKED"
    );
    assert_eq!(
      read_note_plaintext(&root, &note_path, None).expect_err("locked read"),
      "WORKSPACE_LOCKED"
    );

    unlock_workspace(&crypto, &root, TEST_PASSWORD).expect("unlock");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    assert_eq!(
      files::read_file(&root, &note_path, Some(&key)).expect("read after unlock"),
      "# locked\n\nsecret\n"
    );
  }

  #[test]
  fn workspace_encryption_lock_after_unlocked_save_then_unlock_decrypts_latest() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "idle-lock.md", "# original\n");
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note_path = note_path_string(&note);
    let key = resolve_crypto_key(&crypto, &root)
      .expect("resolve key")
      .expect("key present");

    let unsaved = "# original\n\nidle autosave body\n";
    files::save_file(&root, &note_path, unsaved, None, Some(&key)).expect("save before idle lock");

    let ciphertext = std::fs::read(&note).expect("read ciphertext");
    assert!(is_encrypted_payload(&ciphertext));
    assert!(
      !disk_contains(&note, b"idle autosave body"),
      "autosave must not leave unsaved plaintext on disk"
    );

    lock_workspace(&crypto, &root);
    assert_eq!(
      read_note_plaintext(&root, &note_path, None).expect_err("idle lock must drop the key"),
      "WORKSPACE_LOCKED"
    );

    unlock_workspace(&crypto, &root, TEST_PASSWORD).expect("decrypt after idle lock");
    let unlocked_key = resolve_crypto_key(&crypto, &root)
      .expect("resolve key")
      .expect("key present");
    assert_eq!(
      files::read_file(&root, &note_path, Some(&unlocked_key)).expect("read decrypted note"),
      unsaved
    );
  }

  #[test]
  fn workspace_encryption_incorrect_password_does_not_unlock_or_mutate_notes() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "secure.md", "# secure\n\nkeep me\n");
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    lock_workspace(&crypto, &root);
    let before = std::fs::read(&note).expect("read encrypted note");

    let err = unlock_workspace(&crypto, &root, "wrong-password-999").expect_err("wrong password");
    assert_eq!(err, "Incorrect password");
    assert!(!crypto.is_unlocked(&root));

    let after = std::fs::read(&note).expect("read note after failed unlock");
    assert_eq!(before, after, "failed unlock must not mutate note bytes");
  }

  #[test]
  fn workspace_encryption_save_file_without_key_fails_when_enabled() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note = workspace.join("locked-write.md");
    let note_path = note_path_string(&note);
    lock_workspace(&crypto, &root);

    let err = files::save_file(&root, &note_path, "# locked write\n", None, None)
      .expect_err("save without key must fail");
    assert_eq!(err, "WORKSPACE_LOCKED");
  }

  #[test]
  fn workspace_encryption_migration_blocks_resolve_crypto_key() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");

    crypto.begin_migration(&root);
    assert_eq!(
      resolve_crypto_key(&crypto, &root).expect_err("migration must block key resolution"),
      "WORKSPACE_MIGRATING"
    );
    crypto.end_migration(&root);
    assert!(resolve_crypto_key(&crypto, &root).expect("resolve after migration").is_some());
  }

  #[test]
  fn workspace_encryption_encrypt_markdown_file_if_needed_encrypts_plaintext() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note = write_plain_note(&workspace, "imported-plain.md", "# imported\n\nplain\n");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");

    encrypt_markdown_file_if_needed(&note, &key).expect("encrypt imported markdown");
    let bytes = std::fs::read(&note).expect("read encrypted imported note");
    assert!(is_encrypted_payload(&bytes));
    assert_eq!(
      files::read_file(&root, &note_path_string(&note), Some(&key)).expect("read imported note"),
      "# imported\n\nplain\n"
    );
  }

  #[test]
  fn workspace_encryption_import_dropped_file_bytes_encrypts_markdown() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    let payload = files::ImportDroppedFileBytesPayload {
      root: root.clone(),
      dest_dir: root.clone(),
      file_name: "dropped.md".to_string(),
      data_base64: base64::engine::general_purpose::STANDARD.encode("# dropped\n\nimport\n"),
    };

    let dest = files::import_dropped_file_bytes(&payload, Some(&key)).expect("import dropped markdown");
    let bytes = std::fs::read(&dest).expect("read imported file");
    assert!(is_encrypted_payload(&bytes));
    assert_eq!(
      files::read_file(&root, &dest, Some(&key)).expect("read imported note"),
      "# dropped\n\nimport\n"
    );
  }

  #[test]
  fn workspace_encryption_read_file_base64_decrypts_markdown_when_unlocked() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note = workspace.join("binary-read.md");
    let note_path = note_path_string(&note);
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    files::save_file(&root, &note_path, "# binary api\n\nread me\n", None, Some(&key)).expect("save");

    let encoded = files::read_file_base64(&root, &note_path, Some(&key)).expect("read base64");
    let decoded = String::from_utf8(
      base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .expect("decode base64"),
    )
    .expect("utf8 decoded");
    assert_eq!(decoded, "# binary api\n\nread me\n");
  }

  #[test]
  fn workspace_encryption_read_file_base64_blocks_locked_markdown() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let note = workspace.join("binary-locked.md");
    let note_path = note_path_string(&note);
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    files::save_file(&root, &note_path, "# locked binary api\n", None, Some(&key)).expect("save");
    lock_workspace(&crypto, &root);

    assert_eq!(
      files::read_file_base64(&root, &note_path, None).expect_err("locked base64 read"),
      "WORKSPACE_LOCKED"
    );
  }

  #[test]
  fn workspace_encryption_read_file_base64_decrypts_plain_image_in_encrypted_workspace() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let asset = workspace.join("photo.png");
    let asset_bytes = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    std::fs::write(&asset, &asset_bytes).expect("write png");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");

    let encoded = files::read_file_base64(&root, &asset.to_string_lossy(), Some(&key)).expect("read png");
    let decoded = base64::engine::general_purpose::STANDARD
      .decode(encoded)
      .expect("decode png base64");
    assert_eq!(decoded, asset_bytes);
  }

  #[test]
  fn workspace_encryption_read_file_base64_blocks_locked_plain_image() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let asset = workspace.join("legacy-plain.png");
    let asset_bytes = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    std::fs::write(&asset, &asset_bytes).expect("write legacy plain png");
    lock_workspace(&crypto, &root);

    assert_eq!(
      files::read_file_base64(&root, &asset.to_string_lossy(), None).expect_err("locked plain png"),
      "WORKSPACE_LOCKED"
    );
  }

  #[test]
  fn workspace_encryption_enable_keeps_existing_images_plaintext() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let asset = workspace.join("photo.png");
    let asset_bytes = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    std::fs::write(&asset, &asset_bytes).expect("write png");

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");

    let on_disk = std::fs::read(&asset).expect("read png");
    assert!(!is_encrypted_payload(&on_disk), "images must stay plaintext on disk");
    assert_eq!(on_disk, asset_bytes);
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    let decoded = files::read_file_base64(&root, &asset.to_string_lossy(), Some(&key)).expect("read png");
    let bytes = base64::engine::general_purpose::STANDARD
      .decode(decoded)
      .expect("decode png base64");
    assert_eq!(bytes, asset_bytes);
  }

  #[test]
  fn workspace_encryption_set_encrypt_images_requires_workspace_encryption() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();

    let err = set_workspace_encrypt_images(&crypto, &root, true).expect_err("must require encryption");
    assert!(err.contains("Workspace encryption is not enabled"));
  }

  #[test]
  fn workspace_encryption_set_encrypt_images_requires_unlock() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    lock_workspace(&crypto, &root);

    let err = set_workspace_encrypt_images(&crypto, &root, true).expect_err("must require unlock");
    assert_eq!(err, "WORKSPACE_LOCKED");
  }

  #[test]
  fn workspace_encryption_set_encrypt_images_toggles_image_storage() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "note.md", "# note\n");
    let note_path = note_path_string(&note);
    let asset_bytes = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    let encoded = base64::engine::general_purpose::STANDARD.encode(&asset_bytes);

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");

    files::save_note_asset_file(&root, &note_path, "note.assets/paste.png", &encoded, Some(&key))
      .expect("save plaintext image");
    let asset = workspace.join("note.assets/paste.png");
    let on_disk = std::fs::read(&asset).expect("read png");
    assert!(!is_encrypted_payload(&on_disk));
    assert_eq!(on_disk, asset_bytes);

    set_workspace_encrypt_images(&crypto, &root, true).expect("enable image encryption");
    files::save_note_asset_file(&root, &note_path, "note.assets/paste-2.png", &encoded, Some(&key))
      .expect("save encrypted image");
    let encrypted_asset = workspace.join("note.assets/paste-2.png");
    let encrypted_on_disk = std::fs::read(&encrypted_asset).expect("read encrypted png");
    assert!(is_encrypted_payload(&encrypted_on_disk));

    set_workspace_encrypt_images(&crypto, &root, false).expect("disable image encryption");
    let migrated = std::fs::read(&encrypted_asset).expect("read png after disable");
    assert!(!is_encrypted_payload(&migrated));
    assert_eq!(migrated, asset_bytes);
  }

  #[test]
  fn workspace_encryption_enable_without_images_only_encrypts_markdown() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let alpha = write_plain_note(&workspace, "alpha.md", "# alpha\n\nplain body\n");
    let nested = write_plain_note(&workspace, "notes/beta.md", "# beta\n\nnested\n");

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable encryption");

    let alpha_bytes = std::fs::read(&alpha).expect("read alpha");
    let nested_bytes = std::fs::read(&nested).expect("read nested");
    assert!(is_encrypted_payload(&alpha_bytes));
    assert!(is_encrypted_payload(&nested_bytes));

    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    assert_eq!(
      files::read_file(&root, &note_path_string(&alpha), Some(&key)).expect("read alpha"),
      "# alpha\n\nplain body\n"
    );
    assert_eq!(
      files::read_file(&root, &note_path_string(&nested), Some(&key)).expect("read nested"),
      "# beta\n\nnested\n"
    );
  }

  #[test]
  fn workspace_encryption_disable_restores_plaintext_images() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let note = write_plain_note(&workspace, "alpha.md", "# alpha\n\nplain body\n");
    let asset = workspace.join("photo.png");
    let asset_bytes = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    std::fs::write(&asset, &asset_bytes).expect("write png");

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable encryption");
    assert!(is_encrypted_payload(&std::fs::read(&note).expect("read encrypted note")));
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    encrypt_binary_file_at_path(&asset, &key, false).expect("simulate legacy encrypted png");
    assert!(is_encrypted_payload(&std::fs::read(&asset).expect("read encrypted png")));

    disable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("disable encryption");

    let note_plain = std::fs::read(&note).expect("read alpha plaintext");
    let asset_plain = std::fs::read(&asset).expect("read png plaintext");
    assert!(!is_encrypted_payload(&note_plain));
    assert!(!is_encrypted_payload(&asset_plain));
    assert_eq!(String::from_utf8(note_plain).expect("utf8 alpha"), "# alpha\n\nplain body\n");
    assert_eq!(asset_plain, asset_bytes);
    assert!(load_metadata(&root).expect("load metadata").is_none());
  }

  #[test]
  fn workspace_encryption_decrypt_legacy_images_sets_skip_flag() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    let asset = workspace.join("legacy.png");
    let asset_bytes = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    std::fs::write(&asset, &asset_bytes).expect("write png");

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable encryption");
    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    encrypt_binary_file_at_path(&asset, &key, false).expect("simulate legacy encrypted png");

    let migrated = decrypt_legacy_encrypted_images(&crypto, &root).expect("migrate legacy images");
    assert_eq!(migrated, 1);
    assert!(!is_encrypted_payload(&std::fs::read(&asset).expect("read migrated png")));

    let meta = load_metadata(&root).expect("load metadata").expect("metadata present");
    assert!(meta.legacy_images_plaintext, "migration must persist skip flag");

    let migrated_again = decrypt_legacy_encrypted_images(&crypto, &root).expect("second migration noop");
    assert_eq!(migrated_again, 0);
  }

  #[test]
  fn workspace_encryption_enable_scales_to_many_notes() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();

    for index in 0..150 {
      write_plain_note(
        &workspace,
        &format!("notes/batch-{index}.md"),
        &format!("# note {index}\n\nbatch encryption body\n"),
      );
    }

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable many notes");

    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    for index in 0..150 {
      let path = workspace.join(format!("notes/batch-{index}.md"));
      let bytes = std::fs::read(&path).unwrap_or_else(|err| panic!("read note {index}: {err}"));
      assert!(is_encrypted_payload(&bytes), "note {index} must be encrypted");
      assert_eq!(
        files::read_file(&root, &note_path_string(&path), Some(&key)).expect("read note"),
        format!("# note {index}\n\nbatch encryption body\n")
      );
    }
  }

  #[test]
  fn workspace_encryption_migration_progress_reports_totals() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();
    for index in 0..3 {
      write_plain_note(
        &workspace,
        &format!("progress-{index}.md"),
        &format!("# progress {index}\n"),
      );
    }

    let snapshots = Arc::new(Mutex::new(Vec::new()));
    let snapshots_for_cb = Arc::clone(&snapshots);
    enable_workspace_encryption_with_progress(
      &crypto,
      &root,
      TEST_PASSWORD,
      Some(Arc::new(move |progress| {
        snapshots_for_cb.lock().expect("lock snapshots").push(progress);
      })),
    )
    .expect("enable with progress");

    let snapshots = snapshots.lock().expect("lock snapshots");
    assert!(!snapshots.is_empty());
    assert_eq!(snapshots.last().map(|p| p.total), Some(3));
    assert_eq!(snapshots.last().map(|p| p.processed), Some(3));
    assert_eq!(
      snapshots.last().map(|p| p.phase),
      Some(MigrationPhase::Encrypting)
    );
  }

  #[test]
  fn workspace_encryption_enable_uses_parallel_batch_for_large_workspaces() {
    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = WorkspaceCryptoState::new();

    for index in 0..64 {
      write_plain_note(
        &workspace,
        &format!("parallel/batch-{index}.md"),
        &format!("# parallel {index}\n\nbody\n"),
      );
    }

    enable_workspace_encryption(&crypto, &root, TEST_PASSWORD).expect("enable parallel batch");

    let key = resolve_crypto_key(&crypto, &root).expect("resolve key").expect("key present");
    for index in 0..64 {
      let path = workspace.join(format!("parallel/batch-{index}.md"));
      assert!(is_encrypted_payload(&std::fs::read(&path).expect("read note")));
      assert_eq!(
        files::read_file(&root, &note_path_string(&path), Some(&key)).expect("read note"),
        format!("# parallel {index}\n\nbody\n")
      );
    }
  }

  #[test]
  fn workspace_encryption_enable_cancel_rolls_back_without_metadata() {
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    let (_env_guard, _temp_home, workspace) = setup_temp_home();
    let root = root_string(&workspace);
    let crypto = Arc::new(WorkspaceCryptoState::new());
    for index in 0..128 {
      write_plain_note(
        &workspace,
        &format!("cancel/batch-{index}.md"),
        &format!("# cancel {index}\n\nbody\n"),
      );
    }
    let first = workspace.join("cancel/batch-0.md");
    let crypto_for_thread = Arc::clone(&crypto);
    let root_for_thread = root.clone();
    let handle = thread::spawn(move || {
      enable_workspace_encryption(&crypto_for_thread, &root_for_thread, TEST_PASSWORD)
    });
    for _ in 0..200 {
      if cancel_workspace_encryption_migration(crypto.as_ref(), &root).is_ok() {
        break;
      }
      thread::sleep(Duration::from_millis(5));
    }
    let result = handle.join().expect("join enable thread");
    assert!(result.is_err(), "cancelled enable must fail");
    assert!(
      result.unwrap_err().contains(parallel_batch::WORKSPACE_MIGRATION_CANCELLED),
      "cancel error must surface"
    );
    assert!(
      load_metadata(&root).expect("load metadata").is_none(),
      "metadata must not be written when cancelled"
    );
    let bytes = std::fs::read(&first).expect("read first note");
    assert!(
      !is_encrypted_payload(&bytes),
      "rolled-back note must remain plaintext"
    );
  }
}
