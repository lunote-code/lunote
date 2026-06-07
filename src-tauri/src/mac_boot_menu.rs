//! macOS startup menu: install Lunote menu bar before the WebView/React boot completes.

#[cfg(target_os = "macos")]
mod imp {
  use std::collections::HashMap;

  use serde::Deserialize;
  use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
  use tauri::{AppHandle, Manager, Runtime};

  const BOOT_JSON: &str = include_str!("../resources/mac-menu-boot.json");

  #[derive(Debug, Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct BootManifest {
    product_name: String,
    bar: Vec<BootNode>,
    app_submenu: AppSubmenuSpec,
    labels: HashMap<String, HashMap<String, String>>,
  }

  #[derive(Debug, Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct AppSubmenuSpec {
    about: BootActionSpec,
    preferences: BootActionSpec,
    hide: BootActionSpec,
    hide_others: BootActionSpec,
    show_all: BootActionSpec,
    quit: BootActionSpec,
  }

  #[derive(Debug, Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct BootActionSpec {
    id: String,
    label_key: String,
    #[serde(default)]
    tauri_accelerator: Option<String>,
  }

  #[derive(Debug, Deserialize)]
  #[serde(tag = "kind", rename_all = "kebab-case")]
  enum BootNode {
    Separator,
    Submenu {
      id: String,
      #[serde(rename = "labelKey")]
      label_key: String,
      children: Vec<BootNode>,
    },
    Item {
      #[serde(rename = "id")]
      _id: String,
      action: String,
      #[serde(rename = "labelKey")]
      label_key: String,
      #[serde(default, rename = "menuIcon")]
      menu_icon: Option<String>,
      #[serde(default, rename = "tauriAccelerator")]
      tauri_accelerator: Option<String>,
    },
    Check {
      #[serde(rename = "id")]
      _id: String,
      action: String,
      #[serde(rename = "labelKey")]
      label_key: String,
      #[serde(default, rename = "tauriAccelerator")]
      tauri_accelerator: Option<String>,
    },
    RecentPlaceholder,
  }

  #[allow(dead_code)]
  pub struct MacBootMenuState {
    pub installed: bool,
    pub locale: String,
  }

  fn canonical_locale(raw: &str) -> String {
    let norm = raw.to_lowercase().replace('_', "-");
    match norm.as_str() {
      "en" | "en-us" | "en-gb" => "en".into(),
      "zh-cn" | "zh-hans" | "zh-sg" => "zh-CN".into(),
      "zh-tw" | "zh-hant" | "zh-hk" | "zh-mo" => "zh-TW".into(),
      "ja" | "ja-jp" => "ja".into(),
      "ko" | "ko-kr" => "ko".into(),
      "de" | "de-de" | "de-at" | "de-ch" => "de".into(),
      "fr" | "fr-fr" | "fr-ca" | "fr-be" => "fr".into(),
      "es" | "es-es" | "es-mx" | "es-ar" => "es".into(),
      "it" | "it-it" => "it".into(),
      "pt" | "pt-pt" | "pt-br" => "pt".into(),
      "ru" | "ru-ru" => "ru".into(),
      other if other.starts_with("zh-cn") || other.starts_with("zh-hans") => "zh-CN".into(),
      other if other.starts_with("zh-tw") || other.starts_with("zh-hant") => "zh-TW".into(),
      _ => "en".into(),
    }
  }

  fn resolve_boot_locale() -> String {
    sys_locale::get_locale()
      .map(|s| canonical_locale(&s))
      .unwrap_or_else(|| "en".into())
  }

  fn label_for<'a>(labels: &'a HashMap<String, String>, key: &'a str) -> &'a str {
    labels.get(key).map(String::as_str).unwrap_or(key)
  }

  fn kind_refs<R: Runtime>(items: &[tauri::menu::MenuItemKind<R>]) -> Vec<&dyn IsMenuItem<R>> {
    items.iter().map(|k| k as &dyn IsMenuItem<R>).collect()
  }

  fn item_text(labels: &HashMap<String, String>, label_key: &str, menu_icon: Option<&str>) -> String {
    let translated = label_for(labels, label_key);
    match menu_icon {
      Some(icon) if !icon.is_empty() => format!("{icon} {translated}"),
      _ => translated.to_string(),
    }
  }

  fn accel(accel: Option<&str>) -> Option<&str> {
    accel.filter(|s| !s.is_empty())
  }

  fn build_recent_placeholder<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
  ) -> tauri::Result<Submenu<R>> {
    let text = label_for(labels, "menu.file.recent");
    let empty = label_for(labels, "menu.native.recentEmpty");
    let items = vec![
      MenuItem::with_id(app, "recent-placeholder", empty, false, None::<&str>)?.kind(),
      PredefinedMenuItem::separator(app)?.kind(),
      MenuItem::with_id(
        app,
        "file-clear-recent",
        label_for(labels, "menu.file.clearRecent"),
        true,
        None::<&str>,
      )?
      .kind(),
    ];
    Submenu::with_id_and_items(app, "sub-recent-dynamic", text, true, &kind_refs(&items))
  }

  fn build_nodes<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
    nodes: &[BootNode],
  ) -> tauri::Result<Vec<tauri::menu::MenuItemKind<R>>> {
    let mut out: Vec<tauri::menu::MenuItemKind<R>> = Vec::new();
    let mut last_was_separator = true;

    let push_separator = |app: &AppHandle<R>, out: &mut Vec<tauri::menu::MenuItemKind<R>>, last: &mut bool| {
      if *last {
        return tauri::Result::Ok(());
      }
      out.push(PredefinedMenuItem::separator(app)?.kind());
      *last = true;
      Ok(())
    };

    for node in nodes {
      match node {
        BootNode::Separator => {
          push_separator(app, &mut out, &mut last_was_separator)?;
        }
        BootNode::RecentPlaceholder => {
          last_was_separator = false;
          out.push(build_recent_placeholder(app, labels)?.kind());
        }
        BootNode::Submenu { id, label_key, children } => {
          let items = build_nodes(app, labels, children)?;
          if items.is_empty() {
            continue;
          }
          last_was_separator = false;
          let sub = Submenu::with_id_and_items(
            app,
            id,
            label_for(labels, label_key),
            true,
            &kind_refs(&items),
          )?;
          out.push(sub.kind());
        }
        BootNode::Item {
          action,
          label_key,
          menu_icon,
          tauri_accelerator,
          ..
        } => {
          last_was_separator = false;
          let text = item_text(labels, label_key, menu_icon.as_deref());
          out.push(
            MenuItem::with_id(app, action, text, true, accel(tauri_accelerator.as_deref()))?.kind(),
          );
        }
        BootNode::Check {
          action,
          label_key,
          tauri_accelerator,
          ..
        } => {
          last_was_separator = false;
          let text = item_text(labels, label_key, None);
          out.push(
            CheckMenuItem::with_id(
              app,
              action,
              text,
              true,
              false,
              accel(tauri_accelerator.as_deref()),
            )?
            .kind(),
          );
        }
      }
    }

    if last_was_separator && !out.is_empty() {
      out.pop();
    }

    Ok(out)
  }

  fn build_app_submenu<R: Runtime>(
    app: &AppHandle<R>,
    spec: &AppSubmenuSpec,
    product_name: &str,
    labels: &HashMap<String, String>,
  ) -> tauri::Result<Submenu<R>> {
    let items = vec![
      MenuItem::with_id(
        app,
        &spec.about.id,
        label_for(labels, &spec.about.label_key),
        true,
        None::<&str>,
      )?
      .kind(),
      PredefinedMenuItem::separator(app)?.kind(),
      MenuItem::with_id(
        app,
        &spec.preferences.id,
        label_for(labels, &spec.preferences.label_key),
        true,
        accel(spec.preferences.tauri_accelerator.as_deref()),
      )?
      .kind(),
      PredefinedMenuItem::separator(app)?.kind(),
      PredefinedMenuItem::services(app, None)?.kind(),
      PredefinedMenuItem::separator(app)?.kind(),
      MenuItem::with_id(
        app,
        &spec.hide.id,
        label_for(labels, &spec.hide.label_key),
        true,
        accel(spec.hide.tauri_accelerator.as_deref()),
      )?
      .kind(),
      MenuItem::with_id(
        app,
        &spec.hide_others.id,
        label_for(labels, &spec.hide_others.label_key),
        true,
        accel(spec.hide_others.tauri_accelerator.as_deref()),
      )?
      .kind(),
      MenuItem::with_id(
        app,
        &spec.show_all.id,
        label_for(labels, &spec.show_all.label_key),
        true,
        None::<&str>,
      )?
      .kind(),
      PredefinedMenuItem::separator(app)?.kind(),
      MenuItem::with_id(
        app,
        &spec.quit.id,
        label_for(labels, &spec.quit.label_key),
        true,
        accel(spec.quit.tauri_accelerator.as_deref()),
      )?
      .kind(),
    ];
    Submenu::with_id_and_items(app, "bar-app", product_name, true, &kind_refs(&items))
  }

  fn configure_special_submenus<R: Runtime>(menu: &Menu<R>) -> tauri::Result<()> {
    if let Some(tauri::menu::MenuItemKind::Submenu(win)) = menu.get("bar-window") {
      win.set_as_windows_menu_for_nsapp()?;
    }
    if let Some(tauri::menu::MenuItemKind::Submenu(help)) = menu.get("bar-help") {
      help.set_as_help_menu_for_nsapp()?;
    }
    Ok(())
  }

  pub fn install_startup_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<String> {
    let manifest: BootManifest = serde_json::from_str(BOOT_JSON).map_err(|e| {
      log::error!("mac-menu-boot.json parse failed: {e}");
      tauri::Error::InvalidIcon(std::io::Error::new(
        std::io::ErrorKind::InvalidData,
        "mac-menu-boot.json",
      ))
    })?;

    let locale = resolve_boot_locale();
    let labels = manifest
      .labels
      .get(&locale)
      .or_else(|| manifest.labels.get("en"))
      .cloned()
      .unwrap_or_default();

    let app_sub = build_app_submenu(app, &manifest.app_submenu, &manifest.product_name, &labels)?;
    let mut subs: Vec<Submenu<R>> = vec![app_sub];

    for group in &manifest.bar {
      if let BootNode::Submenu { id, label_key, children } = group {
        let items = build_nodes(app, &labels, children)?;
        if items.is_empty() {
          continue;
        }
        let sub = Submenu::with_id_and_items(app, id, label_for(&labels, label_key), true, &kind_refs(&items))?;
        subs.push(sub);
      }
    }

    let refs: Vec<&dyn IsMenuItem<R>> = subs.iter().map(|s| s as &dyn IsMenuItem<R>).collect();
    let menu = Menu::with_items(app, &refs)?;
    configure_special_submenus(&menu)?;
    menu.set_as_app_menu()?;

    app.manage(MacBootMenuState {
      installed: true,
      locale: locale.clone(),
    });

    log::info!("macOS boot menu installed (locale={locale})");
    Ok(locale)
  }
}

#[cfg(target_os = "macos")]
pub use imp::install_startup_menu;
