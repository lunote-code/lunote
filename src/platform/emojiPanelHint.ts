import { formatMessage } from '../i18n/formatMessage'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import { resolvePlatformShortcutHintText } from '../i18n/platformShortcutHint'
import { resolveEffectiveUiLocale } from '../i18n/resolveLocale'
import { getAppSettingsSnapshot } from '../settings/appSettingsStore'
import { getDesktopPlatformForHints, type DesktopPlatform } from './desktopPlatform'

/** i18n keys for system emoji panel shortcuts (platform-specific copy). */
export const EMOJI_PANEL_HINT_KEYS = {
  mac: 'app.ext.emojiPanelHint.mac',
  win: 'app.ext.emojiPanelHint.win',
  linux: 'app.ext.emojiPanelHint.linux',
  generic: 'app.ext.emojiPanelHint.generic',
} as const

export function resolveEmojiPanelHintKey(
  platform: DesktopPlatform | 'mac' | 'win' | 'linux' = getDesktopPlatformForHints(),
): string {
  switch (platform) {
    case 'mac':
      return EMOJI_PANEL_HINT_KEYS.mac
    case 'win':
      return EMOJI_PANEL_HINT_KEYS.win
    case 'linux':
      return EMOJI_PANEL_HINT_KEYS.linux
    default:
      return EMOJI_PANEL_HINT_KEYS.linux
  }
}

function resolveUiLocale(): UiLocaleId {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : undefined
  return resolveEffectiveUiLocale(getAppSettingsSnapshot().language, navLang, null)
}

/** Localized hint for the built-in emoji picker footer (system panel shortcuts). */
export function readEmojiPanelHint(
  platform: DesktopPlatform | 'mac' | 'win' | 'linux' = getDesktopPlatformForHints(),
): string {
  const locale = resolveUiLocale()
  const en = getEnMessagesSnapshot()
  let messages = en
  try {
    messages = getLocaleMessagesSnapshot(locale)
  } catch {
    /* locale not warmed yet — fall back to en copy */
  }
  const key = resolveEmojiPanelHintKey(platform)
  const template = messages[key] ?? en[key] ?? messages[EMOJI_PANEL_HINT_KEYS.generic] ?? en[EMOJI_PANEL_HINT_KEYS.generic] ?? ''
  return resolvePlatformShortcutHintText(formatMessage(template, {}))
}
