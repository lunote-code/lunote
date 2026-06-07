import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import type { EditorView as CmEditorView } from '@codemirror/view'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { LunaCodeLanguagePalette } from '../../LunaCodeLanguagePalette'
import {
  getLunaCodeLanguages,
  normalizeLanguageForLowlight,
  resolveCanonicalLanguageId,
} from '../../lunaCodeLanguages'
import { newMermaidBlockId } from '../../extensions/MermaidNode'
import { useI18n } from '../../../i18n'
import { exitCodeBlockBackward, exitCodeBlockForward, focusCodeBlockLangInput } from '../behavior/nav'
import { codeBlockNodeAt, resolveCodeBlockTextRange, resolveOwnedCodeBlockPos } from '../behavior/selection'
import {
  codeBlockCmCopySelection,
  codeBlockCmCutSelection,
  codeBlockCmPaste,
  codeBlockCmRestoreSelection,
  codeBlockCmSelectAll,
} from '../cm/codeBlockContextMenuActions'
import { isCodeBlockContextMenuDom } from '../cm/codeBlockCmDom'
import { useCodeBlockBoundary } from '../boundary'
import { registerCodeBlockSessionFlush, registerCodeBlockSessionExitEditing } from '../boundary/codeBlockSessionRegistry'
import { describePmLockState } from '../cm/codeBlockCmPmFocusLock'
import {
  acquireCodeBlockCmFocus,
  installCodeBlockCmMouseDownCapture,
} from '../cm/codeBlockCmInputFocus'
import { installCodeBlockCmClipboardCapture } from '../cm/codeBlockCmClipboard'
import {
  disablePmCodeBlockMirrorEditing,
  installPmCodeBlockMirrorReadOnlyGuard,
} from '../cm/codeBlockCmPmMirror'
import {
  debugCodeBlockCmFocus,
  describeDomTarget,
  describeFoldUiState,
  describePmSelection,
} from '../cm/codeBlockCmFocusDebug'
import { isCodeBlockCmDom, isCodeBlockCmMouseTarget } from '../cm/codeBlockCmDom'
import { isCodeBlockCmFocused } from '../cm/codeBlockCmFocus'
import { countDocumentLinesFromText } from '../model/lineModel'
import { redoLastTransaction, undoLastTransaction } from '../../../menu/commandTransaction'
import { deleteEmptyCodeBlock, commitCodeBlockSessionText } from '../pm/CodeBlockPmAdapter'
import { flushVmTiptapRecorderBatch, getVmTiptapRecorderDocId } from '../../../vm/vmTiptapRecorder'
import {
  INITIAL_CODE_BLOCK_SESSION_STATE,
  reduceCodeBlockSessionState,
  type CodeBlockSessionEvent,
} from '../state/codeBlockSessionState'
import { isCodeBlockCmEnabled } from '../cm/codeBlockCmFeature'
import { CodeBlockContextMenu, type CodeBlockContextMenuPick, type CodeBlockContextMenuState } from './CodeBlockContextMenu'
import { CodeBlockEditorSurface } from './CodeBlockEditorSurface'
import { CodeBlockStaticSurface } from './CodeBlockStaticSurface'
import { CodeBlockToolbar } from './CodeBlockToolbar'
import { useCodeBlockCopyFlashRoot } from './codeBlockCopyFlash'

const ENABLE_EXPERIMENTAL_DIFF = false
let controllerInstanceSeq = 0

export function CodeBlockNodeController(props: ReactNodeViewProps) {
  const { t } = useI18n()
  const { editor, node, updateAttributes, getPos } = props
  const attrLang = String(node.attrs.language ?? '')
  const folded = Boolean(node.attrs.folded)
  const diffMode = Boolean(node.attrs.diffMode)
  const toolbarHintId = useId()

  const wrapRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLButtonElement>(null)
  const cmViewRef = useRef<CmEditorView | null>(null)
  const sessionSyncingToPmRef = useRef(false)
  const pendingSessionDocRef = useRef<string | null>(null)
  const paletteOpenRef = useRef(false)
  const sessionModeRef = useRef(INITIAL_CODE_BLOCK_SESSION_STATE.mode)
  const pendingCmSelectionRef = useRef<number | null>(null)
  const stableOwnedBlockPosRef = useRef<number | null>(null)
  const commitPendingSessionToPmRef = useRef<() => void>(() => {})

  const sessionStateRef = useRef(INITIAL_CODE_BLOCK_SESSION_STATE)
  const [sessionState, setSessionState] = useState(INITIAL_CODE_BLOCK_SESSION_STATE)
  const dispatchSession = useCallback((event: CodeBlockSessionEvent) => {
    const next = reduceCodeBlockSessionState(sessionStateRef.current, event)
    if (next === sessionStateRef.current) return
    sessionStateRef.current = next
    paletteOpenRef.current = next.paletteOpen
    sessionModeRef.current = next.mode
    setSessionState(next)
  }, [])
  const [copyFlash, setCopyFlash] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [contextMenu, setContextMenu] = useState<CodeBlockContextMenuState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const contextMenuSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const [foldedLineCount, setFoldedLineCount] = useState(1)

  const cmEnabled = isCodeBlockCmEnabled()
  const cmAvailable = cmEnabled && !folded

  const langs = useMemo(() => getLunaCodeLanguages(), [])
  const displayLang = useMemo(() => {
    const canonical = resolveCanonicalLanguageId(attrLang) ?? attrLang
    const hit = langs.find((lang) => lang.id === canonical)
    return hit?.displayName ?? (attrLang.trim() ? attrLang : t('editor.codeBlock.plainText'))
  }, [attrLang, langs, t])

  const blockDocPos = getPos?.() ?? null
  const resolvedOwnedBlockPos = useMemo(
    () => resolveOwnedCodeBlockPos(editor, blockDocPos, node),
    [editor, blockDocPos, node],
  )
  if (resolvedOwnedBlockPos != null) {
    stableOwnedBlockPosRef.current = resolvedOwnedBlockPos
  }
  const ownedBlockPos = resolvedOwnedBlockPos ?? stableOwnedBlockPosRef.current
  const boundary = useCodeBlockBoundary(editor, ownedBlockPos)
  const selectionRange = resolveCodeBlockTextRange(editor.state.selection.$from)
  const selectionInOwnedBlock = selectionRange?.blockPos === ownedBlockPos
  const showCmEditor = cmAvailable
  const isEditing =
    showCmEditor &&
    (sessionState.mode === 'editing' || selectionInOwnedBlock || isCodeBlockCmFocused())

  const blockText = useMemo(() => node.textBetween(0, node.content.size, '\n', '\n'), [node])
  const [sessionDoc, setSessionDoc] = useState(blockText)

  const isOwnedBlockFoldedInPm = useCallback(() => {
    if (ownedBlockPos == null) return folded
    const block = codeBlockNodeAt(editor, ownedBlockPos)
    return Boolean(block?.attrs.folded)
  }, [editor, folded, ownedBlockPos])

  const logFoldStep = useCallback(
    (tag: string, extra?: Record<string, unknown>) => {
      const pos = resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
      const block = pos != null ? codeBlockNodeAt(editor, pos) : null
      const snap = boundary.snapshot()
      debugCodeBlockCmFocus(tag, {
        traceId: snap.foldTraceId ?? undefined,
        blockPos: pos,
        reactFolded: folded,
        pmFolded: block ? Boolean(block.attrs.folded) : null,
        sessionMode: sessionModeRef.current,
        foldOperation: snap.foldTransitionActive,
        cmAvailable,
        showCmEditor,
        isEditing,
        hasCmView: !!cmViewRef.current,
        pendingSessionDoc: pendingSessionDocRef.current != null,
        pmLock: describePmLockState(editor),
        pmSelection: describePmSelection(editor.view),
        ui: describeFoldUiState(wrapRef.current),
        activeElement: describeDomTarget(document.activeElement),
        ...extra,
      })
    },
    [boundary, cmAvailable, editor, folded, getPos, isEditing, node, showCmEditor],
  )

  const scheduleFoldWatchdog = useCallback(
    (traceId: string, expectedFolded: boolean) => {
      const sample = (phase: string) => {
        const pos = resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
        const block = pos != null ? codeBlockNodeAt(editor, pos) : null
        const pmFolded = block ? Boolean(block.attrs.folded) : null
        debugCodeBlockCmFocus('fold-watchdog', {
          traceId,
          phase,
          expectedFolded,
          pmFolded,
          attrMismatch: pmFolded !== expectedFolded,
          editorFrozen: !editor.isEditable,
          foldOperation: boundary.isFoldTransitionActive(),
          pmLock: describePmLockState(editor),
          ui: describeFoldUiState(wrapRef.current),
          activeElement: describeDomTarget(document.activeElement),
          cmMounted: !!cmViewRef.current,
        })
      }
      sample('sync')
      queueMicrotask(() => sample('microtask'))
      requestAnimationFrame(() => sample('raf'))
      window.setTimeout(() => sample('t+50ms'), 50)
      window.setTimeout(() => sample('t+150ms'), 150)
      window.setTimeout(() => sample('t+500ms'), 500)
    },
    [editor, getPos, node],
  )

  const commitPendingSessionToPm = useCallback(() => {
    const pos = resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
    const pending = pendingSessionDocRef.current
    if (pos == null || pending == null) return

    if (cmViewRef.current?.compositionStarted || editor.view.composing) {
      const cmView = cmViewRef.current
      const pmDom = editor.view.dom
      const retry = () => {
        cmView?.dom.removeEventListener('compositionend', retry)
        pmDom.removeEventListener('compositionend', retry)
        commitPendingSessionToPm()
      }
      cmView?.dom.addEventListener('compositionend', retry, { once: true })
      pmDom.addEventListener('compositionend', retry, { once: true })
      return
    }

    const foldTraceId = boundary.getFoldTraceId()
    if (foldTraceId) {
      debugCodeBlockCmFocus('fold-flush-commit', {
        traceId: foldTraceId,
        pendingLen: pending.length,
        pos,
        pmLock: describePmLockState(editor),
      })
    }

    pendingSessionDocRef.current = null
    sessionSyncingToPmRef.current = true
    disablePmCodeBlockMirrorEditing(wrapRef.current)
    commitCodeBlockSessionText(editor, pos, pending)
    queueMicrotask(() => {
      sessionSyncingToPmRef.current = false
      disablePmCodeBlockMirrorEditing(wrapRef.current)
    })
  }, [boundary, editor, getPos, node])

  commitPendingSessionToPmRef.current = commitPendingSessionToPm

  const scheduleCommit = useCallback(() => {
    boundary.scheduleCommit(() => commitPendingSessionToPmRef.current())
  }, [boundary])

  const flushSessionToPm = useCallback(() => {
    boundary.flushCommit(() => commitPendingSessionToPmRef.current())
  }, [boundary])

  useEffect(() => {
    return () => {
      boundary.flushCommit(() => commitPendingSessionToPmRef.current())
    }
  }, [boundary, editor])

  useEffect(() => {
    if (!cmEnabled || folded) {
      if (sessionModeRef.current !== 'display' || paletteOpenRef.current) {
        dispatchSession({ type: 'force-display' })
      }
      pendingSessionDocRef.current = null
    }
  }, [cmEnabled, folded])

  useEffect(() => {
    const instanceId = ++controllerInstanceSeq
    debugCodeBlockCmFocus('controller-mount', {
      instanceId,
      blockPos: ownedBlockPos,
      folded,
    })
    return () => {
      debugCodeBlockCmFocus('controller-unmount', {
        instanceId,
        blockPos: ownedBlockPos,
        folded,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lifecycle-only mount/unmount probe
  }, [])

  useEffect(() => {
    if (cmViewRef.current?.hasFocus) return
    setSessionDoc(blockText)
  }, [blockText, ownedBlockPos])

  useEffect(() => {
    const refreshFromPm = () => {
      if (sessionSyncingToPmRef.current) return
      const pos = resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
      if (pos == null) return
      const block = codeBlockNodeAt(editor, pos)
      if (!block) return
      const live = block.textBetween(0, block.content.size, '\n', '\n')
      const cmView = cmViewRef.current
      if (cmView?.compositionStarted) return
      if (cmView?.hasFocus) {
        const cmText = cmView.state.doc.toString()
        const pending = pendingSessionDocRef.current
        if (live === cmText || live === pending) return
      }
      setSessionDoc((prev) => (prev === live ? prev : live))
    }
    editor.on('update', refreshFromPm)
    return () => {
      editor.off('update', refreshFromPm)
    }
  }, [editor, getPos, isEditing, node])

  useEffect(() => {
    if (!folded) return
    setFoldedLineCount(countDocumentLinesFromText(blockText))
  }, [blockText, folded])

  useEffect(() => {
    if (!folded) {
      boundary.resetFoldedSelectionChipState()
      return
    }
    const focusChipIfSelectionEntered = () => {
      const pos = resolveOwnedCodeBlockPos(editor, getPos?.(), node)
      if (pos == null) return
      const range = resolveCodeBlockTextRange(editor.state.selection.$from)
      boundary.tryFocusChipOnFoldedSelectionEnter({
        isBlockFoldedInPm: isOwnedBlockFoldedInPm,
        inOwnedBlock: range?.blockPos === pos,
        chip: chipRef.current,
      })
    }
    editor.on('selectionUpdate', focusChipIfSelectionEntered)
    return () => {
      editor.off('selectionUpdate', focusChipIfSelectionEntered)
    }
  }, [boundary, editor, folded, getPos, isOwnedBlockFoldedInPm, node])

  useEffect(() => {
    if (!isEditing || !boundary.peekFocusCmAfterRender()) return
    const frame = window.requestAnimationFrame(() => {
      boundary.consumeFocusCmAfterRender()
      const view = cmViewRef.current
      if (view) {
        acquireCodeBlockCmFocus(view, { pmDom: editor.view.dom, wrap: wrapRef.current })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [boundary, editor, isEditing])

  const isOwnedCmFocused = useCallback(() => {
    if (!isCodeBlockCmFocused()) return false
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return false
    return Boolean(wrapRef.current?.contains(active))
  }, [])

  const activateCmEditing = useCallback(() => {
    if (!boundary.canAcquireCmEditing(isOwnedBlockFoldedInPm)) {
      const snap = boundary.snapshot()
      debugCodeBlockCmFocus('controller-activateCm-skipped', {
        traceId: snap.foldTraceId ?? undefined,
        foldOperation: snap.foldTransitionActive,
        foldedInPm: isOwnedBlockFoldedInPm(),
        pmLock: describePmLockState(editor),
      })
      return
    }
    if (!isOwnedCmFocused() && !editor.isEditable) {
      boundary.releasePmForToolbar()
    }
    boundary.lockPmForCm(wrapRef.current)
    if (sessionModeRef.current !== 'editing') {
      dispatchSession({ type: 'enter-editing' })
    }
  }, [boundary, editor, isOwnedBlockFoldedInPm, isOwnedCmFocused, dispatchSession])

  const activateCmEditingRef = useRef(activateCmEditing)
  activateCmEditingRef.current = activateCmEditing

  useEffect(() => {
    if (!cmAvailable) return
    return registerCodeBlockSessionFlush(editor, () => {
      flushSessionToPm()
    })
  }, [cmAvailable, editor, flushSessionToPm])

  useEffect(() => {
    if (!cmAvailable) return
    return registerCodeBlockSessionExitEditing(editor, () => {
      boundary.clearBlurExitTimer()
      if (sessionModeRef.current === 'editing') {
        dispatchSession({ type: 'exit-editing' })
      }
    })
  }, [boundary, cmAvailable, dispatchSession, editor])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !cmAvailable) return
    const disposeMirrorGuard = installPmCodeBlockMirrorReadOnlyGuard(wrap)
    const disposeCapture = installCodeBlockCmMouseDownCapture(wrap, {
      getCmView: () => cmViewRef.current,
      onActivateEditing: () => activateCmEditingRef.current(),
      editor,
      onRightMouseDownPreserveSelection: (view) => {
        boundary.suppressBlurForCm(800)
        const main = view.state.selection.main
        if (main.from === main.to) return
        contextMenuSelectionRef.current = { from: main.from, to: main.to }
      },
    })
    const disposeClipboard = installCodeBlockCmClipboardCapture(wrap, {
      getCmView: () => cmViewRef.current,
    })
    return () => {
      disposeMirrorGuard()
      disposeCapture()
      disposeClipboard()
    }
  }, [cmAvailable, editor])

  const cmRefocusGuardRef = useRef(0)

  const scheduleFocusCm = useCallback(() => {
    if (!boundary.canAcquireCmEditing(isOwnedBlockFoldedInPm)) {
      const snap = boundary.snapshot()
      debugCodeBlockCmFocus('controller-scheduleFocusCm-skipped', {
        traceId: snap.foldTraceId ?? undefined,
        foldOperation: snap.foldTransitionActive,
        foldedInPm: isOwnedBlockFoldedInPm(),
      })
      return
    }
    boundary.requestFocusCmAfterRender()
    debugCodeBlockCmFocus('controller-scheduleFocusCm', {
      hasView: !!cmViewRef.current,
      sessionMode: sessionModeRef.current,
      pmSelection: describePmSelection(editor.view),
    })
    const pmDom = editor.view.dom
    const focusNow = () => {
      boundary.consumeFocusCmAfterRender()
      const view = cmViewRef.current
      if (!view) return
      if (view.hasFocus) {
        activateCmEditing()
        return
      }
      const pending = pendingCmSelectionRef.current
      if (pending != null) {
        const pos = Math.max(0, Math.min(pending, view.state.doc.length))
        view.dispatch({ selection: { anchor: pos, head: pos } })
        pendingCmSelectionRef.current = null
      }
      activateCmEditing()
      acquireCodeBlockCmFocus(view, { pmDom, wrap: wrapRef.current })
      requestAnimationFrame(() => {
        debugCodeBlockCmFocus('controller-focusCm', {
          cmHasFocus: cmViewRef.current?.hasFocus ?? false,
          activeElement: describeDomTarget(document.activeElement),
        })
      })
    }
    if (cmViewRef.current) {
      focusNow()
      return
    }
    window.requestAnimationFrame(focusNow)
  }, [activateCmEditing, boundary, editor, isOwnedBlockFoldedInPm])

  const suppressBlurForToolbar = useCallback(() => {
    boundary.suppressBlurForToolbar()
  }, [boundary])

  const triggerCopyFlash = useCallback(() => {
    setCopyFlash(true)
    window.setTimeout(() => setCopyFlash(false), 200)
  }, [])
  useCodeBlockCopyFlashRoot(wrapRef, triggerCopyFlash)

  const resolveCmOffsetFromPmSelection = useCallback((): number | null => {
    const range = resolveCodeBlockTextRange(editor.state.selection.$from)
    if (range?.blockPos !== ownedBlockPos || ownedBlockPos == null) return null
    return Math.max(0, editor.state.selection.to - range.contentFrom)
  }, [editor, ownedBlockPos])

  const applyCmSelectionOffset = useCallback((offset: number) => {
    const view = cmViewRef.current
    if (!view) {
      pendingCmSelectionRef.current = offset
      return
    }
    const pos = Math.max(0, Math.min(offset, view.state.doc.length))
    const { anchor, head } = view.state.selection.main
    if (anchor !== pos || head !== pos) {
      view.dispatch({ selection: { anchor: pos } })
    }
    pendingCmSelectionRef.current = null
  }, [])

  const enterEditing = useCallback(() => {
    if (!cmAvailable || isOwnedBlockFoldedInPm()) return
    const offset = resolveCmOffsetFromPmSelection() ?? blockText.length
    pendingCmSelectionRef.current = offset
    setSessionDoc(blockText)
    pendingSessionDocRef.current = null
    boundary.suppressBlurForCm()
    dispatchSession({ type: 'enter-editing' })
    applyCmSelectionOffset(offset)
    scheduleFocusCm()
  }, [
    applyCmSelectionOffset,
    blockText,
    boundary,
    cmAvailable,
    isOwnedBlockFoldedInPm,
    resolveCmOffsetFromPmSelection,
    scheduleFocusCm,
    dispatchSession,
  ])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !cmAvailable) return
    const onRequestEdit = () => {
      enterEditing()
    }
    wrap.addEventListener('luna-code-block-request-edit', onRequestEdit)
    return () => wrap.removeEventListener('luna-code-block-request-edit', onRequestEdit)
  }, [cmAvailable, enterEditing])

  useEffect(() => {
    if (!cmAvailable || folded) return

    const focusCmWhenSelectionEntered = () => {
      if (editor.view.composing) return
      const active = document.activeElement
      const activeOnToolbar =
        active instanceof HTMLElement &&
        Boolean(active.closest('.luna-code-toolbar, .luna-code-lang-palette'))
      if (
        boundary.shouldDeferSelectionAutoEdit({
          isBlockFoldedInPm: isOwnedBlockFoldedInPm,
          paletteOpen: paletteOpenRef.current,
          ownedCmFocused: isOwnedCmFocused(),
          toolbarSuppressActive:
            boundary.isBlurSuppressed() && boundary.getBlurSuppressReason() === 'toolbar',
          activeOnToolbar,
        })
      ) {
        return
      }
      if (sessionModeRef.current === 'editing' && isOwnedCmFocused()) return
      if (resolveCmOffsetFromPmSelection() == null) return
      enterEditing()
    }

    editor.on('selectionUpdate', focusCmWhenSelectionEntered)
    return () => {
      editor.off('selectionUpdate', focusCmWhenSelectionEntered)
    }
  }, [
    boundary,
    cmAvailable,
    editor,
    enterEditing,
    folded,
    isOwnedBlockFoldedInPm,
    isOwnedCmFocused,
    resolveCmOffsetFromPmSelection,
  ])

  const focusLegacyBody = useCallback(() => {
    const pos = resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
    if (pos == null) return
    const focusPos = pos + 1
    if (focusPos <= editor.state.doc.content.size) {
      void editor.chain().focus().setTextSelection(focusPos).scrollIntoView().run()
    }
  }, [editor, getPos, node])

  const activateBody = useCallback(
    (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      event.preventDefault()
      event.stopPropagation()
      if (folded) {
        chipRef.current?.focus({ preventScroll: true })
        return
      }
      if (cmEnabled) {
        enterEditing()
        return
      }
      focusLegacyBody()
    },
    [cmEnabled, enterEditing, focusLegacyBody, folded],
  )

  const onActivateBody = useCallback((event: globalThis.MouseEvent) => {
    activateBody(event)
  }, [activateBody])

  const onSurfacePointerDown = useCallback(
    (event: PointerEvent) => {
      if (!cmAvailable) return
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('.luna-code-toolbar, .luna-code-lang-palette')) return

      boundary.suppressBlurForCm(300)
      if (sessionModeRef.current !== 'editing') {
        dispatchSession({ type: 'enter-editing' })
      }

      debugCodeBlockCmFocus('controller-surface-pointerdown', {
        target: describeDomTarget(target),
        inCmDom: isCodeBlockCmDom(target),
        sessionMode: sessionModeRef.current,
      })

      if (isCodeBlockCmDom(target) || isCodeBlockCmMouseTarget(target)) return

      event.preventDefault()
      event.stopPropagation()
      scheduleFocusCm()
    },
    [boundary, cmAvailable, scheduleFocusCm],
  )

  const onSessionChange = useCallback(
    (value: string) => {
      setSessionDoc(value)
      pendingSessionDocRef.current = value
      scheduleCommit()
    },
    [scheduleCommit],
  )

  const onSessionBlur = useCallback(
    (relatedTarget: EventTarget | null = null) => {
      const snap = boundary.snapshot()
      debugCodeBlockCmFocus('controller-session-blur', {
        suppressed: boundary.isBlurSuppressed(),
        suppressReason: snap.blurSuppressReason,
        composing: cmViewRef.current?.compositionStarted ?? false,
        activeElement: describeDomTarget(document.activeElement),
        relatedTarget: describeDomTarget(relatedTarget),
      })

      const blurDecision = boundary.evaluateCmBlur(
        {
          relatedTarget,
          composing: cmViewRef.current?.compositionStarted ?? false,
          cmHasFocus: isCodeBlockCmFocused(),
          focusCmAfterRender: boundary.peekFocusCmAfterRender(),
          paletteOpen: paletteOpenRef.current,
          activeInWrap: false,
        },
        isOwnedBlockFoldedInPm,
      )

      if (blurDecision === 'ignore') {
        if (boundary.isFoldTransitionActive() || isOwnedBlockFoldedInPm()) {
          debugCodeBlockCmFocus('controller-session-blur-skipped', {
            traceId: snap.foldTraceId ?? undefined,
            foldOperation: snap.foldTransitionActive,
            foldedInPm: isOwnedBlockFoldedInPm(),
          })
        }
        return
      }

      if (blurDecision === 'suppress-refocus') {
        if (isCodeBlockCmFocused()) return
        const now = Date.now()
        if (now - cmRefocusGuardRef.current < 80) return
        cmRefocusGuardRef.current = now
        scheduleFocusCm()
        return
      }

      flushSessionToPm()
      boundary.unlockPmIfLocked()
      boundary.scheduleBlurExit(
        () => {
          if (boundary.isFoldTransitionActive() || isOwnedBlockFoldedInPm()) return false
          if (paletteOpenRef.current) return false
          if (boundary.peekFocusCmAfterRender()) return false
          if (cmViewRef.current?.compositionStarted) return false
          if (isCodeBlockCmFocused()) return false
          const active = document.activeElement
          if (active instanceof HTMLElement) {
            if (wrapRef.current?.contains(active)) return false
            if (active.closest('.luna-code-lang-palette')) return false
            if (active.closest('.luna-code-toolbar')) return false
            if (active.closest('.pm-code-block-cm')) return false
          }
          return true
        },
        () => {
          if (sessionModeRef.current === 'editing') {
            dispatchSession({ type: 'exit-editing' })
          }
        },
      )
    },
    [boundary, flushSessionToPm, isOwnedBlockFoldedInPm, scheduleFocusCm],
  )

  const focusLangChipFromCm = useCallback(() => {
    const pos = resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
    if (pos == null) return false
    boundary.clearBlurExitTimer()
    boundary.suppressBlurForToolbar(400)
    cmViewRef.current?.dom.blur()
    flushSessionToPm()
    dispatchSession({ type: 'exit-editing' })
    boundary.releasePmForToolbar()
    return focusCodeBlockLangInput(editor.view, pos)
  }, [boundary, dispatchSession, editor, flushSessionToPm, getPos, node])

  const onSessionBoundaryUp = useCallback(() => focusLangChipFromCm(), [focusLangChipFromCm])

  const onSessionBoundaryDown = useCallback(() => focusLangChipFromCm(), [focusLangChipFromCm])

  const onDeleteEmptyBlock = useCallback(() => {
    const pos = resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
    if (pos == null) return false
    boundary.clearAllTimers()
    dispatchSession({ type: 'exit-editing' })
    boundary.unlockPmIfLocked()
    return deleteEmptyCodeBlock(editor, pos)
  }, [boundary, editor, getPos, node])

  const onUndo = useCallback(() => {
    const docId = getVmTiptapRecorderDocId()
    if (!docId) return false
    flushVmTiptapRecorderBatch(docId)
    return undoLastTransaction(docId)
  }, [])
  const onRedo = useCallback(() => {
    const docId = getVmTiptapRecorderDocId()
    if (!docId) return false
    flushVmTiptapRecorderBatch(docId)
    return redoLastTransaction(docId)
  }, [])

  const commitLanguage = useCallback(
    (id: string) => {
      const canonical = normalizeLanguageForLowlight(id)
      const pos = resolveOwnedCodeBlockPos(editor, getPos?.(), node)
      const mermaidType = editor.schema.nodes.mermaidBlock
      if (canonical === 'mermaid' && mermaidType && pos != null) {
        const block = codeBlockNodeAt(editor, pos)
        if (!block) return
        const text = isEditing ? sessionDoc : block.textContent
        const ok = editor
          .chain()
          .focus()
          .command(({ tr }) => {
            const mermaid = mermaidType.create({ source: text, blockId: newMermaidBlockId() })
            tr.replaceWith(pos, pos + block.nodeSize, mermaid)
            return true
          })
          .scrollIntoView()
          .run()
        dispatchSession({ type: 'close-palette' })
        if (ok) return
      }
      updateAttributes({ language: canonical.length ? canonical : null })
      dispatchSession({ type: 'close-palette' })
      if (isEditing) {
        scheduleFocusCm()
        return
      }
      if (!cmEnabled && pos != null && pos + 1 <= editor.state.doc.content.size) {
        void editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run()
      }
    },
    [cmEnabled, editor, getPos, isEditing, node, scheduleFocusCm, sessionDoc, updateAttributes],
  )

  const copyAllCode = useCallback(async () => {
    const pos = resolveOwnedCodeBlockPos(editor, getPos?.(), node)
    const block = pos != null ? codeBlockNodeAt(editor, pos) : null
    const text = isEditing ? sessionDoc : (block?.textContent ?? blockText)
    let ok: boolean
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch {
        ok = false
      }
    }
    if (!ok) {
      setCopyFailed(true)
      window.setTimeout(() => setCopyFailed(false), 2200)
      return
    }
    setCopyFailed(false)
    setCopyFlash(true)
    window.setTimeout(() => setCopyFlash(false), 220)
    setCopySuccess(true)
    window.setTimeout(() => setCopySuccess(false), 900)
  }, [blockText, editor, getPos, isEditing, node, sessionDoc])

  const onCopyClick = useCallback((event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    void copyAllCode()
  }, [copyAllCode])

  useEffect(() => {
    if (!contextMenu) return
    const saved = contextMenuSelectionRef.current
    const view = cmViewRef.current
    if (!saved || !view) return
    const frame = requestAnimationFrame(() => {
      codeBlockCmRestoreSelection(view, saved.from, saved.to)
    })
    return () => cancelAnimationFrame(frame)
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const onDocMouseDown = (event: globalThis.MouseEvent) => {
      if (event.button === 2) return
      const target = event.target
      if (target instanceof Node && contextMenuRef.current?.contains(target)) return
      if (target instanceof HTMLElement && isCodeBlockContextMenuDom(target)) return
      contextMenuSelectionRef.current = null
      setContextMenu(null)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        contextMenuSelectionRef.current = null
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [contextMenu])

  const ensureCmReadyForContextAction = useCallback((): CmEditorView | null => {
    if (!cmAvailable) return null
    boundary.suppressBlurForCm(400)
    const existing = cmViewRef.current
    if (existing && sessionModeRef.current === 'editing') {
      activateCmEditing()
      acquireCodeBlockCmFocus(existing, { pmDom: editor.view.dom, wrap: wrapRef.current })
      return existing
    }
    enterEditing()
    activateCmEditing()
    const view = cmViewRef.current
    if (view) {
      acquireCodeBlockCmFocus(view, { pmDom: editor.view.dom, wrap: wrapRef.current })
      return view
    }
    scheduleFocusCm()
    return cmViewRef.current
  }, [activateCmEditing, boundary, cmAvailable, editor, enterEditing, scheduleFocusCm])

  const runContextActionWithCm = useCallback(
    (fn: (view: CmEditorView) => void | Promise<unknown>) => {
      const attempt = (tryCount = 0) => {
        const view = ensureCmReadyForContextAction()
        if (view) {
          void fn(view)
          return
        }
        if (tryCount < 16) requestAnimationFrame(() => attempt(tryCount + 1))
      }
      attempt()
    },
    [ensureCmReadyForContextAction],
  )

  const onContextMenu = useCallback((event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest('.luna-code-lang-palette')) return
    event.preventDefault()
    event.stopPropagation()
    boundary.suppressBlurForCm(800)
    const view = cmViewRef.current
    const main = view?.state.selection.main
    if (!contextMenuSelectionRef.current && main && main.from !== main.to) {
      contextMenuSelectionRef.current = { from: main.from, to: main.to }
    }
    const saved = contextMenuSelectionRef.current
    if (saved && view) {
      codeBlockCmRestoreSelection(view, saved.from, saved.to)
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      hasSelection: Boolean(saved),
    })
  }, [boundary])

  const applyFoldToggle = useCallback(() => {
    const traceId = boundary.beginFoldTransition()
    const next = !folded
    const pendingSessionDocLen = pendingSessionDocRef.current?.length ?? null
    logFoldStep('fold-apply-start', { nextFolded: next, via: 'applyFoldToggle' })
    logFoldStep('fold-step-after-release', { nextFolded: next })

    if (next) {
      const hadCmView = !!cmViewRef.current
      cmViewRef.current?.dom.blur()
      cmViewRef.current = null
      pendingCmSelectionRef.current = null
      pendingSessionDocRef.current = null
      boundary.prepareCmUnmountForFold()
      dispatchSession({ type: 'force-display' })
      logFoldStep('fold-step-after-cm-cleanup', { nextFolded: next, hadCmView })
    } else {
      pendingCmSelectionRef.current = 0
      pendingSessionDocRef.current = null
      setSessionDoc(blockText)
      boundary.requestFocusCmAfterRender()
      dispatchSession({ type: 'enter-editing' })
      logFoldStep('fold-step-unfold-prepare', { nextFolded: next, cmOffset: 0 })
    }

    logFoldStep('fold-step-before-flush', {
      nextFolded: next,
      pendingSessionDocLen,
    })
    flushSessionToPm()
    logFoldStep('fold-step-after-flush', { nextFolded: next })

    logFoldStep('fold-step-before-attr', { nextFolded: next })
    updateAttributes({ folded: next })
    logFoldStep('fold-step-after-attr', { nextFolded: next })

    scheduleFoldWatchdog(traceId, next)

    requestAnimationFrame(() => {
      const pos =
        stableOwnedBlockPosRef.current ??
        resolveOwnedCodeBlockPos(editor, getPos?.() ?? null, node)
      const focusOk = boundary.restoreEditorFocusAfterFold(pos, next)
      logFoldStep('fold-step-raf-focus', { nextFolded: next, focusOk })
      boundary.endFoldTransitionSoon(() => {
        logFoldStep('fold-step-operation-clear', { nextFolded: next })
        if (!next) {
          requestAnimationFrame(() => {
            applyCmSelectionOffset(0)
            scheduleFocusCm()
            logFoldStep('fold-step-unfold-focus', { nextFolded: next })
          })
        }
      })
    })
  }, [
    applyCmSelectionOffset,
    blockText,
    boundary,
    editor,
    flushSessionToPm,
    folded,
    getPos,
    logFoldStep,
    node,
    scheduleFoldWatchdog,
    scheduleFocusCm,
    updateAttributes,
  ])

  const onToggleFoldedPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      boundary.markFoldToggleHandledOnPointer()
      debugCodeBlockCmFocus('fold-pointerdown', {
        target: describeDomTarget(event.target),
        currentFolded: folded,
        defaultPrevented: event.defaultPrevented,
        activeElement: describeDomTarget(document.activeElement),
        pmLock: describePmLockState(editor),
      })
      applyFoldToggle()
    },
    [applyFoldToggle, boundary, editor, folded],
  )

  const onToggleFolded = useCallback(() => {
    if (boundary.consumeFoldToggleHandledOnPointer()) {
      debugCodeBlockCmFocus('fold-click-skipped', { reason: 'handled-on-pointerdown' })
      return
    }
    debugCodeBlockCmFocus('fold-click-fallback', { currentFolded: folded })
    applyFoldToggle()
  }, [applyFoldToggle, boundary, folded])

  const onContextMenuPick = useCallback(
    (action: CodeBlockContextMenuPick) => {
      boundary.suppressBlurForCm(400)
      const savedSelection = contextMenuSelectionRef.current
      contextMenuSelectionRef.current = null
      setContextMenu(null)
      const restoreSelection = (view: CmEditorView) => {
        if (savedSelection) codeBlockCmRestoreSelection(view, savedSelection.from, savedSelection.to)
      }
      switch (action) {
        case 'cut':
          runContextActionWithCm(async (view) => {
            restoreSelection(view)
            await codeBlockCmCutSelection(view)
          })
          return
        case 'copy':
          runContextActionWithCm(async (view) => {
            restoreSelection(view)
            await codeBlockCmCopySelection(view)
          })
          return
        case 'paste':
          runContextActionWithCm((view) => codeBlockCmPaste(view))
          return
        case 'selectAll':
          runContextActionWithCm((view) => {
            codeBlockCmSelectAll(view)
          })
          return
        case 'copyAll':
          void copyAllCode()
          return
        case 'toggleFold':
          applyFoldToggle()
          return
      }
    },
    [applyFoldToggle, boundary, copyAllCode, runContextActionWithCm],
  )

  const onContextMenuLanguagePick = useCallback(
    (id: string) => {
      boundary.suppressBlurForCm(400)
      contextMenuSelectionRef.current = null
      setContextMenu(null)
      commitLanguage(id)
    },
    [boundary, commitLanguage],
  )

  const onChipKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return
      const pos = resolveOwnedCodeBlockPos(editor, getPos?.(), node)
      if (pos == null) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        suppressBlurForToolbar()
        boundary.releasePmForToolbar()
        dispatchSession({ type: 'open-palette' })
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (sessionState.paletteOpen) {
          dispatchSession({ type: 'close-palette' })
          return
        }
        boundary.clearBlurExitTimer()
        boundary.releasePmForToolbar()
        dispatchSession({ type: 'exit-editing' })
        exitCodeBlockForward(editor, pos)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (sessionState.paletteOpen) {
          dispatchSession({ type: 'close-palette' })
          return
        }
        boundary.clearBlurExitTimer()
        boundary.releasePmForToolbar()
        dispatchSession({ type: 'exit-editing' })
        exitCodeBlockBackward(editor, pos)
        return
      }
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault()
        if (folded) return
        if (cmEnabled) {
          enterEditing()
          return
        }
        focusLegacyBody()
        return
      }
      if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault()
        exitCodeBlockBackward(editor, pos)
      }
    },
    [boundary, cmEnabled, dispatchSession, editor, enterEditing, focusLegacyBody, folded, getPos, node, sessionState.paletteOpen, suppressBlurForToolbar],
  )

  const languageClassName = useMemo(() => {
    const canonical = resolveCanonicalLanguageId(attrLang) ?? attrLang
    return canonical ? `language-${canonical}` : undefined
  }, [attrLang])

  const copyLabel = copyFailed ? t('editor.codeBlock.copyFailed') : t('editor.codeBlock.copy')
  const cmMountKey = `${ownedBlockPos ?? blockDocPos ?? 'code'}:${folded ? '1' : '0'}`

  return (
    <NodeViewWrapper
      as="div"
      ref={wrapRef}
      className={`pm-code-block-wrap${showCmEditor ? ' pm-code-block-wrap--cm' : ''}${folded ? ' pm-code-block-wrap--folded' : ''}${ENABLE_EXPERIMENTAL_DIFF && diffMode ? ' pm-code-block-wrap--diff' : ''}${copyFlash ? ' pm-code-block-wrap--copied' : ''}${sessionState.paletteOpen ? ' pm-code-block-wrap--palette-open' : ''}${copyFailed ? ' pm-code-block-wrap--copy-failed' : ''}${contextMenu ? ' pm-code-block-wrap--ctx-menu-open' : ''}`}
      aria-describedby={toolbarHintId}
      data-luna-code-block-wrap
      data-language={attrLang}
      data-folded={folded ? 'true' : undefined}
      data-diff={ENABLE_EXPERIMENTAL_DIFF && diffMode ? 'true' : undefined}
      data-session-mode={isEditing ? 'editing' : sessionState.mode}
      data-session-palette-open={sessionState.paletteOpen ? 'true' : undefined}
      data-luna-code-block-from={blockDocPos != null ? String(blockDocPos) : undefined}
      spellCheck={false}
      onContextMenu={onContextMenu}
    >
      <span id={toolbarHintId} className="sr-only">
        {t('editor.codeBlock.toolbarHint')}
      </span>
      <LunaCodeLanguagePalette
        open={sessionState.paletteOpen}
        anchorEl={chipRef.current}
        languages={langs}
        currentLanguageId={(resolveCanonicalLanguageId(attrLang) ?? attrLang) || null}
        onPick={commitLanguage}
        onClose={() => {
          boundary.clearBlurExitTimer()
          boundary.releasePmForToolbar()
          dispatchSession({ type: 'close-palette' })
          requestAnimationFrame(() => chipRef.current?.focus({ preventScroll: true }))
        }}
      />
      <div className="pm-code-block-surface" onPointerDown={onSurfacePointerDown}>
        <CodeBlockToolbar
          chipRef={chipRef}
          displayLang={displayLang}
          folded={folded}
          paletteOpen={sessionState.paletteOpen}
          copySuccess={copySuccess}
          toolbarAria={t('editor.codeBlock.toolbarAria')}
          languageAria={t('editor.codeBlock.languageAria')}
          expandLabel={t('editor.codeBlock.expand')}
          collapseLabel={t('editor.codeBlock.collapse')}
          copyLabel={copyLabel}
          onTogglePalette={() => {
            if (sessionState.paletteOpen) {
              dispatchSession({ type: 'close-palette' })
              requestAnimationFrame(() => chipRef.current?.focus({ preventScroll: true }))
              return
            }
            suppressBlurForToolbar()
            boundary.suppressBlurForToolbar(500)
            dispatchSession({ type: 'open-palette' })
          }}
          onChipKeyDown={onChipKeyDown}
          onToggleFolded={onToggleFolded}
          onToggleFoldedPointerDown={onToggleFoldedPointerDown}
          onCopyClick={onCopyClick}
        />
        <pre className={`pm-code-block-pre${showCmEditor ? ' pm-code-block-pre--cm' : ''}`}>
          {cmEnabled ? (
            showCmEditor ? (
              <CodeBlockEditorSurface
                mountKey={cmMountKey}
                blockId={
                  ownedBlockPos != null
                    ? String(ownedBlockPos)
                    : blockDocPos != null
                      ? String(blockDocPos)
                      : null
                }
                doc={sessionDoc}
                languageId={attrLang}
                onChange={onSessionChange}
                onBlur={onSessionBlur}
                onBoundaryUp={onSessionBoundaryUp}
                onBoundaryDown={onSessionBoundaryDown}
                onDeleteEmptyBlock={onDeleteEmptyBlock}
                onUndo={onUndo}
                onRedo={onRedo}
                onViewReady={(view) => {
                  cmViewRef.current = view
                  const pending = pendingCmSelectionRef.current
                  if (pending != null) applyCmSelectionOffset(pending)
                  if (boundary.peekFocusCmAfterRender() || sessionModeRef.current === 'editing') {
                    scheduleFocusCm()
                  }
                }}
              />
            ) : (
              <CodeBlockStaticSurface
                text={sessionDoc}
                displayLineCount={foldedLineCount}
                languageClassName={languageClassName}
                foldedPreview={folded}
                onActivate={onActivateBody}
              />
            )
          ) : !folded ? (
            <div className="pm-code-block-content-scroll">
              <div className="pm-code-body-col">
                <NodeViewContent<'div'> as="div" className="pm-code-block-content hljs" />
              </div>
            </div>
          ) : (
            <CodeBlockStaticSurface
              text={blockText}
              displayLineCount={foldedLineCount}
              languageClassName={languageClassName}
              foldedPreview={folded}
              onActivate={onActivateBody}
            />
          )}
        </pre>
        {folded && foldedLineCount > 1 ? (
          <div className="pm-code-block-folded-hint" role="status" aria-live="polite">
            <span className="pm-code-block-folded-hint__badge" aria-hidden>
              +{foldedLineCount - 1}
            </span>
            <span className="pm-code-block-folded-hint__text">
              {t('editor.codeBlock.foldedHint', { count: foldedLineCount })}
            </span>
          </div>
        ) : null}
        {cmEnabled ? (
          <NodeViewContent<'div'>
            as="div"
            className="pm-code-block-pm-mirror pm-code-block-content hljs"
            aria-hidden
            tabIndex={-1}
            data-pm-readonly="true"
          />
        ) : null}
      </div>
      {contextMenu
        ? createPortal(
            <CodeBlockContextMenu
              state={contextMenu}
              menuRef={contextMenuRef}
              folded={folded}
              canEdit={cmAvailable}
              languages={langs}
              currentLanguageId={(resolveCanonicalLanguageId(attrLang) ?? attrLang) || null}
              onPick={onContextMenuPick}
              onLanguagePick={onContextMenuLanguagePick}
            />,
            document.body,
          )
        : null}
    </NodeViewWrapper>
  )
}
