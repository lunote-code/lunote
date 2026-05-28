import type { MessageDictionary } from './loadMessages'
import type { UiLocaleId } from './resolveLocale'

const STRICT_MENU_LOCALES = new Set<UiLocaleId>(['zh-CN', 'zh-TW'])

export function isMenuLabelKey(key: string): boolean {
  return key.startsWith('menu.')
}

/**
 * Visible copy of the menu field: disable fallback string rendering; if it is invalid, an empty string will be returned (the caller skips this item).
 * Strict locale violations are thrown by `menu.guard` / `menu.enforcer` during compilation.
 */
export function resolveMenuVisibleLabel(
  key: string,
  locale: UiLocaleId,
  resolved: string,
  enMessages: MessageDictionary,
  rawLocale: MessageDictionary,
): string {
  if (!isMenuLabelKey(key) || locale === 'en' || !STRICT_MENU_LOCALES.has(locale)) {
    return resolved
  }
  const own = rawLocale[key]
  if (own === undefined || own.trim() === '') {
    return ''
  }
  const enVal = enMessages[key]
  if (enVal !== undefined && resolved === enVal && (own === undefined || own.trim() === '')) {
    return ''
  }
  return resolved
}
