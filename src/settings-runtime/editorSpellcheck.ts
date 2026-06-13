export const EDITOR_SPELLCHECK_ENABLED_DEFAULT = true

type EditorSpellcheckSettings = {
  spellcheckEnabled?: boolean
} | undefined

export function normalizeEditorSpellcheckEnabled(enabled: unknown): boolean {
  if (typeof enabled === 'boolean') return enabled
  return EDITOR_SPELLCHECK_ENABLED_DEFAULT
}

export function resolveEditorSpellcheckEnabled(editor: EditorSpellcheckSettings): boolean {
  return normalizeEditorSpellcheckEnabled(editor?.spellcheckEnabled)
}

export function editorSpellcheckDomAttribute(enabled: boolean): 'true' | 'false' {
  return enabled ? 'true' : 'false'
}
