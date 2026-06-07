export const EDITOR_FORMAT_TOOLBAR_ENABLED_DEFAULT = true

const LEGACY_PINNED_STORAGE_KEY = 'editorFormatToolbarPinned'

type EditorToolbarSettings = {
  formatToolbarEnabled?: boolean
  /** @deprecated stripped on load; only `hidden` maps to false */
  formatToolbarMode?: string
} | undefined

function legacyModeToEnabled(raw: unknown): boolean | undefined {
  if (raw === 'hidden') return false
  if (raw === 'visible' || raw === 'auto') return true
  return undefined
}

/** One-time migration from legacy localStorage pin flag when settings field is absent. */
export function migrateLegacyFormatToolbarPinned(): boolean | undefined {
  try {
    const pinned = localStorage.getItem(LEGACY_PINNED_STORAGE_KEY)
    if (pinned === '0') return false
    if (pinned === '1') return true
  } catch {
    /* ignore */
  }
  return undefined
}

export function clearLegacyFormatToolbarPinnedStorage(): void {
  try {
    localStorage.removeItem(LEGACY_PINNED_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function normalizeEditorFormatToolbarEnabled(
  enabled: unknown,
  legacyMode?: unknown,
): boolean {
  if (typeof enabled === 'boolean') return enabled
  const fromMode = legacyModeToEnabled(legacyMode)
  if (fromMode !== undefined) return fromMode
  return EDITOR_FORMAT_TOOLBAR_ENABLED_DEFAULT
}

export function resolveEditorFormatToolbarEnabled(editor: EditorToolbarSettings): boolean {
  return normalizeEditorFormatToolbarEnabled(
    editor?.formatToolbarEnabled,
    editor?.formatToolbarMode,
  )
}

export function needsFormatToolbarSettingsMigration(editor: EditorToolbarSettings): boolean {
  if (!editor) return true
  if (editor.formatToolbarMode !== undefined) return true
  return typeof editor.formatToolbarEnabled !== 'boolean'
}
