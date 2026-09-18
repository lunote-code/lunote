import { useEffect, useState } from 'react'

import { getAppSettingsSnapshot, subscribeAppSettings } from '../../settings/appSettingsStore'
import { isAiConfiguredFromSettings, resolveAiSettings } from '../../settings-runtime/aiSettings'
import {
  resolveAiButtonEnabled,
  resolveDocumentStatsEnabled,
  resolveFocusButtonEnabled,
  resolveFocusExitButtonEnabled,
  resolveGlobalSearchButtonEnabled,
  resolveGraphButtonEnabled,
  resolveNoteCalendarButtonEnabled,
} from '../../settings-runtime/editorUiChrome'

export type EditorUiChromeSettingsSnapshot = {
  focusButtonEnabled: boolean
  graphButtonEnabled: boolean
  aiButtonEnabled: boolean
  globalSearchButtonEnabled: boolean
  noteCalendarButtonEnabled: boolean
  aiConfigured: boolean
  focusExitButtonEnabled: boolean
  documentStatsEnabled: boolean
}

function readEditorUiChromeSettings(): EditorUiChromeSettingsSnapshot {
  const snapshot = getAppSettingsSnapshot()
  const ui = snapshot.appearance?.ui
  return {
    focusButtonEnabled: resolveFocusButtonEnabled(ui),
    graphButtonEnabled: resolveGraphButtonEnabled(ui),
    aiButtonEnabled: resolveAiButtonEnabled(ui),
    globalSearchButtonEnabled: resolveGlobalSearchButtonEnabled(ui),
    noteCalendarButtonEnabled: resolveNoteCalendarButtonEnabled(ui),
    aiConfigured: isAiConfiguredFromSettings(resolveAiSettings(snapshot)),
    focusExitButtonEnabled: resolveFocusExitButtonEnabled(ui),
    documentStatsEnabled: resolveDocumentStatsEnabled(ui),
  }
}

export function useEditorUiChromeSettings(): EditorUiChromeSettingsSnapshot {
  const [settings, setSettings] = useState(readEditorUiChromeSettings)

  useEffect(() => {
    return subscribeAppSettings(() => {
      setSettings(readEditorUiChromeSettings())
    })
  }, [])

  return settings
}
