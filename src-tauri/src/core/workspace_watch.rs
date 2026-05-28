use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub struct WorkspaceWatchState {
  watchers: Mutex<HashMap<String, RecommendedWatcher>>,
  debounce: Mutex<HashMap<String, Instant>>,
  pending_emit_roots: Mutex<HashSet<String>>,
}

impl WorkspaceWatchState {
  pub fn new() -> Self {
    Self {
      watchers: Mutex::new(HashMap::new()),
      debounce: Mutex::new(HashMap::new()),
      pending_emit_roots: Mutex::new(HashSet::new()),
    }
  }
}

fn should_ignore_event(path: &str) -> bool {
  let normalized = path.replace('\\', "/");
  normalized.contains("/.")
    || normalized.contains("/.luna-write-")
    || normalized.contains("/node_modules/")
    || normalized.contains("/target/")
    || normalized.contains("/dist/")
    || normalized.contains("/.git/")
}

fn schedule_emit<R: Runtime>(app: &AppHandle<R>, root: String) {
  const DEBOUNCE_MS: u64 = 400;
  let state = app.state::<WorkspaceWatchState>();
  {
    let Ok(mut debounce) = state.debounce.lock() else {
      log::warn!("workspace debounce lock poisoned");
      return;
    };
    debounce.insert(root.clone(), Instant::now());
  }
  {
    let Ok(mut pending) = state.pending_emit_roots.lock() else {
      log::warn!("workspace pending emit lock poisoned");
      return;
    };
    if pending.contains(&root) {
      return;
    }
    pending.insert(root.clone());
  }
  let app_handle = app.clone();
  std::thread::spawn(move || {
    loop {
      std::thread::sleep(Duration::from_millis(DEBOUNCE_MS));
      let state = app_handle.state::<WorkspaceWatchState>();
      let should_emit = {
        let Ok(debounce) = state.debounce.lock() else {
          return;
        };
        debounce
          .get(&root)
          .map(|t| t.elapsed() >= Duration::from_millis(DEBOUNCE_MS))
          .unwrap_or(false)
      };
      if should_emit {
        {
          let Ok(mut debounce) = state.debounce.lock() else {
            return;
          };
          debounce.remove(&root);
        }
        {
          let Ok(mut pending) = state.pending_emit_roots.lock() else {
            return;
          };
          pending.remove(&root);
        }
        let _ = app_handle.emit("workspace-changed", serde_json::json!({ "root": root }));
        break;
      }

      let still_pending = {
        let Ok(debounce) = state.debounce.lock() else {
          return;
        };
        debounce.contains_key(&root)
      };
      if !still_pending {
        let Ok(mut pending) = state.pending_emit_roots.lock() else {
          return;
        };
        pending.remove(&root);
        break;
      }
    }
  });
}

pub fn watch_workspace_root<R: Runtime>(app: &AppHandle<R>, root: &str) -> Result<(), String> {
  let trimmed = root.trim();
  if trimmed.is_empty() {
    return Ok(());
  }
  let resolved = super::security::ensure_listable_workspace_root(trimmed)?;
  let key = resolved.to_string_lossy().to_string();
  let state = app.state::<WorkspaceWatchState>();
  let mut watchers = state
    .watchers
    .lock()
    .map_err(|_| "Abnormal monitoring status".to_string())?;
  if watchers.contains_key(&key) {
    return Ok(());
  }

  let app_for_cb = app.clone();
  let root_for_cb = key.clone();
  let mut watcher = RecommendedWatcher::new(
    move |res: Result<notify::Event, notify::Error>| {
      if let Ok(event) = res {
        for path in event.paths {
          let path_str = path.to_string_lossy().to_string();
          if should_ignore_event(&path_str) {
            continue;
          }
          schedule_emit(&app_for_cb, root_for_cb.clone());
          break;
        }
      }
    },
    Config::default(),
  )
  .map_err(|e| format!("Failed to create file listener: {e}"))?;

  watcher
    .watch(&resolved, RecursiveMode::Recursive)
    .map_err(|e| format!("Monitoring workspace failed: {e}"))?;

  watchers.insert(key, watcher);
  Ok(())
}

pub fn unwatch_workspace_root<R: Runtime>(app: &AppHandle<R>, root: &str) -> Result<(), String> {
  let trimmed = root.trim();
  if trimmed.is_empty() {
    return Ok(());
  }
  let resolved = super::security::ensure_listable_workspace_root(trimmed)?;
  let key = resolved.to_string_lossy().to_string();
  let state = app.state::<WorkspaceWatchState>();
  let mut watchers = state
    .watchers
    .lock()
    .map_err(|_| "Abnormal monitoring status".to_string())?;
  watchers.remove(&key);
  let mut debounce = state
    .debounce
    .lock()
    .map_err(|_| "Abnormal monitoring status".to_string())?;
  debounce.remove(&key);
  let mut pending = state
    .pending_emit_roots
    .lock()
    .map_err(|_| "Abnormal monitoring status".to_string())?;
  pending.remove(&key);
  Ok(())
}
