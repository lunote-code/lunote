/**
 * Compile the runtime menu diagram from `menu.schema.ts` (Menu SSOT).
 * The only legal path: `compileMenuForLocale(schema, locale, messages)`.
 */
import type { MessageDictionary } from '../i18n/loadMessages'
import type { UiLocaleId } from '../i18n/resolveLocale'
import { createMenuCompiler } from './menu.enforcer'
import { assertMenuGuard } from './menu.guard'
import type { PaletteCommandDef } from './menu.types'
import { compilePaletteFromManifest } from './manifestCompile'
export { compileMenuFromSchema, RUST_EDIT_MENU_P0 } from './menu.compiledSchema'

export type CompiledMenuGraph = {
  locale: UiLocaleId
  /** React consumption such as command palette: only items that have been legally translated*/
  paletteCommands: PaletteCommandDef[]
}

/**
 * `Menu = compile(schema, locale)` — Force guard before rendering and disable runtime patch / fallback injection.
 */
export function compileMenuForLocale(
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
  options?: { shellLabelsByActionId?: Record<string, string>; skipGuard?: boolean },
): CompiledMenuGraph {
  if (!options?.skipGuard) {
    assertMenuGuard({
      locale,
      merged,
      en,
      rawLocale,
      shellLabelsByActionId: options?.shellLabelsByActionId,
    })
  }

  const translate = createMenuCompiler(locale, merged, en, rawLocale, { enforce: true })
  const paletteCommands = compilePaletteFromManifest(translate)

  return { locale, paletteCommands }
}
