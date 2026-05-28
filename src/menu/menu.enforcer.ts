/**
 * Menu Runtime Enforcement: En fallback/missing keys are strictly prohibited under locale. If violated, an error will be thrown.
 */
import type { MessageDictionary } from '../i18n/loadMessages'
import type { UiLocaleId } from '../i18n/resolveLocale'
import { RUST_EDIT_MENU_P0, compileMenuFromSchema } from './menu.compile'
import { isMenuLabelKey } from '../i18n/menuLabel'

export const STRICT_ENFORCE_LOCALES = new Set<UiLocaleId>(['zh-CN', 'zh-TW'])

export type MenuLabelResolution =
  | { ok: true; value: string; source: 'locale' }
  | { ok: false; reason: 'missing' | 'en_fallback' | 'empty' }

export class MenuEnforcementError extends Error {
  readonly labelKey: string
  readonly locale: UiLocaleId
  readonly reason: 'missing' | 'en_fallback' | 'empty'

  constructor(
    message: string,
    detail: { labelKey: string; locale: UiLocaleId; reason: 'missing' | 'en_fallback' | 'empty' },
  ) {
    super(message)
    this.name = 'MenuEnforcementError'
    this.labelKey = detail.labelKey
    this.locale = detail.locale
    this.reason = detail.reason
  }
}

export function analyzeMenuLabel(
  key: string,
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
): MenuLabelResolution {
  if (!isMenuLabelKey(key)) {
    const v = merged[key]
    return v && v.trim() ? { ok: true, value: v, source: 'locale' } : { ok: false, reason: 'missing' }
  }

  if (locale === 'en') {
    const v = merged[key] ?? en[key]
    return v && v.trim() ? { ok: true, value: v, source: 'locale' } : { ok: false, reason: 'missing' }
  }

  const own = rawLocale[key]
  if (own === undefined || own.trim() === '') {
    return { ok: false, reason: 'missing' }
  }

  const enVal = en[key]
  const mergedVal = merged[key] ?? own
  const hasExplicitLocaleEntry =
    Object.prototype.hasOwnProperty.call(rawLocale, key) && own.trim() !== ''
  if (
    enVal !== undefined &&
    mergedVal === enVal &&
    STRICT_ENFORCE_LOCALES.has(locale) &&
    !hasExplicitLocaleEntry
  ) {
    return { ok: false, reason: 'en_fallback' }
  }

  if (!mergedVal.trim()) {
    return { ok: false, reason: 'empty' }
  }

  return { ok: true, value: mergedVal, source: 'locale' }
}

/** Strict locale: fallback(en) / missing → throw; if legal, return the translation*/
export function enforceMenuLabel(
  key: string,
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
): string {
  const r = analyzeMenuLabel(key, locale, merged, en, rawLocale)
  if (r.ok) return r.value

  if (!STRICT_ENFORCE_LOCALES.has(locale) && !isMenuLabelKey(key)) {
    const fallback = merged[key] ?? en[key] ?? ''
    return fallback
  }

  if (!STRICT_ENFORCE_LOCALES.has(locale)) {
    return ''
  }

  const msg =
    r.reason === 'en_fallback'
      ? `[menu.enforcer] zh locale must not use en fallback for "${key}" (locale=${locale})`
      : r.reason === 'missing'
        ? `[menu.enforcer] missing menu translation for "${key}" (locale=${locale})`
        : `[menu.enforcer] empty menu translation for "${key}" (locale=${locale})`

  throw new MenuEnforcementError(msg, { labelKey: key, locale, reason: r.reason })
}

/**
 * The only legal menu translator at compile time: `Menu = compile(schema, locale)`.
 * Returns `null` for an invalid key (caller MUST NOT render this item).
 */
export function createMenuCompiler(
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
  options?: { enforce?: boolean },
): (labelKey: string) => string | null {
  const enforce = options?.enforce ?? STRICT_ENFORCE_LOCALES.has(locale)

  return (labelKey: string): string | null => {
    if (!isMenuLabelKey(labelKey)) return null

    if (enforce) {
      return enforceMenuLabel(labelKey, locale, merged, en, rawLocale)
    }

    const r = analyzeMenuLabel(labelKey, locale, merged, en, rawLocale)
    return r.ok ? r.value : null
  }
}

export type MenuSchemaBindingViolation = {
  actionId: string
  labelKey: string
  issue: 'missing_shell_key' | 'missing_ui_key' | 'missing_translation'
}

/** Verify that schema leaves are bound to both React locale and shell mappings*/
export function collectSchemaBindingViolations(
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
): MenuSchemaBindingViolation[] {
  if (!STRICT_ENFORCE_LOCALES.has(locale)) return []

  const violations: MenuSchemaBindingViolation[] = []
  const required = [...compileMenuFromSchema()]

  for (const row of required) {
    if (row.shellKey === null && !row.labelKey.startsWith('menu.native.')) {
      continue
    }

    const r = analyzeMenuLabel(row.labelKey, locale, merged, en, rawLocale)
    if (!r.ok) {
      violations.push({
        actionId: row.actionId,
        labelKey: row.labelKey,
        issue: 'missing_translation',
      })
    }

    if (row.shellKey && STRICT_ENFORCE_LOCALES.has(locale)) {
      const shellUiKey = row.labelKey
      if (!rawLocale[shellUiKey] && !merged[shellUiKey]) {
        violations.push({
          actionId: row.actionId,
          labelKey: row.labelKey,
          issue: 'missing_ui_key',
        })
      }
    }
  }

  return violations
}

export function assertMenuSchemaBindings(
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
): void {
  const violations = collectSchemaBindingViolations(locale, merged, en, rawLocale)
  if (violations.length === 0) return

  const detail = violations
    .slice(0, 8)
    .map((v) => `${v.actionId} (${v.labelKey}): ${v.issue}`)
    .join('; ')
  throw new MenuEnforcementError(
    `[menu.enforcer] schema binding failed for locale ${locale}: ${detail}`,
    {
      labelKey: violations[0]!.labelKey,
      locale,
      reason: 'missing',
    },
  )
}

/** P0 Edit items must be parsable in strict locale (fail-fast on startup)*/
export function enforceEditMenuP0(
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
): void {
  if (!STRICT_ENFORCE_LOCALES.has(locale)) return
  for (const row of RUST_EDIT_MENU_P0) {
    enforceMenuLabel(row.labelKey, locale, merged, en, rawLocale)
  }
}
