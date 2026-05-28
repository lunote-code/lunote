import { isTextareaComposing } from '../selectionComposition'
import { isSelectionLocked, lockSelection, unlockSelection } from '../selectionLock'
import {
  captureSelection,
  createSelectionSnapshot,
  reconcileSnapshotForRestore,
  restoreSelection,
} from '../selectionSnapshot'
import { clipboardTextFromStable, ensureStableSnapshot, type StableSnapshot } from './selectionCommitBarrier'
import { clearDeterministicQueue } from './selectionDeterministicQueue'
import { clearFrameBuffer, pushFrameBuffer } from './selectionFrameBuffer'
import {
  bumpGeneration,
  cancelPendingFrames,
  flushFrameScheduler,
  getFrameIndex,
  isGenerationCurrent,
  resetFrameState,
  scheduleCommitRestorePipeline,
  scheduleRestoreFrame,
  setElementBlockId,
} from './selectionFrameScheduler'

export type ValueMutationCommit = (value: string) => void
export type PipelineCompleteHook = () => void

const onPipelineComplete = new WeakMap<HTMLTextAreaElement, PipelineCompleteHook>()

export function setPipelineCompleteHook(
  el: HTMLTextAreaElement,
  hook: PipelineCompleteHook | null,
): void {
  if (hook) onPipelineComplete.set(el, hook)
  else onPipelineComplete.delete(el)
}

function notifyPipelineComplete(el: HTMLTextAreaElement): void {
  onPipelineComplete.get(el)?.()
}

/** Frame N: capture; restore is prohibited within the same frame*/
export function runInSelectionFrame<T>(el: HTMLTextAreaElement, fn: () => T): T {
  lockSelection(el)
  try {
    const frameIndex = getFrameIndex(el)
    pushFrameBuffer(el, {
      phase: 'capture',
      frameIndex,
      capture: captureSelection(el, frameIndex),
    })
    return fn()
  } finally {
    unlockSelection(el)
  }
}

/**
 * Frame N: capture + mutate DOM value
 * Frame N+1: commit draft
 * Frame N+2: restore selection
 */
export function scheduleValueMutation(
  el: HTMLTextAreaElement,
  nextValue: string,
  selStart: number,
  selEnd: number,
  commit?: ValueMutationCommit,
  onDomAuthority?: ValueMutationCommit,
): void {
  if (isTextareaComposing(el)) return

  const generation = bumpGeneration(el)
  cancelPendingFrames(el)
  lockSelection(el)

  const frameN = getFrameIndex(el)
  const before = ensureStableSnapshot(el)
  pushFrameBuffer(el, { phase: 'capture', frameIndex: frameN, capture: before })

  el.value = nextValue
  onDomAuthority?.(nextValue)
  const restoreTarget = createSelectionSnapshot(nextValue, selStart, selEnd, {
    frameIndex: frameN,
    valueAtCapture: nextValue,
  })
  pushFrameBuffer(el, { phase: 'mutate', frameIndex: frameN, value: nextValue, restoreTarget })

  scheduleCommitRestorePipeline(
    el,
    generation,
    () => {
      if (!isGenerationCurrent(el, generation)) return
      pushFrameBuffer(el, { phase: 'commit', frameIndex: getFrameIndex(el) })
      commit?.(nextValue)
    },
    () => {
      if (!isGenerationCurrent(el, generation)) return
      if (isTextareaComposing(el)) {
        unlockSelection(el)
        notifyPipelineComplete(el)
        return
      }
      pushFrameBuffer(el, {
        phase: 'restore',
        frameIndex: getFrameIndex(el),
        restoreTarget,
      })
      restoreSelection(el, reconcileSnapshotForRestore(el, restoreTarget))
      pushFrameBuffer(el, { phase: 'idle', frameIndex: getFrameIndex(el) })
      unlockSelection(el)
      notifyPipelineComplete(el)
    },
  )
}

/** Copy: Freeze the snapshot and write to the clipboard synchronously*/
export function runClipboardCopy(el: HTMLTextAreaElement, event: ClipboardEvent): void {
  if (isTextareaComposing(el)) return

  lockSelection(el)
  try {
    const snapshot = ensureStableSnapshot(el)
    pushFrameBuffer(el, {
      phase: 'capture',
      frameIndex: getFrameIndex(el),
      capture: snapshot,
    })
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    event.clipboardData?.setData('text/plain', clipboardTextFromStable(snapshot))
  } finally {
    unlockSelection(el)
  }
}

/** Cut：capture → clipboard → value mutation pipeline */
export function runClipboardCut(
  el: HTMLTextAreaElement,
  event: ClipboardEvent,
  commit?: ValueMutationCommit,
): StableSnapshot {
  const snapshot = ensureStableSnapshot(el)
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  event.clipboardData?.setData('text/plain', clipboardTextFromStable(snapshot))

  const next =
    snapshot.valueAtCapture.slice(0, snapshot.start) +
    snapshot.valueAtCapture.slice(snapshot.end)
  scheduleValueMutation(el, next, snapshot.start, snapshot.start, commit)
  return snapshot
}

export function runSelectAll(el: HTMLTextAreaElement): void {
  lockSelection(el)
  try {
    el.focus()
    el.select()
  } finally {
    unlockSelection(el)
  }
}

/** compositionend: Delay 2 frames to synchronize the current DOM selection*/
export function scheduleFrameSyncFlush(el: HTMLTextAreaElement): void {
  if (isTextareaComposing(el)) return
  const generation = bumpGeneration(el)
  scheduleRestoreFrame(el, generation, () => {
    if (!isGenerationCurrent(el, generation)) return
    restoreSelection(el, ensureStableSnapshot(el))
    notifyPipelineComplete(el)
  })
}

export function resetSelectionFrameForBlock(el: HTMLTextAreaElement, blockId: string): void {
  const prev = setElementBlockId(el, blockId)
  if (prev !== blockId) {
    flushFrameScheduler(el)
    clearDeterministicQueue(el)
    clearFrameBuffer(el)
    while (isSelectionLocked(el)) unlockSelection(el)
  }
  resetFrameState(el, blockId)
}

export function detachFrameSync(el: HTMLTextAreaElement): void {
  flushFrameScheduler(el)
  clearDeterministicQueue(el)
  clearFrameBuffer(el)
  onPipelineComplete.delete(el)
  let guard = 0
  while (isSelectionLocked(el) && guard++ < 16) unlockSelection(el)
}
