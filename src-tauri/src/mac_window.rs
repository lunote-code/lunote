use tauri::WebviewWindow;

/// Reserve the standard macOS title bar (traffic lights + native title) above web content.
#[cfg(target_os = "macos")]
pub fn configure_native_centered_titlebar(window: &WebviewWindow) {
  apply_native_titlebar_theme(window, None, None);
}

/// Keep the native title bar strip while tinting it to match the active app theme.
#[cfg(target_os = "macos")]
pub fn apply_native_titlebar_theme(
  window: &WebviewWindow,
  background_hex: Option<&str>,
  theme_mode: Option<&str>,
) {
  use objc2_app_kit::{
    NSAppearance, NSAppearanceCustomization, NSColor, NSWindow, NSWindowStyleMask,
    NSWindowTitleVisibility, NSAppearanceNameAqua, NSAppearanceNameDarkAqua,
  };

  let Ok(raw) = window.ns_window() else {
    return;
  };
  let ns_window: &NSWindow = unsafe { &*(raw as *const NSWindow) };

  // Tauri defaults to FullSizeContentView, which draws web content under traffic lights.
  let mut mask = ns_window.styleMask();
  mask &= !NSWindowStyleMask::FullSizeContentView;
  ns_window.setStyleMask(mask);

  ns_window.setTitleVisibility(NSWindowTitleVisibility::Visible);
  ns_window.setTitlebarAppearsTransparent(true);

  if let Some(mode) = theme_mode {
    let appearance_name = unsafe {
      if mode == "dark" {
        NSAppearanceNameDarkAqua
      } else {
        NSAppearanceNameAqua
      }
    };
    if let Some(appearance) = NSAppearance::appearanceNamed(appearance_name) {
      ns_window.setAppearance(Some(&appearance));
    }
  }

  if let Some((r, g, b)) = background_hex.and_then(parse_hex_rgb) {
    let color = NSColor::colorWithSRGBRed_green_blue_alpha(r, g, b, 1.0);
    ns_window.setBackgroundColor(Some(&color));
  }
}

#[cfg(target_os = "macos")]
fn parse_hex_rgb(hex: &str) -> Option<(f64, f64, f64)> {
  let trimmed = hex.trim().trim_start_matches('#');
  let expand = |c: char| {
    let digit = c.to_digit(16)? as u8;
    Some((digit * 17) as f64 / 255.0)
  };
  match trimmed.len() {
    6 => {
      let r = u8::from_str_radix(&trimmed[0..2], 16).ok()? as f64 / 255.0;
      let g = u8::from_str_radix(&trimmed[2..4], 16).ok()? as f64 / 255.0;
      let b = u8::from_str_radix(&trimmed[4..6], 16).ok()? as f64 / 255.0;
      Some((r, g, b))
    }
    3 => {
      let r = expand(trimmed.chars().next()?)?;
      let g = expand(trimmed.chars().nth(1)?)?;
      let b = expand(trimmed.chars().nth(2)?)?;
      Some((r, g, b))
    }
    _ => None,
  }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn sync_mac_native_titlebar_theme(
  window: WebviewWindow,
  background_color: Option<String>,
  theme_mode: Option<String>,
) -> Result<(), String> {
  apply_native_titlebar_theme(
    &window,
    background_color.as_deref(),
    theme_mode.as_deref(),
  );
  Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn configure_native_centered_titlebar(_window: &WebviewWindow) {}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn sync_mac_native_titlebar_theme(
  _window: WebviewWindow,
  _background_color: Option<String>,
  _theme_mode: Option<String>,
) -> Result<(), String> {
  Ok(())
}
