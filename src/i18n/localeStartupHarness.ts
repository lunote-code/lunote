/**
 * Boot-path harness: every UI locale must compile menus without MenuEnforcementError.
 * Run via: node scripts/test/run-case/run-locale-startup-contract-tests.mjs
 */
import { compileMenuForLocale } from '../menu/menu.compile'
import { compileToolbarFromManifest } from '../menu/manifestCompile'
import { isMenuLabelKey } from './menuLabel'
import { STRICT_ENFORCE_LOCALES, analyzeMenuLabel } from '../menu/menu.enforcer'
import {
  UI_LOCALE_IDS,
  getEnMessagesSnapshot,
  type MessageDictionary,
  type UiLocaleId,
} from './localeRegistry'

type LocaleModule = { default: MessageDictionary }

const localeModules = import.meta.glob<LocaleModule>('./locales/*.json', { eager: true })

function loadRawLocale(localeId: UiLocaleId): MessageDictionary {
  if (localeId === 'en') return getEnMessagesSnapshot()
  const mod = localeModules[`./locales/${localeId}.json`]
  if (!mod?.default) throw new Error(`Missing locale module: ./locales/${localeId}.json`)
  return mod.default
}

export type LocaleStartupCase = {
  locale: UiLocaleId
  ok: boolean
  detail?: string
}

export function assertLocaleStartupSuite(): { results: LocaleStartupCase[] } {
  const en = getEnMessagesSnapshot()
  const menuKeys = Object.keys(en).filter((k) => isMenuLabelKey(k))
  const results: LocaleStartupCase[] = []

  for (const locale of UI_LOCALE_IDS) {
    try {
      const raw = loadRawLocale(locale)
      const merged = locale === 'en' ? en : { ...en, ...raw }

      const compiled = compileMenuForLocale(locale, merged, en, raw)
      if (compiled.paletteCommands.length === 0) {
        results.push({ locale, ok: false, detail: 'paletteCommands empty' })
        continue
      }

      const translate = (key: string) => merged[key] ?? key
      const sidebarToolbar = compileToolbarFromManifest('sidebar-header', translate)
      const editorToolbar = compileToolbarFromManifest('editor-format', translate)
      if (sidebarToolbar.length === 0 || editorToolbar.length === 0) {
        results.push({
          locale,
          ok: false,
          detail: `toolbar empty sidebar=${sidebarToolbar.length} editor=${editorToolbar.length}`,
        })
        continue
      }

      if (STRICT_ENFORCE_LOCALES.has(locale)) {
        const missing = menuKeys.filter((key) => {
          const r = analyzeMenuLabel(key, locale, merged, en, raw)
          return !r.ok
        })
        if (missing.length > 0) {
          results.push({
            locale,
            ok: false,
            detail: `strict menu keys missing: ${missing.slice(0, 5).join(', ')}${
              missing.length > 5 ? '…' : ''
            }`,
          })
          continue
        }
      }

      results.push({
        locale,
        ok: true,
        detail: `palette=${compiled.paletteCommands.length}`,
      })
    } catch (error) {
      results.push({
        locale,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { results }
}

export function formatLocaleStartupSummary(results: readonly LocaleStartupCase[]): string {
  const failed = results.filter((r) => !r.ok)
  const lines = results.map(
    (r) => `${r.ok ? 'OK' : 'FAIL'}  ${r.locale}${r.detail ? ` — ${r.detail}` : ''}`,
  )
  lines.push('')
  lines.push(
    failed.length === 0
      ? `All ${results.length} locale startup checks passed.`
      : `${failed.length} locale startup check(s) failed.`,
  )
  return lines.join('\n')
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  const { results } = assertLocaleStartupSuite()
  console.log(formatLocaleStartupSummary(results))
  if (results.some((r) => !r.ok)) process.exit(1)
}
