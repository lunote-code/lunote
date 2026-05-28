import type { MessageDictionary } from '../i18n/loadMessages'
import type { UiLocaleId } from '../i18n/resolveLocale'
import { compileMenuForLocale } from './menu.compile'
import { COMMAND_MANIFEST } from './commandManifest.entries'
import type { PaletteCommandDef } from './menu.types'

/**
 * Compile the command palette from SSOT schema (the only legal entry).
 * Items with invalid translations will not appear in the results; guard failure will throw in strict locale.
 */
export function paletteCommandsFromCompiledMenu(
  locale: UiLocaleId,
  merged: MessageDictionary,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
): PaletteCommandDef[] {
  return compileMenuForLocale(locale, merged, en, rawLocale).paletteCommands
}

/** @deprecated using `paletteCommandsFromCompiledMenu`*/
export { paletteCommandsFromCompiledMenu as paletteCommandsFromMenuSchema }

/** Legacy palette ids/history ids → canonical manifest command ids. */
const PALETTE_COMMAND_BRIDGE: Record<string, string> = {
  'export-pdf': 'file-export-pdf',
  'export-html': 'file-export-html',
  'export-html-plain': 'file-export-html-plain',
  'export-image': 'file-export-image',
  'export-word': 'file-export-word',
  'about': 'help-about',
  'editor-find': 'edit-find',
  'new-note': 'file-new',
  'insert-table': 'para-table-insert',
}

export function resolvePaletteCommandId(id: string): string {
  if (COMMAND_MANIFEST[id]) return id
  return PALETTE_COMMAND_BRIDGE[id] ?? id
}
