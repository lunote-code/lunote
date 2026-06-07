//!Native handling of macOS/Tauri shell menu items (hide, exit, close window, etc.).
//!The top bar menu has been changed to an in-app React menu; only items where `on_menu_event` may still fire are kept here.

use tauri::{AppHandle, Manager, Runtime};

#[cfg(target_os = "macos")]
fn hide_application<R: Runtime>(app: &AppHandle<R>) {
  let _ = app.hide();
}

#[cfg(not(target_os = "macos"))]
fn hide_application<R: Runtime>(app: &AppHandle<R>) {
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.hide();
    return;
  }
  for w in app.webview_windows().values() {
    let _ = w.hide();
  }
}

#[cfg(target_os = "macos")]
fn show_all_application<R: Runtime>(app: &AppHandle<R>) {
  let _ = app.show();
  for w in app.webview_windows().values() {
    let _ = w.show();
    let _ = w.unminimize();
  }
}

#[cfg(not(target_os = "macos"))]
fn show_all_application<R: Runtime>(app: &AppHandle<R>) {
  for w in app.webview_windows().values() {
    let _ = w.show();
    let _ = w.unminimize();
  }
}

/// Handle native shell menu items without forwarding the frontend.
pub fn handle_native_shell_menu<R: Runtime>(app: &AppHandle<R>, id: &str) -> bool {
  match id {
    //app-quit: No hard exit, forward app-menu by lib.rs on_menu_event, save before closing the front end
    "app-quit" => false,
    "app-hide" => {
      hide_application(app);
      true
    }
    "app-hide-others" => {
      let focused = app
        .webview_windows()
        .iter()
        .find_map(|(label, w)| w.is_focused().ok().filter(|&f| f).map(|_| label.clone()));
      if let Some(focused_label) = focused {
        for (label, w) in app.webview_windows() {
          if label != focused_label {
            let _ = w.hide();
          }
        }
      }
      true
    }
    "app-show-all" => {
      show_all_application(app);
      true
    }
    "win-close" => {
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.close();
      } else if let Some((_, w)) = app.webview_windows().iter().next() {
        let _ = w.close();
      }
      true
    }
    _ => false,
  }
}
