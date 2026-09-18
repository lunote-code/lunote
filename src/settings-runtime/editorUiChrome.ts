export const FOCUS_BUTTON_ENABLED_DEFAULT = true
export const GRAPH_BUTTON_ENABLED_DEFAULT = true
export const AI_BUTTON_ENABLED_DEFAULT = true
export const GLOBAL_SEARCH_BUTTON_ENABLED_DEFAULT = true
export const NOTE_CALENDAR_BUTTON_ENABLED_DEFAULT = true
export const FOCUS_EXIT_BUTTON_ENABLED_DEFAULT = true
export const DOCUMENT_STATS_ENABLED_DEFAULT = true
export const TOAST_NOTIFICATIONS_ENABLED_DEFAULT = true

export type EditorUiChromeSettings = {
  /** @deprecated migrated to focusButtonEnabled + graphButtonEnabled */
  editorChromeButtonsEnabled?: boolean
  focusButtonEnabled?: boolean
  graphButtonEnabled?: boolean
  aiButtonEnabled?: boolean
  globalSearchButtonEnabled?: boolean
  noteCalendarButtonEnabled?: boolean
  /** @deprecated use globalSearchButtonEnabled */
  tabSwitcherButtonEnabled?: boolean
  focusExitButtonEnabled?: boolean
  documentStatsEnabled?: boolean
  toastNotificationsEnabled?: boolean
} | undefined

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function legacyChromeButtonsDisabled(ui: EditorUiChromeSettings): boolean | undefined {
  if (typeof ui?.editorChromeButtonsEnabled !== 'boolean') return undefined
  return !ui.editorChromeButtonsEnabled
}

export function resolveFocusButtonEnabled(ui: EditorUiChromeSettings): boolean {
  const legacyDisabled = legacyChromeButtonsDisabled(ui)
  if (legacyDisabled === true) return false
  return normalizeBoolean(ui?.focusButtonEnabled, FOCUS_BUTTON_ENABLED_DEFAULT)
}

export function resolveGraphButtonEnabled(ui: EditorUiChromeSettings): boolean {
  const legacyDisabled = legacyChromeButtonsDisabled(ui)
  if (legacyDisabled === true) return false
  return normalizeBoolean(ui?.graphButtonEnabled, GRAPH_BUTTON_ENABLED_DEFAULT)
}

export function resolveAiButtonEnabled(ui: EditorUiChromeSettings): boolean {
  return normalizeBoolean(ui?.aiButtonEnabled, AI_BUTTON_ENABLED_DEFAULT)
}

export function resolveGlobalSearchButtonEnabled(ui: EditorUiChromeSettings): boolean {
  if (typeof ui?.globalSearchButtonEnabled === 'boolean') return ui.globalSearchButtonEnabled
  return normalizeBoolean(ui?.tabSwitcherButtonEnabled, GLOBAL_SEARCH_BUTTON_ENABLED_DEFAULT)
}

export function resolveNoteCalendarButtonEnabled(ui: EditorUiChromeSettings): boolean {
  return normalizeBoolean(ui?.noteCalendarButtonEnabled, NOTE_CALENDAR_BUTTON_ENABLED_DEFAULT)
}

export function resolveFocusExitButtonEnabled(ui: EditorUiChromeSettings): boolean {
  return normalizeBoolean(ui?.focusExitButtonEnabled, FOCUS_EXIT_BUTTON_ENABLED_DEFAULT)
}

export function resolveDocumentStatsEnabled(ui: EditorUiChromeSettings): boolean {
  return normalizeBoolean(ui?.documentStatsEnabled, DOCUMENT_STATS_ENABLED_DEFAULT)
}

export function resolveToastNotificationsEnabled(ui: EditorUiChromeSettings): boolean {
  return normalizeBoolean(ui?.toastNotificationsEnabled, TOAST_NOTIFICATIONS_ENABLED_DEFAULT)
}

export function normalizeEditorUiChromeSettings(
  ui: EditorUiChromeSettings,
): {
  focusButtonEnabled: boolean
  graphButtonEnabled: boolean
  aiButtonEnabled: boolean
  globalSearchButtonEnabled: boolean
  noteCalendarButtonEnabled: boolean
  focusExitButtonEnabled: boolean
  documentStatsEnabled: boolean
  toastNotificationsEnabled: boolean
} {
  return {
    focusButtonEnabled: resolveFocusButtonEnabled(ui),
    graphButtonEnabled: resolveGraphButtonEnabled(ui),
    aiButtonEnabled: resolveAiButtonEnabled(ui),
    globalSearchButtonEnabled: resolveGlobalSearchButtonEnabled(ui),
    noteCalendarButtonEnabled: resolveNoteCalendarButtonEnabled(ui),
    focusExitButtonEnabled: resolveFocusExitButtonEnabled(ui),
    documentStatsEnabled: resolveDocumentStatsEnabled(ui),
    toastNotificationsEnabled: resolveToastNotificationsEnabled(ui),
  }
}
