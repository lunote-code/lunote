import {
  getAppSettingsSnapshot,
  hydrateAppSettingsStore,
} from '../settings/appSettingsStore'
import type { AppLanguageSetting } from '../settings/appSettingsTypes'
import { mergeMessages, warmLocale, type MessageDictionary } from './loadMessages'
import { getEnMessagesSnapshot, getLocaleRawSnapshot } from './localeRegistry'
import { FALLBACK_LOCALE, resolveEffectiveUiLocale, type UiLocaleId } from './resolveLocale'

export type I18nBootstrap = {
  /** Merge copywriting at runtime (fallback for missing key en)*/
  mergedMessages: MessageDictionary
  enMessages: MessageDictionary
  /** Current language sparse files (used for auditing/debugging, not merged)*/
  rawLocale: MessageDictionary
  languageSetting: AppLanguageSetting
  effectiveLocale: UiLocaleId
}

/**
 * Called once when the application starts: restore settings from disk → parse locale → merge fallback copy.
 * Native menu copy is built independently by Rust in Tauri setup from the same `app_settings.json` and embedded locale, without front-end invoke.
 * It will no longer be called during operation; if the language changes, you need to restart and execute this process again.
 */
export async function bootstrapI18n(): Promise<I18nBootstrap> {
  try {
    await hydrateAppSettingsStore()
  } catch (e) {
     
    console.error('[BOOT] hydrateAppSettingsStore failed:', e)
    throw e
  }
  const snap = getAppSettingsSnapshot()
  const navLang = typeof navigator !== 'undefined' ? navigator.language : undefined
  const effectiveLocale = resolveEffectiveUiLocale(snap.language, navLang)

  const enMessages = getEnMessagesSnapshot()
  const rawLocale =
    effectiveLocale === 'en' ? enMessages : getLocaleRawSnapshot(effectiveLocale)
  const primary = await warmLocale(effectiveLocale)
  const fallback = await warmLocale(FALLBACK_LOCALE)
  const mergedMessages = mergeMessages(fallback, primary)

   
  console.log('[BOOT]', {
    settingsLoaded: true,
    documentLoaded: false,
    editorReady: false,
    effectiveLocale,
    bootError: null,
  })

  return {
    mergedMessages,
    enMessages,
    rawLocale,
    languageSetting: snap.language,
    effectiveLocale,
  }
}
