import { isModifierHintMacLike } from '../platform/desktopPlatform'

const PLATFORM_SHORTCUT_HINT_TOKENS = [
  { token: 'Command/Ctrl', mac: 'Command', other: 'Ctrl' },
  { token: 'Cmd/Strg', mac: 'Cmd', other: 'Strg' },
  { token: 'Cmd/Ctrl', mac: 'Cmd', other: 'Ctrl' },
  { token: 'Ctrl/Cmd', mac: 'Cmd', other: 'Ctrl' },
  { token: '⌘/Ctrl', mac: '⌘', other: 'Ctrl' },
  { token: 'Ctrl/⌘', mac: '⌘', other: 'Ctrl' },
  { token: 'Option/Alt', mac: 'Option', other: 'Alt' },
  { token: 'Alt/Option', mac: 'Option', other: 'Alt' },
  { token: 'Shift+Click', mac: 'Shift+Click', other: 'Shift+Click' },
  { token: '（⌘/Ctrl+/）', mac: '（⌘/）', other: '（Ctrl+/）' },
  { token: '（⌘/）', mac: '（⌘/）', other: '（Ctrl+/）' },
  { token: '(⌘/Ctrl+/)', mac: '(⌘/)', other: '(Ctrl+/)' },
  { token: '(⌘/)', mac: '(⌘/)', other: '(Ctrl+/)' },
  { token: '+/-', mac: '+/-', other: '+/-' },
] as const

const ORDERED_PLATFORM_SHORTCUT_HINT_TOKENS = [...PLATFORM_SHORTCUT_HINT_TOKENS].sort(
  (a, b) => b.token.length - a.token.length,
)

/**
 * Locale strings sometimes keep cross-platform shortcut copy inline (e.g. `Cmd/Ctrl`).
 * Collapse these tokens to the active desktop platform so hints do not drift on Win/Linux.
 */
export function resolvePlatformShortcutHintText(text: string): string {
  const macLike = isModifierHintMacLike()
  let out = text
  for (const { token, mac, other } of ORDERED_PLATFORM_SHORTCUT_HINT_TOKENS) {
    out = out.split(token).join(macLike ? mac : other)
  }
  return out
}
