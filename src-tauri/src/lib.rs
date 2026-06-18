mod app_settings;
mod chrome_candidates;
mod clipboard;
mod commands;
mod core;
mod logging;
mod luna_paths;
mod pdf_render;
mod theme;
mod theme_migration;
mod plugins;
mod app_menu;
mod mac_boot_menu;
mod mac_menu_template;
mod mac_window;

pub(crate) use app_menu::handle_native_shell_menu;

use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::image::Image;
use tauri::{AppHandle, Emitter, Manager, RunEvent, Runtime, WindowEvent};

pub fn raise_main_window<R: Runtime>(app: &AppHandle<R>) {
  #[cfg(target_os = "macos")]
  {
    let _ = app.show();
  }
  if let Some(win) = app.get_webview_window("main") {
    let _ = win.unminimize();
    let _ = win.show();
    #[cfg(target_os = "windows")]
    {
      let _ = win.set_always_on_top(true);
      let _ = win.set_always_on_top(false);
    }
    let _ = win.set_focus();
  }
}

fn handle_run_event<R: Runtime>(app: &AppHandle<R>, event: RunEvent) {
  #[cfg(target_os = "macos")]
  if let RunEvent::Reopen { .. } = event {
    raise_main_window(app);
  }
  #[cfg(not(target_os = "macos"))]
  let _ = event;
}

/// Deliver `app-menu` to the front end: priority is given to the current focus window to avoid repeated processing of multiple WebViews.
fn emit_app_menu<R: Runtime>(app: &AppHandle<R>, payload: serde_json::Value) {
  let wins = app.webview_windows();
  if wins.is_empty() {
    let _ = app.emit("app-menu", payload);
    return;
  }
  let focused = wins
    .iter()
    .find_map(|(_, w)| w.is_focused().ok().filter(|&f| f).map(|_| w.clone()));
  if let Some(win) = focused {
    let _ = win.emit("app-menu", payload);
    return;
  }
  if let Some(win) = app.get_webview_window("main") {
    let _ = win.emit("app-menu", payload);
    return;
  }
  if let Some((_, w)) = wins.iter().next() {
    let _ = w.emit("app-menu", payload);
  }
}

/// Help menu external links
const HELP_URL_PRIVACY: &str = "https://github.com/lunote-code/lunote#local-first-by-design";
const HELP_URL_WEBSITE: &str = "https://github.com/lunote-code/lunote";
const HELP_URL_FEEDBACK: &str = "https://github.com/lunote-code/lunote/issues/new/choose";

pub struct AppState {
  pub search_conn: Mutex<Connection>,
  pub indexed_root: Mutex<Option<String>>,
  pub note_index_fingerprints: Mutex<HashMap<String, (u64, u64)>>,
  /// Serialize index_notes to avoid concurrent FTS rebuilds.
  pub index_notes_lock: Mutex<()>,
}

/// Path list synchronized with the "File → Recent Files" submenu (full path, consistent with front-end localStorage)
pub struct RecentMenuPaths(pub Mutex<Vec<String>>);

/// List of file names synchronized with the "Theme → Theme/*.css" sub-item (consistent with the front-end scan results)
pub struct ThemeMenuCssNames(pub Mutex<Vec<String>>);

/// Runtime guard: only hide the main window when a tray entry is actually available.
pub struct CloseToTrayState(pub Mutex<bool>);

#[cfg(not(target_os = "macos"))]
fn close_to_tray_ready<R: Runtime>(app: &AppHandle<R>) -> bool {
  app
    .try_state::<CloseToTrayState>()
    .and_then(|state| state.0.lock().ok().map(|ready| *ready))
    .unwrap_or(false)
}

fn close_to_tray_allowed<R: Runtime>(app: &AppHandle<R>, settings: &app_settings::AppSettings) -> bool {
  if !settings.close_to_tray_enabled() {
    return false;
  }
  #[cfg(target_os = "macos")]
  {
    let _ = app;
    return true;
  }
  #[cfg(not(target_os = "macos"))]
  {
    close_to_tray_ready(app)
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  logging::install_panic_hook();
  tauri::Builder::default()
    .enable_macos_default_menu(false)
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      raise_main_window(app);
    }))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_dialog::init())
    .on_window_event(|window, event| {
      if window.label() != "main" {
        return;
      }
      if let WindowEvent::CloseRequested { api, .. } = event {
        let settings = app_settings::read_app_settings(window.app_handle());
        if close_to_tray_allowed(window.app_handle(), &settings) {
          api.prevent_close();
          let _ = window.hide();
        }
      }
    })
    .setup(|app| {
      #[cfg(not(any(target_os = "android", target_os = "ios")))]
      app.handle()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
      logging::init_file_logger(log::LevelFilter::Info)?;

      let conn = Connection::open_in_memory()?;
      luna_paths::ensure_luna_dirs()?;
      logging::log_startup_banner();
      core::search::init_schema(&conn)?;
      app.manage(AppState {
        search_conn: Mutex::new(conn),
        indexed_root: Mutex::new(None),
        note_index_fingerprints: Mutex::new(HashMap::new()),
        index_notes_lock: Mutex::new(()),
      });
      app.manage(core::workspace_watch::WorkspaceWatchState::new());
      app.manage(RecentMenuPaths(Mutex::new(Vec::new())));
      app.manage(ThemeMenuCssNames(Mutex::new(Vec::new())));
      app.manage(CloseToTrayState(Mutex::new(false)));

      #[cfg(target_os = "macos")]
      if let Err(e) = mac_boot_menu::install_startup_menu(app.handle()) {
        log::error!("macOS boot menu install failed: {e}");
      }

      if let Some(win) = app.get_webview_window("main") {
        mac_window::configure_native_centered_titlebar(&win);
        let icon_bytes = include_bytes!("../icons/32x32.png");
        if let Ok(icon) = Image::from_bytes(icon_bytes) {
          if let Err(e) = win.set_icon(icon) {
            log::warn!("set window icon: {e}");
          }
        } else {
          log::warn!("decode window icon PNG failed");
        }
      }

      app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        if handle_native_shell_menu(app, id) {
          return;
        }
        if id == "theme-open-folder" {
          let _ = theme::reveal_theme_directory(app.clone());
          return;
        }
        if id == "theme-refresh-css-list" {
          emit_app_menu(
            app,
            serde_json::json!({ "action": "theme-refresh-css-list" }),
          );
          return;
        }
        if id == "help-privacy" {
          emit_app_menu(
            app,
            serde_json::json!({ "action": "help-open-url", "url": HELP_URL_PRIVACY }),
          );
          return;
        }
        if id == "help-website" {
          emit_app_menu(
            app,
            serde_json::json!({ "action": "help-open-url", "url": HELP_URL_WEBSITE }),
          );
          return;
        }
        if id == "help-feedback" {
          emit_app_menu(
            app,
            serde_json::json!({ "action": "help-open-url", "url": HELP_URL_FEEDBACK }),
          );
          return;
        }
        if let Some(rest) = id.strip_prefix("theme-css-") {
          if let Ok(idx) = rest.parse::<usize>() {
            if let Ok(names) = app.state::<ThemeMenuCssNames>().0.lock() {
              if let Some(n) = names.get(idx) {
                emit_app_menu(
                  app,
                  serde_json::json!({ "action": "theme-css-select", "name": n }),
                );
              }
            }
          }
          return;
        }
        if id == "recent-placeholder" {
          return;
        }
        if let Some(rest) = id.strip_prefix("recent-") {
          if let Ok(idx) = rest.parse::<usize>() {
            let recent_state = app.state::<RecentMenuPaths>();
            let paths = match recent_state.0.lock() {
              Ok(g) => g,
              Err(_) => return,
            };
            if let Some(p) = paths.get(idx) {
              emit_app_menu(
                app,
                serde_json::json!({ "action": "open-recent", "path": p }),
              );
            }
          }
          return;
        }
        if id == "quick-capture-show" || id == "daily-note-open" {
          raise_main_window(app);
        }
        emit_app_menu(app, serde_json::json!({ "action": id }));
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      clipboard::read_clipboard_text,
      clipboard::read_clipboard_image,
      commands::ensure_luna_dirs,
      commands::get_luna_paths,
      commands::read_luna_workspace,
      commands::write_luna_workspace,
      commands::append_luna_log,
      commands::document_history::create_document_snapshot,
      commands::document_history::list_document_snapshots,
      commands::document_history::read_document_snapshot,
      commands::document_history::delete_document_snapshot,
      commands::document_history::delete_all_document_snapshots,
      commands::save_luna_asset_file,
      commands::read_luna_asset_index,
      commands::write_luna_asset_index,
      commands::scan_luna_asset_index,
      commands::path_exists,
      commands::register_workspace_asset_scope,
      commands::watch_workspace,
      commands::unwatch_workspace,
      commands::note_file_stat,
      commands::open_trusted_path,
      commands::open_external_url,
      commands::read_import_files_base64,
      commands::import_external_paths_into_workspace,
      commands::import_dropped_file_bytes,
      commands::workspace_path_is_directory,
      commands::import_markdown_via_dialog,
      commands::list_markdown_files,
      commands::list_workspace_tree,
      commands::read_note,
      commands::save_note,
      commands::save_note_asset,
      commands::note_asset_exists,
      commands::read_workspace_file_base64,
      commands::sync_recent_menu,
      commands::sync_theme_css_menu,
      commands::sync_view_fullscreen_menu_checked,
      commands::set_close_to_tray_ready,
      commands::raise_main_window,
      mac_menu_template::sync_mac_native_menu_icon_templates,
      mac_window::sync_mac_native_titlebar_theme,
      commands::get_app_settings,
      commands::save_app_settings,
      commands::index_notes,
      commands::search_notes,
      commands::delete_note,
      commands::rename_note,
      commands::move_note,
      commands::create_new_note,
      commands::create_note,
      commands::create_new_note_in_parent,
      commands::create_workspace_folder,
      commands::export_note,
      commands::export_note_binary,
      commands::render_html_to_pdf_base64,
      commands::render_html_to_pdf_to_path,
      commands::reveal_in_explorer,
      theme::ensure_theme_directory,
      theme::ensure_theme_snippets_directory,
      theme::ensure_theme_export_directory,
      theme::list_theme_stylesheets,
      theme::list_theme_snippets,
      theme::list_theme_export_styles,
      theme::read_theme_stylesheet,
      theme::read_theme_snippet,
      theme::read_theme_export_style,
      theme::reveal_theme_directory,
      theme::reveal_theme_snippets_directory,
      theme::reveal_theme_export_directory,
      theme::reveal_custom_theme_directory,
      theme::list_custom_theme_files,
      theme::read_custom_theme_json,
      theme::save_custom_theme_json,
      theme::save_theme_stylesheet,
      theme::save_theme_snippet,
      theme::save_theme_export_style,
      theme::delete_theme_stylesheet,
      theme::delete_theme_snippet,
      theme::delete_custom_theme_json,
      plugins::install_plugin_files,
      plugins::list_installed_plugins,
      plugins::read_plugin_manifest,
      plugins::uninstall_plugin
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      handle_run_event(app, event);
    });
}
