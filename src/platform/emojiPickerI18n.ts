import { formatMessage } from '../i18n/formatMessage'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import { resolveEffectiveUiLocale } from '../i18n/resolveLocale'
import { getAppSettingsSnapshot } from '../settings/appSettingsStore'

export const EMOJI_PICKER_I18N_KEYS = {
  title: 'editor.slash.emoji',
  searchPlaceholder: 'editor.emoji.searchPlaceholder',
  noMatches: 'editor.emoji.noMatches',
} as const

export type EmojiPickerCopy = {
  title: string
  searchPlaceholder: string
  noMatches: string
}

function resolveUiLocale(): UiLocaleId {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : undefined
  return resolveEffectiveUiLocale(getAppSettingsSnapshot().language, navLang, null)
}

function readMessage(messages: Record<string, string>, en: Record<string, string>, key: string): string {
  const template = messages[key] ?? en[key] ?? ''
  return formatMessage(template, {})
}

/** Localized copy for the built-in emoji picker dialog. */
export function readEmojiPickerCopy(): EmojiPickerCopy {
  const locale = resolveUiLocale()
  const en = getEnMessagesSnapshot()
  let messages = en
  try {
    messages = getLocaleMessagesSnapshot(locale)
  } catch {
    /* locale not warmed yet — fall back to en copy */
  }
  return {
    title: readMessage(messages, en, EMOJI_PICKER_I18N_KEYS.title),
    searchPlaceholder: readMessage(messages, en, EMOJI_PICKER_I18N_KEYS.searchPlaceholder),
    noMatches: readMessage(messages, en, EMOJI_PICKER_I18N_KEYS.noMatches),
  }
}
