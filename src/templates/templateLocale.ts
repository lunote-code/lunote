import { resolveEffectiveUiLocale } from '../i18n/resolveLocale'
import { getCachedTauriOsLocaleTag } from '../i18n/systemLocale'
import type { UiLocaleId } from '../i18n/localeRegistry'
import { getAppSettingsSnapshot } from '../settings/appSettingsStore'

/** UI locale used when seeding workspace templates and note fallbacks. */
export function resolveTemplateLocale(): UiLocaleId {
  const { language } = getAppSettingsSnapshot()
  const nav = typeof navigator !== 'undefined' ? navigator.language : undefined
  return resolveEffectiveUiLocale(language, nav, getCachedTauriOsLocaleTag() ?? null)
}
