import type { LocalizedString } from './pluginTypes'

export function pickLocalizedText(
  value: LocalizedString | undefined,
  locale: string,
  fallbackLocale = 'en',
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return (
    value[locale] ??
    value[fallbackLocale] ??
    value['zh-CN'] ??
    Object.values(value)[0] ??
    ''
  )
}
