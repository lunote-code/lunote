import { formatMessage } from '../i18n/formatMessage'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import { resolveEffectiveUiLocale } from '../i18n/resolveLocale'
import { getCachedTauriOsLocaleTag } from '../i18n/systemLocale'
import { getAppSettingsSnapshot } from '../settings/appSettingsStore'

function resolveEditorUiLocale(): UiLocaleId {
  const { language } = getAppSettingsSnapshot()
  const nav = typeof navigator !== 'undefined' ? navigator.language : undefined
  return resolveEffectiveUiLocale(language, nav, getCachedTauriOsLocaleTag() ?? null)
}

/** Resolve a UI message outside React (editor commands, export helpers). */
export function resolveEditorUiMessage(
  key: string,
  vars?: Record<string, string | number>,
): string {
  const locale = resolveEditorUiLocale()
  const en = getEnMessagesSnapshot()
  let messages = en
  try {
    messages = getLocaleMessagesSnapshot(locale)
  } catch {
    /* locale not warmed yet */
  }
  const raw = messages[key] ?? en[key] ?? key
  return vars ? formatMessage(raw, vars) : raw
}
