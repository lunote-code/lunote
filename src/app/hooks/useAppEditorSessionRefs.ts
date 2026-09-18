import { useCallback, useRef, useState, type Dispatch, type MutableRefObject } from 'react'
import type { EditorView } from '@codemirror/view'

import { EditorOpenReason } from '../../editor/editorOpenReason'
import type { ModeSwitchFsmAction } from '../../editor/modeSwitchFSM'
import type { SourceModeEnterAnchor } from '../../editor/viewportModeAnchor'
import type { AtomicVisualDocumentEnter, TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { bumpFileStatGeneration } from '../../lib/fileStatGeneration'
import { bumpModeSwitchGeneration } from '../../lib/modeSwitchGeneration'

export type FileStatSnapshot = {
  modifiedSecs: number
  size: number
}

export type AppEditorSessionRefs = {
  tabNavGenerationRef: MutableRefObject<number>
  modeSwitchGenerationRef: MutableRefObject<number>
  externalReloadGenerationRef: MutableRefObject<number>
  fileStatGenerationRef: MutableRefObject<number>
  fileStatRef: MutableRefObject<Record<string, FileStatSnapshot>>
  suppressWorkspaceRefreshUntilRef: MutableRefObject<number>
  kernelContentDebounceRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  documentNavigationInProgressRef: MutableRefObject<boolean>
  editorViewRef: MutableRefObject<EditorView | null>
  visualEditorRef: MutableRefObject<TiptapMarkdownEditorHandle | null>
  modeToggleRetryCountRef: MutableRefObject<number>
  suppressMarkdownSerdeRef: MutableRefObject<boolean>
  pendingSourceModeAnchorRef: MutableRefObject<SourceModeEnterAnchor | null>
  sourceCodeMirrorBootSelectionRef: MutableRefObject<{
    from: number
    to: number
    scrollTop?: number
    scrollRatio?: number
  } | null>
  coldOpenGeneration: number
  bumpColdOpenGeneration: () => void
  sourceCodeMirrorInstanceKey: number
  setSourceCodeMirrorInstanceKey: Dispatch<React.SetStateAction<number>>
  resetModeSwitchEditorBootstrap: () => void
  invalidateFileStatCache: () => void
}

type Params = {
  dispatchModeSwitchFsm: Dispatch<ModeSwitchFsmAction>
  setAtomicVisualDocumentEnter: Dispatch<React.SetStateAction<AtomicVisualDocumentEnter | null>>
  setEditorOpenReason: Dispatch<React.SetStateAction<EditorOpenReason>>
  logModeSwitchState?: (phase: string) => void
}

/** Centralizes editor session refs shared across tab navigation, mode switch, and external sync. */
export function useAppEditorSessionRefs({
  dispatchModeSwitchFsm,
  setAtomicVisualDocumentEnter,
  setEditorOpenReason,
  logModeSwitchState = () => {},
}: Params): AppEditorSessionRefs {
  const tabNavGenerationRef = useRef(0)
  const modeSwitchGenerationRef = useRef(0)
  const externalReloadGenerationRef = useRef(0)
  const fileStatGenerationRef = useRef(0)
  const fileStatRef = useRef<Record<string, FileStatSnapshot>>({})
  const suppressWorkspaceRefreshUntilRef = useRef(0)
  const kernelContentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const documentNavigationInProgressRef = useRef(false)
  const editorViewRef = useRef<EditorView | null>(null)
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const modeToggleRetryCountRef = useRef(0)
  const suppressMarkdownSerdeRef = useRef(false)
  const pendingSourceModeAnchorRef = useRef<SourceModeEnterAnchor | null>(null)
  const sourceCodeMirrorBootSelectionRef = useRef<{
    from: number
    to: number
    scrollTop?: number
    scrollRatio?: number
  } | null>(null)
  const [sourceCodeMirrorInstanceKey, setSourceCodeMirrorInstanceKey] = useState(0)
  const [coldOpenGeneration, setColdOpenGeneration] = useState(0)

  const bumpColdOpenGeneration = useCallback(() => {
    setColdOpenGeneration((n) => n + 1)
  }, [])

  const invalidateFileStatCache = useCallback(() => {
    bumpFileStatGeneration(fileStatGenerationRef)
    fileStatRef.current = {}
  }, [])

  const resetModeSwitchEditorBootstrap = useCallback(() => {
    logModeSwitchState('resetModeSwitchEditorBootstrap')
    bumpModeSwitchGeneration(modeSwitchGenerationRef)
    pendingSourceModeAnchorRef.current = null
    setAtomicVisualDocumentEnter(null)
    sourceCodeMirrorBootSelectionRef.current = null
    setEditorOpenReason(EditorOpenReason.ColdOpen)
    dispatchModeSwitchFsm({ type: 'CLEAR_MODE_SWITCH_PAYLOAD' })
  }, [dispatchModeSwitchFsm, logModeSwitchState, setAtomicVisualDocumentEnter, setEditorOpenReason])

  return {
    tabNavGenerationRef,
    modeSwitchGenerationRef,
    externalReloadGenerationRef,
    fileStatGenerationRef,
    fileStatRef,
    suppressWorkspaceRefreshUntilRef,
    kernelContentDebounceRef,
    documentNavigationInProgressRef,
    editorViewRef,
    visualEditorRef,
    modeToggleRetryCountRef,
    suppressMarkdownSerdeRef,
    pendingSourceModeAnchorRef,
    sourceCodeMirrorBootSelectionRef,
    coldOpenGeneration,
    bumpColdOpenGeneration,
    sourceCodeMirrorInstanceKey,
    setSourceCodeMirrorInstanceKey,
    resetModeSwitchEditorBootstrap,
    invalidateFileStatCache,
  }
}
