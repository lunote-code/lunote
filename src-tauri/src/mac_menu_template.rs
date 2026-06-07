//! Mark custom macOS app-menu PNG icons as NSImage templates so they adapt to light/dark menus.

#[cfg(target_os = "macos")]
mod imp {
  use objc2_app_kit::{NSApplication, NSMenu, NSMenuItem};
  use objc2_foundation::MainThreadMarker;

  pub fn mark_app_menu_icons_as_template() {
    let Some(mtm) = MainThreadMarker::new() else {
      log::warn!("mark_app_menu_icons_as_template: not on main thread");
      return;
    };

    let app = NSApplication::sharedApplication(mtm);
    let Some(main_menu) = app.mainMenu() else {
      return;
    };

    mark_menu_icons(&main_menu);
  }

  fn mark_menu_icons(menu: &NSMenu) {
    let count = menu.numberOfItems();
    for index in 0..count {
      let Some(item) = menu.itemAtIndex(index) else {
        continue;
      };

      mark_item_icon_template(&item);

      if let Some(submenu) = item.submenu() {
        mark_menu_icons(&submenu);
      }
    }
  }

  fn mark_item_icon_template(item: &NSMenuItem) {
    if let Some(image) = item.image() {
      image.setTemplate(true);
    }
  }
}

#[cfg(target_os = "macos")]
pub use imp::mark_app_menu_icons_as_template;

#[cfg(not(target_os = "macos"))]
pub fn mark_app_menu_icons_as_template() {}

#[tauri::command]
pub fn sync_mac_native_menu_icon_templates() -> Result<(), String> {
  mark_app_menu_icons_as_template();
  Ok(())
}
