import { getAppSettingsSnapshot } from '../settings/appSettingsStore'
import { resolveEffectiveUiLocale, type UiLocaleId } from '../i18n/resolveLocale'

const FONT_UI_LATIN =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

/** Resolve BCP-47 `lang` for export HTML documents. */
export function resolveExportHtmlLang(localeId: UiLocaleId): string {
  switch (localeId) {
    case 'zh-CN':
      return 'zh-CN'
    case 'zh-TW':
      return 'zh-TW'
    case 'ja':
      return 'ja'
    case 'ko':
      return 'ko'
    case 'de':
      return 'de'
    case 'fr':
      return 'fr'
    case 'es':
      return 'es'
    case 'ru':
      return 'ru'
    case 'pt':
      return 'pt'
    case 'it':
      return 'it'
    default:
      return 'en'
  }
}

/** CJK-aware `--font-ui` stack for PDF/HTML export (Chrome headless uses system fonts). */
export function exportFontStackForLocale(localeId: UiLocaleId): string {
  switch (localeId) {
    case 'zh-TW':
      return `${FONT_UI_LATIN}, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", "Source Han Sans TC", sans-serif`
    case 'zh-CN':
      return `${FONT_UI_LATIN}, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif`
    case 'ja':
      return `${FONT_UI_LATIN}, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif`
    case 'ko':
      return `${FONT_UI_LATIN}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`
    default:
      return `${FONT_UI_LATIN}, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Noto Sans", sans-serif`
  }
}

export function resolveExportUiLocale(): UiLocaleId {
  const settings = getAppSettingsSnapshot()
  const nav = typeof navigator !== 'undefined' ? navigator.language : undefined
  return resolveEffectiveUiLocale(settings.language, nav)
}
