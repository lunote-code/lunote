import type { Editor } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'

import { codeBlockNodeAt } from '../behavior/selection'
import {
  isPmLockedForCodeBlockCm,
  lockPmForCodeBlockCm,
  releasePmAfterCodeBlockCmToolbar,
  unlockPmForCodeBlockCm,
} from '../cm/codeBlockCmPmFocusLock'
import { nextFoldTraceId } from '../cm/codeBlockCmFocusDebug'

import { isCodeBlockCmDom, isCodeBlockContextMenuDom } from '../cm/codeBlockCmDom'

import type {
  CodeBlockBlurSuppressReason,
  CodeBlockBoundarySnapshot,
  CodeBlockCmBlurContext,
} from './codeBlockBoundaryTypes'

const FOLD_TRANSITION_CLEAR_MS = 120
const BLUR_EXIT_DELAY_MS = 50

function isToolbarDom(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('.luna-code-toolbar, .luna-code-lang-palette'))
}

function isContextMenuDom(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && isCodeBlockContextMenuDom(target)
}

export type CodeBlockBoundarySession = ReturnType<typeof createCodeBlockBoundarySession>

/**
 * Per code-block boundary orchestrator: fold transitions, blur suppression,
 * PM lock/unlock, and cancellable blur-exit timers.
 */
export function createCodeBlockBoundarySession(editor: Editor) {
  let foldTransitionActive = false
  let foldTraceId: string | null = null
  let foldClearTimer: ReturnType<typeof setTimeout> | null = null
  let blurSuppressUntil = 0
  let blurSuppressReason: CodeBlockBlurSuppressReason | null = null
  let focusCmAfterRender = false
  let selectionEnteredFoldedBlock = false
  let foldToggleHandledOnPointer = false
  let blurExitTimer: ReturnType<typeof setTimeout> | null = null
  let commitTimer: ReturnType<typeof setTimeout> | null = null

  const clearFoldClearTimer = () => {
    if (foldClearTimer != null) {
      clearTimeout(foldClearTimer)
      foldClearTimer = null
    }
  }

  const clearBlurExitTimer = () => {
    if (blurExitTimer != null) {
      clearTimeout(blurExitTimer)
      blurExitTimer = null
    }
  }

  const clearBlurSuppress = () => {
    blurSuppressUntil = 0
    blurSuppressReason = null
  }

  const clearCommitTimer = () => {
    if (commitTimer != null) {
      clearTimeout(commitTimer)
      commitTimer = null
    }
  }

  const clearAllTimers = () => {
    clearFoldClearTimer()
    clearBlurExitTimer()
    clearCommitTimer()
  }

  const suppressBlur = (reason: CodeBlockBlurSuppressReason, ms: number) => {
    blurSuppressUntil = Date.now() + ms
    blurSuppressReason = reason
  }

  const snapshot = (): CodeBlockBoundarySnapshot => ({
    foldTransitionActive,
    foldTraceId,
    blurSuppressUntil,
    blurSuppressReason,
    focusCmAfterRender,
    selectionEnteredFoldedBlock,
    foldToggleHandledOnPointer,
  })

  const canAcquireCmEditing = (isBlockFoldedInPm: () => boolean): boolean => {
    return !foldTransitionActive && !isBlockFoldedInPm()
  }

  const shouldDeferSelectionAutoEdit = (opts: {
    isBlockFoldedInPm: () => boolean
    paletteOpen: boolean
    ownedCmFocused: boolean
    toolbarSuppressActive: boolean
    activeOnToolbar: boolean
  }): boolean => {
    if (foldTransitionActive) return true
    if (opts.isBlockFoldedInPm()) return true
    if (opts.paletteOpen) return true
    if (opts.ownedCmFocused) return true
    if (opts.toolbarSuppressActive) return true
    if (opts.activeOnToolbar) return true
    return false
  }

  const beginFoldTransition = (): string => {
    clearAllTimers()
    const traceId = nextFoldTraceId()
    foldTraceId = traceId
    foldTransitionActive = true
    suppressBlur('toolbar', 800)
    releasePmAfterCodeBlockCmToolbar(editor)
    return traceId
  }

  const endFoldTransitionSoon = (onClear?: () => void) => {
    clearFoldClearTimer()
    foldClearTimer = setTimeout(() => {
      foldClearTimer = null
      foldTransitionActive = false
      foldTraceId = null
      onClear?.()
    }, FOLD_TRANSITION_CLEAR_MS)
  }

  const prepareCmUnmountForFold = () => {
    focusCmAfterRender = false
  }

  const lockPmForCm = (wrap: HTMLElement | null) => {
    if (foldTransitionActive) return false
    lockPmForCodeBlockCm(editor, wrap)
    suppressBlur('cm', 300)
    return true
  }

  const unlockPmIfLocked = () => {
    if (!isPmLockedForCodeBlockCm(editor)) return false
    unlockPmForCodeBlockCm(editor)
    return true
  }

  const releasePmForToolbar = () => {
    releasePmAfterCodeBlockCmToolbar(editor)
  }

  const requestFocusCmAfterRender = () => {
    focusCmAfterRender = true
  }

  const consumeFocusCmAfterRender = (): boolean => {
    const pending = focusCmAfterRender
    focusCmAfterRender = false
    return pending
  }

  const peekFocusCmAfterRender = (): boolean => focusCmAfterRender

  const markFoldToggleHandledOnPointer = () => {
    foldToggleHandledOnPointer = true
  }

  const consumeFoldToggleHandledOnPointer = (): boolean => {
    if (!foldToggleHandledOnPointer) return false
    foldToggleHandledOnPointer = false
    return true
  }

  const resetFoldedSelectionChipState = () => {
    selectionEnteredFoldedBlock = false
  }

  const tryFocusChipOnFoldedSelectionEnter = (opts: {
    isBlockFoldedInPm: () => boolean
    inOwnedBlock: boolean
    chip: HTMLButtonElement | null
  }): boolean => {
    if (!opts.isBlockFoldedInPm()) return false
    if (!opts.inOwnedBlock) {
      selectionEnteredFoldedBlock = false
      return false
    }
    if (selectionEnteredFoldedBlock) return false
    selectionEnteredFoldedBlock = true
    const chip = opts.chip
    if (!chip || document.activeElement === chip) return false
    chip.focus({ preventScroll: true })
    return true
  }

  const evaluateCmBlur = (
    ctx: CodeBlockCmBlurContext,
    isBlockFoldedInPm: () => boolean,
  ): 'ignore' | 'suppress-refocus' | 'flush-and-exit' => {
    if (foldTransitionActive || isBlockFoldedInPm()) return 'ignore'
    if (isToolbarDom(ctx.relatedTarget)) {
      suppressBlur('toolbar', 800)
      return 'ignore'
    }
    if (isContextMenuDom(ctx.relatedTarget)) {
      suppressBlur('cm', 800)
      return 'ignore'
    }
    if (isToolbarDom(document.activeElement)) {
      suppressBlur('toolbar', 800)
      return 'ignore'
    }
    if (isContextMenuDom(document.activeElement)) {
      suppressBlur('cm', 800)
      return 'ignore'
    }
    if (ctx.composing) {
      suppressBlur('cm', 600)
      return 'ignore'
    }
    if (Date.now() < blurSuppressUntil) {
      if (blurSuppressReason === 'cm') {
        const related = ctx.relatedTarget instanceof HTMLElement ? ctx.relatedTarget : null
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
        if ((related && !isCodeBlockCmDom(related)) || (active && !isCodeBlockCmDom(active))) {
          return 'flush-and-exit'
        }
        return 'suppress-refocus'
      }
      return 'ignore'
    }
    return 'flush-and-exit'
  }

  const scheduleBlurExit = (shouldExit: () => boolean, onExit: () => void) => {
    clearBlurExitTimer()
    blurExitTimer = setTimeout(() => {
      blurExitTimer = null
      if (foldTransitionActive) return
      if (!shouldExit()) return
      onExit()
    }, BLUR_EXIT_DELAY_MS)
  }

  const scheduleCommit = (commit: () => void, delayMs = 60) => {
    clearCommitTimer()
    commitTimer = setTimeout(() => {
      commitTimer = null
      commit()
    }, delayMs)
  }

  const flushCommit = (commit: () => void) => {
    clearCommitTimer()
    commit()
  }

  const restoreEditorFocusAfterFold = (
    blockPos: number | null,
    nextFolded: boolean,
  ): boolean => {
    if (blockPos == null) return editor.chain().focus().run()
    const block = codeBlockNodeAt(editor, blockPos)
    if (!block) return editor.chain().focus().run()
    const doc = editor.state.doc
    const { state, view } = editor
    if (nextFolded) {
      const after = Math.min(blockPos + block.nodeSize, doc.content.size)
      const $pos = doc.resolve(after)
      const selection = Selection.near($pos, 1)
      view.dispatch(state.tr.setSelection(selection).scrollIntoView())
      view.focus()
      return true
    }
    const contentFrom = Math.min(blockPos + 1, doc.content.size)
    const $pos = doc.resolve(contentFrom)
    const selection = Selection.near($pos, 1)
    // Sync PM selection only; CM takes focus after mount (avoid caret above gutter).
    view.dispatch(state.tr.setSelection(selection))
    return true
  }

  const dispose = () => {
    clearAllTimers()
    if (!editor.isDestroyed) {
      unlockPmIfLocked()
    }
  }

  return {
    snapshot,
    canAcquireCmEditing,
    shouldDeferSelectionAutoEdit,
    beginFoldTransition,
    endFoldTransitionSoon,
    prepareCmUnmountForFold,
    getFoldTraceId: () => foldTraceId,
    isFoldTransitionActive: () => foldTransitionActive,
    suppressBlurForToolbar: (ms = 250) => suppressBlur('toolbar', ms),
    suppressBlurForCm: (ms = 250) => suppressBlur('cm', ms),
    isBlurSuppressed: () => Date.now() < blurSuppressUntil,
    getBlurSuppressReason: () => blurSuppressReason,
    lockPmForCm,
    unlockPmIfLocked,
    releasePmForToolbar,
    requestFocusCmAfterRender,
    consumeFocusCmAfterRender,
    peekFocusCmAfterRender,
    markFoldToggleHandledOnPointer,
    consumeFoldToggleHandledOnPointer,
    resetFoldedSelectionChipState,
    tryFocusChipOnFoldedSelectionEnter,
    evaluateCmBlur,
    scheduleBlurExit,
    scheduleCommit,
    flushCommit,
    clearAllTimers,
    clearBlurExitTimer,
    clearBlurSuppress,
    restoreEditorFocusAfterFold,
    dispose,
  }
}
