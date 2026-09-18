import type { MutableRefObject } from 'react'

import type { ModeSwitchAnchorPayload, ModeSwitchFsmState } from '../../editor/modeSwitchFSM'
import type { TranslateFn } from '../../i18n'
import type { AppStatusTone } from '../hooks/useAppStatus'
import {
  useEditorModeSwitch,
  type EditorModeSwitchRefs,
  type EditorModeSwitchSetters,
} from '../hooks/useEditorModeSwitch'
import { useEditorCommands } from '../hooks/useEditorCommands'

export type EditorChromeControllerParams = {
  t: TranslateFn
  mainPaneMode: 'visual' | 'source'
  modeSwitchFsm: ModeSwitchFsmState
  activePath: string
  refs: EditorModeSwitchRefs & {
    documentNavigationInProgressRef: MutableRefObject<boolean>
    kernelContentDebounceRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  }
  setters: EditorModeSwitchSetters
  onModeSwitchAnchorPayload: (payload: ModeSwitchAnchorPayload | null) => void
  onModeSwitchEnhancementFailed: (error: unknown) => void
  onModeSwitchApplyingAnchor: () => void
  logModeSwitchState: (phase: string) => void
  onModeSwitchBusyChange: (busy: boolean) => void
  onModeSwitchBlocked: (reason: 'code-block') => void
  pasteImageIntoVisualEditor: (file: File, mimeHint: string) => Promise<string | null>
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
}

/** Editor mode switch + command surface extracted from AppRoot orchestration. */
export function useEditorChromeController(params: EditorChromeControllerParams) {
  const {
    t,
    mainPaneMode,
    modeSwitchFsm,
    activePath,
    refs,
    setters,
    onModeSwitchAnchorPayload,
    onModeSwitchEnhancementFailed,
    onModeSwitchApplyingAnchor,
    logModeSwitchState,
    onModeSwitchBusyChange,
    onModeSwitchBlocked,
    pasteImageIntoVisualEditor,
    setStatus,
  } = params

  const {
    documentNavigationInProgressRef,
    kernelContentDebounceRef,
    activePathRef,
    contentRef,
    visualEditorRef,
    editorViewRef,
    mainPaneModeRef,
    pendingSourceModeAnchorRef,
    sourceCodeMirrorBootSelectionRef,
    suppressMarkdownSerdeRef,
    modeToggleRetryCountRef,
    modeSwitchGenerationRef,
  } = refs

  const modeSwitch = useEditorModeSwitch({
    mainPaneMode,
    modeSwitchFsm,
    activePath,
    refs: {
      activePathRef,
      contentRef,
      visualEditorRef,
      editorViewRef,
      mainPaneModeRef,
      pendingSourceModeAnchorRef,
      sourceCodeMirrorBootSelectionRef,
      suppressMarkdownSerdeRef,
      modeToggleRetryCountRef,
      modeSwitchGenerationRef,
    },
    setters,
    onModeSwitchAnchorPayload,
    onModeSwitchEnhancementFailed,
    onModeSwitchApplyingAnchor,
    logModeSwitchState,
    onModeSwitchBusyChange,
    onModeSwitchBlocked,
  })

  const commands = useEditorCommands({
    t,
    mainPaneMode,
    mainPaneModeRef,
    activePathRef,
    contentRef,
    documentNavigationInProgressRef,
    visualEditorRef,
    editorViewRef,
    kernelContentDebounceRef,
    pasteImageIntoVisualEditor,
    setStatus,
  })

  return {
    ...modeSwitch,
    ...commands,
  }
}
