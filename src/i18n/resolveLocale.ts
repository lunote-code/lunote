import type { AppLanguageSetting } from '../settings/appSettingsTypes'
import { UI_LOCALE_IDS, type UiLocaleId, isUiLocaleId } from './localeRegistry'

export type { UiLocaleId }

export const FALLBACK_LOCALE: UiLocaleId = 'en'

/** Consistent with `localeRegistry.UI_LOCALE_IDS`; used for preference settings and parsing logic*/
export const SUPPORTED_UI_LOCALES: readonly UiLocaleId[] = UI_LOCALE_IDS as unknown as readonly UiLocaleId[]

const CANONICAL: Record<string, UiLocaleId> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-sg': 'zh-CN',
  'zh-tw': 'zh-TW',
  'zh-hant': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-mo': 'zh-TW',
  ja: 'ja',
  'ja-jp': 'ja',
  ko: 'ko',
  'ko-kr': 'ko',
  de: 'de',
  'de-de': 'de',
  'de-at': 'de',
  'de-ch': 'de',
  fr: 'fr',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
  'fr-be': 'fr',
  es: 'es',
  'es-es': 'es',
  'es-mx': 'es',
  'es-ar': 'es',
  ru: 'ru',
  'ru-ru': 'ru',
  pt: 'pt',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  it: 'it',
  'it-it': 'it',
}

function normalizeTag(tag: string): UiLocaleId | null {
  const t = tag.trim().toLowerCase().replace(/_/g, '-')
  if (CANONICAL[t]) return CANONICAL[t]
  const base = t.split('-')[0] ?? ''
  if (CANONICAL[base]) return CANONICAL[base]
  const ids = UI_LOCALE_IDS as readonly string[]
  if (ids.includes(t)) return t as UiLocaleId
  if (ids.includes(base)) return base as UiLocaleId
  return null
}

/** Resolve system/browser language tags into supported UI locales*/
export function resolveNavigatorLocaleTag(navTag: string | undefined): UiLocaleId {
  if (!navTag) return FALLBACK_LOCALE
  const n = normalizeTag(navTag)
  if (n) return n
  return FALLBACK_LOCALE
}

export function resolveEffectiveUiLocale(
  languageSetting: AppLanguageSetting,
  navigatorLanguage: string | undefined,
): UiLocaleId {
  if (languageSetting === 'system') {
    return resolveNavigatorLocaleTag(navigatorLanguage)
  }
  if (isUiLocaleId(languageSetting)) return languageSetting
  const n = normalizeTag(languageSetting)
  if (n) return n
  return FALLBACK_LOCALE
}
