import { useCallback, useRef, type Dispatch, type MutableRefObject, type RefObject } from 'react'
import { EditorView } from '@codemirror/view'
import { reconfigureCmManifestKeymap } from '../../editor/cmManifestBridge'
import { debugModeSwitch, describeScrollMetrics, describeSelectionInText, summarizeSnapshot } from '../../editor/modeSwitchDebug'
import { EditorOpenReason } from '../../editor/editorOpenReason'
import type { ModeSwitchAnchorPayload, ModeSwitchFsmAction, ModeSwitchFsmState } from '../../editor/modeSwitchFSM'
import { decideModeToggleCommandAction } from '../../editor/modeToggleCommandSemantics'
import { prepareSourceToVisualTransition, prepareVisualToSourceTransition } from '../../editor/modeSwitchTransitionPrepare'
import { reportModeSwitchFreezeFailure } from '../../editor/modeSwitchFreezeFailure'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { VIEWPORT_DOCUMENT_NODE_ID, viewportAnchorEngine } from '../../editor/viewportAnchorEngine'
import type { SourceModeEnterAnchor } from '../../editor/viewportModeAnchor'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { AtomicVisualDocumentEnter, TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
export type EditorModeSwitchRefs = {
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: RefObject<EditorView | null>
  mainPaneModeRef: RefObject<'visual' | 'source'>
  pendingSourceModeAnchorRef: MutableRefObject<SourceModeEnterAnchor | null>
  sourceCodeMirrorBootSelectionRef: MutableRefObject<{
    from: number
    to: number
    scrollTop?: number
    scrollRatio?: number
  } | null>
  suppressMarkdownSerdeRef: MutableRefObject<boolean>
  modeToggleRetryCountRef: MutableRefObject<number>
}

export type EditorModeSwitchSetters = {
  setMainPaneMode: (mode: 'visual' | 'source') => void
  setAtomicVisualDocumentEnter: Dispatch<React.SetStateAction<AtomicVisualDocumentEnter | null>>
  setSourceCodeMirrorInstanceKey: Dispatch<React.SetStateAction<number>>
  setEditorOpenReason: Dispatch<React.SetStateAction<EditorOpenReason>>
  dispatchModeSwitchFsm: Dispatch<ModeSwitchFsmAction>
}

export type UseEditorModeSwitchParams = {
  mainPaneMode: 'visual' | 'source'
  modeSwitchFsm: ModeSwitchFsmState
  activePath: string
  refs: EditorModeSwitchRefs
  setters: EditorModeSwitchSetters
  onModeSwitchAnchorPayload: (payload: ModeSwitchAnchorPayload | null) => void
  onModeSwitchEnhancementFailed: (error: unknown) => void
  onModeSwitchApplyingAnchor: () => void
  logModeSwitchState: (phase: string) => void
}

export function useEditorModeSwitch({
  mainPaneMode,
  modeSwitchFsm,
  activePath,
  refs,
  setters,
  onModeSwitchAnchorPayload,
  onModeSwitchEnhancementFailed,
  onModeSwitchApplyingAnchor,
  logModeSwitchState,
}: UseEditorModeSwitchParams) {
  const {
    activePathRef,
    contentRef,
    visualEditorRef,
    editorViewRef,
    pendingSourceModeAnchorRef,
    sourceCodeMirrorBootSelectionRef,
    suppressMarkdownSerdeRef,
    modeToggleRetryCountRef,
  } = refs
  const {
    setMainPaneMode,
    setAtomicVisualDocumentEnter,
    setSourceCodeMirrorInstanceKey,
    setEditorOpenReason,
    dispatchModeSwitchFsm,
  } = setters
  const modeToggleInFlightRef = useRef(false)
  const modeToggleCooldownUntilRef = useRef(0)
  const MODE_TOGGLE_COOLDOWN_MS = 180

  const getModeToggleVisualContext = useCallback(() => {
    const visual = visualEditorRef.current
    return {
      visual,
      activeBlockType: visual?.getActiveBlockType() ?? null,
      hasActiveLocalSourceIsland: visual?.hasActiveLocalSourceIsland() ?? false,
    }
  }, [visualEditorRef])

  const isVisualEditorBoundToActivePath = useCallback((): boolean => {
    const path = activePathRef.current
    if (!path || mainPaneMode !== 'visual') return true
    const visual = visualEditorRef.current
    if (!visual) return false
    return pathsEqual(visual.getBoundDocumentKey(), path)
  }, [activePathRef, mainPaneMode, visualEditorRef])

  const switchToSourceMode = useCallback(async () => {
    if (mainPaneMode !== 'visual') return
    const dk = activePathRef.current || 'scratch'
    if (!isVisualEditorBoundToActivePath()) return
    const visual = visualEditorRef.current
    if (visual?.waitForCompositionEnd) {
      await visual.waitForCompositionEnd()
    }
    suppressMarkdownSerdeRef.current = true
    const prep = prepareVisualToSourceTransition({
      documentKey: dk,
      contentFallback: contentRef.current,
      visualEditor: visual,
      onFailed: onModeSwitchEnhancementFailed,
    })
    setSourceModeIdentity(dk, prep.markdown)
    setAtomicVisualDocumentEnter(null)
    const visualScrollRatio = visual?.getProseMirrorScrollRatio?.() ?? undefined
    sourceCodeMirrorBootSelectionRef.current = prep.sourceEnter
      ? { from: prep.sourceEnter.cmAnchor, to: prep.sourceEnter.cmHead, scrollRatio: visualScrollRatio ?? undefined }
      : prep.cmSelection
        ? { from: prep.cmSelection.from, to: prep.cmSelection.to, scrollRatio: visualScrollRatio ?? undefined }
        : null
    debugModeSwitch('[mode-switch][visual->source][dispatch]', {
      documentKey: dk,
      resultKind: prep.resultKind,
      bridgeId: prep.sourceEnter?.bridgeId ?? null,
      visualScroll: describeScrollMetrics((visual?.getEditor?.()?.view.dom as HTMLElement | undefined) ?? null),
      visualScrollRatio,
      cmSelection: prep.sourceEnter
        ? describeSelectionInText(prep.markdown, prep.sourceEnter.cmAnchor, prep.sourceEnter.cmHead)
        : prep.cmSelection
          ? describeSelectionInText(prep.markdown, prep.cmSelection.from, prep.cmSelection.to)
          : null,
      pmSelection: prep.pmSelection,
      snapshot: summarizeSnapshot(prep.sourceEnter?.modeSwitchSnapshot),
    })
    setSourceCodeMirrorInstanceKey((k) => k + 1)
    void dispatchDocumentCommand({
      type: 'DOCUMENT_CONTENT_CHANGED',
      path: dk,
      content: prep.markdown,
      source: 'mode-switch',
    })
    pendingSourceModeAnchorRef.current = prep.sourceEnter
    if (prep.sourceEnter) {
      try {
        viewportAnchorEngine.recordAnchorLeavingEditor(prep.sourceEnter)
      } catch (e) {
        reportModeSwitchFreezeFailure(e, { documentKey: dk, phase: 'recordAnchorLeavingEditor' })
      }
    }
    dispatchModeSwitchFsm({ type: 'ENTER_SOURCE', semantic: prep.semantic })
    logModeSwitchState('switchToSourceMode:before_pane')
    setEditorOpenReason(EditorOpenReason.ModeSwitchRestore)
    setMainPaneMode('source')
    onModeSwitchAnchorPayload(prep.anchorPayload)
    requestAnimationFrame(() => {
      suppressMarkdownSerdeRef.current = false
    })
  }, [
    mainPaneMode,
    isVisualEditorBoundToActivePath,
    activePathRef,
    contentRef,
    visualEditorRef,
    onModeSwitchAnchorPayload,
    onModeSwitchEnhancementFailed,
    logModeSwitchState,
    setAtomicVisualDocumentEnter,
    setSourceCodeMirrorInstanceKey,
    setEditorOpenReason,
    dispatchModeSwitchFsm,
    setMainPaneMode,
    pendingSourceModeAnchorRef,
    sourceCodeMirrorBootSelectionRef,
    suppressMarkdownSerdeRef,
  ])

  const switchToVisualMode = useCallback(() => {
    if (mainPaneMode !== 'source') return
    suppressMarkdownSerdeRef.current = true
    const dk = activePathRef.current || 'scratch'
    const cmSelectionBeforeSwitch = editorViewRef.current
      ? {
          from: editorViewRef.current.state.selection.main.anchor,
          to: editorViewRef.current.state.selection.main.head,
          scrollRatio: (() => {
            const dom = editorViewRef.current?.scrollDOM
            if (!dom) return undefined
            const max = dom.scrollHeight - dom.clientHeight
            if (!Number.isFinite(max) || max <= 0) return 0
            const top = dom.scrollTop
            if (!Number.isFinite(top)) return undefined
            return Math.max(0, Math.min(1, top / max))
          })(),
        }
      : null
    const prep = prepareSourceToVisualTransition({
      documentKey: dk,
      editorView: editorViewRef.current,
      pendingSourceModeAnchorRef,
      onFailed: onModeSwitchEnhancementFailed,
    })
    contentRef.current = prep.markdown
    setSourceModeIdentity(dk, prep.markdown)
    void dispatchDocumentCommand({
      type: 'DOCUMENT_CONTENT_CHANGED',
      path: dk,
      content: prep.markdown,
      source: 'mode-switch',
    })
    sourceCodeMirrorBootSelectionRef.current = null
    const snapshotPm = prep.visualRestore?.modeSwitchSnapshot
      ? {
          from: prep.visualRestore.modeSwitchSnapshot.expectedPmAnchor,
          to: prep.visualRestore.modeSwitchSnapshot.expectedPmHead,
        }
      : null
    const pm = prep.semantic.pmSelection
    const appliedPm = snapshotPm ?? pm
    debugModeSwitch('[mode-switch][source->visual][dispatch]', {
      documentKey: dk,
      resultKind: prep.resultKind,
      restoreKind: prep.visualRestore?.resultKind ?? null,
      bridgeId: prep.visualRestore?.bridgeId ?? null,
      cmSelection: cmSelectionBeforeSwitch
        ? describeSelectionInText(prep.markdown, cmSelectionBeforeSwitch.from, cmSelectionBeforeSwitch.to)
        : null,
      cmScroll: describeScrollMetrics(editorViewRef.current?.scrollDOM ?? null),
      semanticPm: pm,
      snapshotPm,
      appliedPm,
      snapshot: summarizeSnapshot(prep.visualRestore?.modeSwitchSnapshot),
    })
    if (prep.visualRestore && appliedPm) {
      setAtomicVisualDocumentEnter({
        documentKey: dk,
        pmAnchor: appliedPm.from,
        pmHead: appliedPm.to,
        scrollRatio: cmSelectionBeforeSwitch?.scrollRatio,
        modeSwitchSnapshot: prep.visualRestore.modeSwitchSnapshot ?? null,
      })
    } else {
      setAtomicVisualDocumentEnter(null)
    }
    editorViewRef.current = null
    dispatchModeSwitchFsm({ type: 'ENTER_VISUAL', semantic: prep.semantic })
    logModeSwitchState('switchToVisualMode:before_pane')
    setEditorOpenReason(EditorOpenReason.ModeSwitchRestore)
    setMainPaneMode('visual')
    if (prep.visualRestore) onModeSwitchApplyingAnchor()
    onModeSwitchAnchorPayload(prep.anchorPayload)
    requestAnimationFrame(() => {
      suppressMarkdownSerdeRef.current = false
    })
  }, [
    mainPaneMode,
    activePath,
    activePathRef,
    contentRef,
    editorViewRef,
    onModeSwitchAnchorPayload,
    onModeSwitchEnhancementFailed,
    onModeSwitchApplyingAnchor,
    logModeSwitchState,
    setAtomicVisualDocumentEnter,
    setEditorOpenReason,
    dispatchModeSwitchFsm,
    setMainPaneMode,
    pendingSourceModeAnchorRef,
    sourceCodeMirrorBootSelectionRef,
    suppressMarkdownSerdeRef,
  ])

  const tryOpenSourceIslandForActiveBlock = useCallback((): boolean => {
    if (mainPaneMode !== 'visual') return false
    if (!isVisualEditorBoundToActivePath()) return false
    const { visual, activeBlockType } = getModeToggleVisualContext()
    if (!visual) return false
    const opened = visual.openSourceIslandForActiveBlock()
    if (!opened) return false
    debugModeSwitch('[mode-switch][visual][block-source-island]', {
      documentKey: activePathRef.current || 'scratch',
      blockType: activeBlockType,
    })
    return true
  }, [activePathRef, getModeToggleVisualContext, isVisualEditorBoundToActivePath, mainPaneMode])

  const tryCloseSourceIslandForActiveBlock = useCallback((): boolean => {
    if (mainPaneMode !== 'visual') return false
    if (!isVisualEditorBoundToActivePath()) return false
    const { visual, activeBlockType } = getModeToggleVisualContext()
    if (!visual) return false
    const closed = visual.closeSourceIslandForActiveBlock()
    if (!closed) return false
    debugModeSwitch('[mode-switch][visual][block-source-island-exit]', {
      documentKey: activePathRef.current || 'scratch',
      blockType: activeBlockType,
    })
    return true
  }, [activePathRef, getModeToggleVisualContext, isVisualEditorBoundToActivePath, mainPaneMode])

  const dispatchModeToggle = useCallback(() => {
    const now = Date.now()
    if (modeToggleInFlightRef.current || now < modeToggleCooldownUntilRef.current) return
    if (mainPaneMode === 'visual' && !isVisualEditorBoundToActivePath()) {
      if (modeToggleRetryCountRef.current < 8) {
        modeToggleRetryCountRef.current += 1
        requestAnimationFrame(() => {
          dispatchModeToggle()
        })
      }
      return
    }
    if (mainPaneMode === 'visual') {
      const { activeBlockType, hasActiveLocalSourceIsland } = getModeToggleVisualContext()
      const action = decideModeToggleCommandAction({
        mainPaneMode,
        activeBlockType,
        hasActiveLocalSourceIsland,
      })
      if (action === 'suppress_in_code_block') return
      if (action === 'close_local_source_island' && tryCloseSourceIslandForActiveBlock()) {
        modeToggleCooldownUntilRef.current = now + MODE_TOGGLE_COOLDOWN_MS
        return
      }
      if (action === 'open_local_source_island' && tryOpenSourceIslandForActiveBlock()) {
        modeToggleCooldownUntilRef.current = now + MODE_TOGGLE_COOLDOWN_MS
        return
      }
    }
    modeToggleRetryCountRef.current = 0
    modeToggleInFlightRef.current = true
    const runToggle = async () => {
      try {
        if (modeSwitchFsm.mode === 'source' || mainPaneMode === 'source') switchToVisualMode()
        else await switchToSourceMode()
      } finally {
        requestAnimationFrame(() => {
          modeToggleCooldownUntilRef.current = Date.now() + MODE_TOGGLE_COOLDOWN_MS
          modeToggleInFlightRef.current = false
        })
      }
    }
    void runToggle()
  }, [
    modeSwitchFsm.mode,
    mainPaneMode,
    switchToSourceMode,
    switchToVisualMode,
    getModeToggleVisualContext,
    isVisualEditorBoundToActivePath,
    tryCloseSourceIslandForActiveBlock,
    tryOpenSourceIslandForActiveBlock,
    modeToggleRetryCountRef,
  ])

  const handleSourceViewReady = useCallback(
    (view: EditorView) => {
      editorViewRef.current = view
      reconfigureCmManifestKeymap(view)
      viewportAnchorEngine.registerSourceNode(
        VIEWPORT_DOCUMENT_NODE_ID,
        view.scrollDOM,
        view.contentDOM as HTMLElement,
      )
      const pending = pendingSourceModeAnchorRef.current
      const bootSelection = sourceCodeMirrorBootSelectionRef.current
      if (pending != null) {
        pendingSourceModeAnchorRef.current = null
        onModeSwitchApplyingAnchor()
      }
      if (bootSelection || pending) {
        sourceCodeMirrorBootSelectionRef.current = null
      }
    },
    [editorViewRef, onModeSwitchApplyingAnchor, pendingSourceModeAnchorRef, sourceCodeMirrorBootSelectionRef],
  )

  return {
    isVisualEditorBoundToActivePath,
    switchToSourceMode,
    switchToVisualMode,
    dispatchModeToggle,
    toggleMainPaneMode: dispatchModeToggle,
    handleSourceViewReady,
  }
}
