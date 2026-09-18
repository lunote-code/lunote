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

/** gemoji category id → i18n key for tab label */
export const EMOJI_CATEGORY_I18N_KEYS: Record<string, string> = {
  'Smileys & Emotion': 'editor.emoji.category.smileys',
  'People & Body': 'editor.emoji.category.people',
  'Animals & Nature': 'editor.emoji.category.animals',
  'Food & Drink': 'editor.emoji.category.food',
  'Travel & Places': 'editor.emoji.category.travel',
  Activities: 'editor.emoji.category.activities',
  Objects: 'editor.emoji.category.objects',
  Symbols: 'editor.emoji.category.symbols',
  Flags: 'editor.emoji.category.flags',
}

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

/** Localized tab label for a gemoji category id. */
export function readEmojiCategoryLabel(category: string): string {
  const locale = resolveUiLocale()
  const en = getEnMessagesSnapshot()
  let messages = en
  try {
    messages = getLocaleMessagesSnapshot(locale)
  } catch {
    /* locale not warmed yet — fall back to en copy */
  }
  const key = EMOJI_CATEGORY_I18N_KEYS[category]
  if (!key) return category.split(' ')[0] ?? category
  return readMessage(messages, en, key) || category.split(' ')[0] || category
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
