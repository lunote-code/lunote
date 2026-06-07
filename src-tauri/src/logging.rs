use std::panic;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use log::{LevelFilter, Log, Metadata, Record, SetLoggerError};

use crate::luna_paths;

static FILE_LOGGER: LunaFileLogger = LunaFileLogger;
static LOG_LEVEL: OnceLock<LevelFilter> = OnceLock::new();

struct LunaFileLogger;

impl Log for LunaFileLogger {
  fn enabled(&self, metadata: &Metadata<'_>) -> bool {
    metadata.level() <= current_log_level()
  }

  fn log(&self, record: &Record<'_>) {
    if !self.enabled(record.metadata()) {
      return;
    }
    let line = format!(
      "[{}] [{}] {}",
      log_timestamp(),
      record.level(),
      record.args()
    );
    let _ = luna_paths::append_log_line("rust.log", &line);
    #[cfg(debug_assertions)]
    eprintln!("{line}");
  }

  fn flush(&self) {}
}

fn current_log_level() -> LevelFilter {
  *LOG_LEVEL.get().unwrap_or(&LevelFilter::Info)
}

pub fn log_timestamp() -> String {
  let millis = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  format!("{millis}")
}

pub fn init_file_logger(level: LevelFilter) -> Result<(), SetLoggerError> {
  let _ = LOG_LEVEL.set(level);
  log::set_max_level(level);
  log::set_logger(&FILE_LOGGER)
}

pub fn install_panic_hook() {
  let default_hook = panic::take_hook();
  panic::set_hook(Box::new(move |info| {
    let location = info
      .location()
      .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
      .unwrap_or_else(|| "unknown".to_string());
    let message = info
      .payload()
      .downcast_ref::<&str>()
      .map(|s| (*s).to_string())
      .or_else(|| {
        info
          .payload()
          .downcast_ref::<String>()
          .map(|s| s.clone())
      })
      .unwrap_or_else(|| "panic without message".to_string());
    let line = format!(
      "[{}] [PANIC] {message} (at {location})",
      log_timestamp()
    );
    let _ = luna_paths::append_log_line("crash.log", &line);
    default_hook(info);
  }));
}

pub fn log_startup_banner() {
  let version = env!("CARGO_PKG_VERSION");
  let build = if cfg!(debug_assertions) {
    "debug"
  } else {
    "release"
  };
  let line = format!(
    "[{}] [INFO] Lunote started (version {version}, build {build})",
    log_timestamp()
  );
  let _ = luna_paths::append_log_line("app.log", &line);
  let _ = luna_paths::append_log_line("rust.log", &line);
}
