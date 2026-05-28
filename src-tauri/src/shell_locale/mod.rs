//!Native shell copy: `src-tauri/i18n/*.json` (separated from the front-end `src/i18n/locales/`), parsed and merged fallback according to `app_settings.language` at startup.

pub mod schema;

use std::sync::Mutex;

use serde_json::Value;

use crate::app_settings::AppSettings;

use schema::{ShellLocaleFile, ShellMenuStrings};

/// Write on startup; `sync_recent_menu` / `sync_theme_css_menu` only clones this snapshot and does not change with the editor locale.
pub struct MenuTranslations(pub Mutex<ShellMenuStrings>);

const FALLBACK_LOCALE: &str = "en";

const SUPPORTED: &[&str] = &[
  "en", "zh-CN", "zh-TW", "ja", "ko", "de", "fr", "es", "ru", "pt", "it",
];

fn shell_json_embed(locale_id: &str) -> &'static str {
  match locale_id {
    "en" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/en.json")),
    "zh-CN" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/zh-CN.json")),
    "zh-TW" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/zh-TW.json")),
    "ja" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/ja.json")),
    "ko" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/ko.json")),
    "de" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/de.json")),
    "fr" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/fr.json")),
    "es" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/es.json")),
    "ru" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/ru.json")),
    "pt" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/pt.json")),
    "it" => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/it.json")),
    _ => include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/i18n/en.json")),
  }
}

fn normalize_tag(tag: &str) -> Option<&'static str> {
  let t = tag.trim().to_lowercase().replace('_', "-");
  let t = t.as_str();
  if let Some(c) = match t {
    "en" | "en-us" | "en-gb" => Some("en"),
    "zh-cn" | "zh-hans" | "zh-sg" => Some("zh-CN"),
    "zh-tw" | "zh-hant" | "zh-hk" | "zh-mo" => Some("zh-TW"),
    "ja" | "ja-jp" => Some("ja"),
    "ko" | "ko-kr" => Some("ko"),
    "de" | "de-de" | "de-at" | "de-ch" => Some("de"),
    "fr" | "fr-fr" | "fr-ca" | "fr-be" => Some("fr"),
    "es" | "es-es" | "es-mx" | "es-ar" => Some("es"),
    "ru" | "ru-ru" => Some("ru"),
    "pt" | "pt-br" | "pt-pt" => Some("pt"),
    "it" | "it-it" => Some("it"),
    _ => None,
  } {
    return Some(c);
  }
  let base = t.split('-').next().unwrap_or("");
  if let Some(c) = match base {
    "en" => Some("en"),
    "ja" => Some("ja"),
    "ko" => Some("ko"),
    "de" => Some("de"),
    "fr" => Some("fr"),
    "es" => Some("es"),
    "ru" => Some("ru"),
    "pt" => Some("pt"),
    "it" => Some("it"),
    _ => None,
  } {
    return Some(c);
  }
  for s in SUPPORTED {
    if *s == t {
      return Some(s);
    }
  }
  for s in SUPPORTED {
    if *s == base {
      return Some(s);
    }
  }
  None
}

fn resolve_navigator_locale_tag(nav: &str) -> &'static str {
  normalize_tag(nav).unwrap_or(FALLBACK_LOCALE)
}

fn resolve_effective_ui_locale(language_setting: &str, navigator_language: Option<&str>) -> &'static str {
  if language_setting == "system" {
    let nav = navigator_language.unwrap_or(FALLBACK_LOCALE);
    return resolve_navigator_locale_tag(nav);
  }
  normalize_tag(language_setting).unwrap_or(FALLBACK_LOCALE)
}

fn merge_json_recursive(base: &mut Value, over: Value) {
  match (base, over) {
    (Value::Object(b), Value::Object(o)) => {
      for (k, v) in o {
        if let Some(bv) = b.get_mut(&k) {
          if bv.is_object() && v.is_object() {
            merge_json_recursive(bv, v);
          } else {
            * bv = v;
          }
        } else {
          b.insert(k, v);
        }
      }
    }
    (b, o) => *b = o,
  }
}

fn merge_locale_files(base: &ShellLocaleFile, over: &ShellLocaleFile) -> ShellLocaleFile {
  let mut b = serde_json::to_value(base).expect("shell locale to json");
  let o = serde_json::to_value(over).expect("shell locale to json");
  merge_json_recursive(&mut b, o);
  serde_json::from_value(b).unwrap_or_else(|_| base.clone())
}

/// The UI locale label in effect for the current menu (consistent with `build_menu_strings`).
pub fn effective_menu_locale_tag(settings: &AppSettings) -> &'static str {
  if settings.language == "system" {
    let system_tag = sys_locale::get_locale().unwrap_or_else(|| "en".to_string());
    resolve_effective_ui_locale("system", Some(system_tag.as_str()))
  } else {
    resolve_effective_ui_locale(settings.language.as_str(), None)
  }
}

/// Parse `app_settings` with the system language, merge `en` fallback with the target locale, and return the menu string table.
pub fn build_menu_strings(settings: &AppSettings) -> ShellMenuStrings {
  let effective = if settings.language == "system" {
    let system_tag = sys_locale::get_locale().unwrap_or_else(|| "en".to_string());
    resolve_effective_ui_locale("system", Some(system_tag.as_str()))
  } else {
    resolve_effective_ui_locale(settings.language.as_str(), None)
  };

  let en_src = shell_json_embed("en");
  let en: ShellLocaleFile = serde_json::from_str(en_src).expect("parse src-tauri/i18n/en.json");

  let prim: ShellLocaleFile = match serde_json::from_str(shell_json_embed(effective)) {
    Ok(v) => v,
    Err(e) => {
      log::warn!("parse shell locale {effective}: {e}, using en");
      en.clone()
    }
  };

  let merged = merge_locale_files(&en, &prim);
  merged.menu
}
