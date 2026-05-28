/**
 * Menu guard: Enforce the schema + locale contract before rendering, and block rendering if violations occur.
 */
import type { MessageDictionary } from '../i18n/loadMessages'
import type { UiLocaleId } from '../i18n/resolveLocale'
import {
  MenuEnforcementError,
  STRICT_ENFORCE_LOCALES,
  analyzeMenuLabel,
  assertMenuSchemaBindings,
  collectSchemaBindingViolations,
  enforceEditMenuP0,
  type MenuSchemaBindingViolation,
} from './menu.enforcer'
import { RUST_EDIT_MENU_P0, compileMenuFromSchema } from './menu.compiledSchema'
import { assertMenuActionMappingValid } from './menuActionMapping'
import { shellKeyToUiLabelKey } from './menu.shellKey'
import { assertCommandManifestValid } from './manifestValidation'

export type MenuGuardViolation = {
  labelKey: string
  actionId: string
  source: 'react' | 'rust_shell' | 'schema'
  locale: UiLocaleId
  reason: 'missing' | 'en_fallback' | 'empty' | 'shell_ui_mismatch' | 'schema_binding'
}

export type MenuGuardInput = {
  locale: UiLocaleId
  merged: MessageDictionary
  en: MessageDictionary
  rawLocale: MessageDictionary
  shellLabelsByActionId?: Record<string, string>
}

let guardArmed = true

export function setMenuGuardArmed(armed: boolean): void {
  guardArmed = armed
}

export function isMenuGuardArmed(): boolean {
  return guardArmed
}

function collectReactViolations(input: MenuGuardInput): MenuGuardViolation[] {
  const { locale, merged, en, rawLocale } = input
  const out: MenuGuardViolation[] = []
  const keys = [...RUST_EDIT_MENU_P0, ...compileMenuFromSchema().filter((e) => e.shellKey)]

  const seen = new Set<string>()
  for (const row of keys) {
    if (seen.has(row.labelKey)) continue
    seen.add(row.labelKey)

    const r = analyzeMenuLabel(row.labelKey, locale, merged, en, rawLocale)
    if (!r.ok && (STRICT_ENFORCE_LOCALES.has(locale) || row.labelKey.startsWith('menu.edit.'))) {
      out.push({
        labelKey: row.labelKey,
        actionId: row.actionId,
        source: 'react',
        locale,
        reason: r.reason,
      })
    }
  }
  return out
}

function collectShellViolations(input: MenuGuardInput): MenuGuardViolation[] {
  const { locale, shellLabelsByActionId, merged, en, rawLocale } = input
  if (!shellLabelsByActionId || !STRICT_ENFORCE_LOCALES.has(locale)) return []

  const out: MenuGuardViolation[] = []
  for (const row of compileMenuFromSchema()) {
    if (!row.shellKey) continue
    const shellVal = shellLabelsByActionId[row.actionId]
    if (shellVal === undefined) continue

    const reactR = analyzeMenuLabel(row.labelKey, locale, merged, en, rawLocale)
    if (!reactR.ok) continue

    if (shellVal !== reactR.value) {
      out.push({
        labelKey: shellKeyToUiLabelKey(row.shellKey) ?? row.labelKey,
        actionId: row.actionId,
        source: 'rust_shell',
        locale,
        reason: 'shell_ui_mismatch',
      })
    }

    const enVal = en[row.labelKey]
    if (enVal && shellVal === enVal) {
      out.push({
        labelKey: row.labelKey,
        actionId: row.actionId,
        source: 'rust_shell',
        locale,
        reason: 'en_fallback',
      })
    }
  }
  return out
}

function bindingToViolations(
  locale: UiLocaleId,
  bindings: MenuSchemaBindingViolation[],
): MenuGuardViolation[] {
  return bindings.map((b) => ({
    labelKey: b.labelKey,
    actionId: b.actionId,
    source: 'schema' as const,
    locale,
    reason: 'schema_binding' as const,
  }))
}

export function runMenuGuard(input: MenuGuardInput): MenuGuardViolation[] {
  const bindingViolations = collectSchemaBindingViolations(
    input.locale,
    input.merged,
    input.en,
    input.rawLocale,
  )
  return [
    ...collectReactViolations(input),
    ...collectShellViolations(input),
    ...bindingToViolations(input.locale, bindingViolations),
  ]
}

export function assertMenuGuard(input: MenuGuardInput): void {
  if (!guardArmed) return

  assertMenuSchemaBindings(input.locale, input.merged, input.en, input.rawLocale)
  enforceEditMenuP0(input.locale, input.merged, input.en, input.rawLocale)
  assertCommandManifestValid()
  assertMenuActionMappingValid()

  const violations = runMenuGuard(input)
  if (violations.length === 0) return

  const summary = violations
    .slice(0, 6)
    .map((v) => `${v.labelKey} [${v.source}/${v.reason}]`)
    .join('; ')

  throw new MenuEnforcementError(
    `[menu.guard] blocked menu render (${violations.length} violations): ${summary}`,
    {
      labelKey: violations[0]!.labelKey,
      locale: input.locale,
      reason: violations[0]!.reason === 'en_fallback' ? 'en_fallback' : 'missing',
    },
  )
}

/** @deprecated Use assertMenuGuard; preserve audit log format*/
export function logMenuGuardReport(violations: MenuGuardViolation[]): void {
  if (violations.length === 0) {
    console.info('[menu.guard] OK: no violations')
    return
  }
  const lines = ['[menu.guard] BLOCKED — violations:']
  for (const v of violations) {
    lines.push(`  ${v.labelKey}: source=${v.source} reason=${v.reason} locale=${v.locale}`)
  }
  console.error(lines.join('\n'))
}
