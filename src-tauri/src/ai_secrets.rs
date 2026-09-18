use keyring::Entry;

pub const AI_KEYRING_SERVICE: &str = "com.lunote.app.ai";
const AI_KEYRING_ACCOUNT: &str = "api_key";

fn ai_key_entry() -> Result<Entry, String> {
  Entry::new(AI_KEYRING_SERVICE, AI_KEYRING_ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_ai_api_key() -> Result<Option<String>, String> {
  let entry = ai_key_entry()?;
  match entry.get_password() {
    Ok(key) => {
      let trimmed = key.trim();
      if trimmed.is_empty() {
        Ok(None)
      } else {
        Ok(Some(trimmed.to_string()))
      }
    }
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub fn set_ai_api_key(key: String) -> Result<(), String> {
  let trimmed = key.trim();
  let entry = ai_key_entry()?;
  if trimmed.is_empty() {
    match entry.delete_credential() {
      Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
      Err(e) => Err(e.to_string()),
    }
  } else {
    entry.set_password(trimmed).map_err(|e| e.to_string())
  }
}

#[tauri::command]
pub fn delete_ai_api_key() -> Result<(), String> {
  let entry = ai_key_entry()?;
  match entry.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub fn has_ai_api_key() -> bool {
  get_ai_api_key()
    .ok()
    .flatten()
    .map(|key| !key.is_empty())
    .unwrap_or(false)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn ai_keyring_account_is_stable() {
    assert_eq!(AI_KEYRING_ACCOUNT, "api_key");
  }
}
