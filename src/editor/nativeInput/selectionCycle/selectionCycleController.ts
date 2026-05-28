import { clearTextareaComposition } from './selectionComposition'
import { isSelectionLocked, lockSelection, unlockSelection } from './selectionLock'
import { scheduleValueMutation } from './v2/selectionFrameSync'
import { cancelScheduledRestore } from './selectionRestoreQueue'
import { detachFrameSync } from './v2/selectionFrameSync'

export function applyTextareaValueMutation(
  el: HTMLTextAreaElement,
  nextValue: string,
  selStart: number,
  selEnd: number,
  commit?: () => void,
): void {
  scheduleValueMutation(el, nextValue, selStart, selEnd, commit ? () => commit() : undefined)
}

export function runWithoutSelectionMutation<T>(el: HTMLTextAreaElement, fn: () => T): T {
  lockSelection(el)
  try {
    return fn()
  } finally {
    unlockSelection(el)
  }
}

/** @deprecated using scheduleValueMutation*/
export function runSelectionCycle(
  el: HTMLTextAreaElement,
  options: {
    mutate: () => import('./selectionSnapshot').SelectionSnapshot
    commit?: () => void
  },
): void {
  const target = options.mutate()
  scheduleValueMutation(el, el.value, target.start, target.end, () => options.commit?.())
}

export function detachSelectionCycle(el: HTMLTextAreaElement): void {
  cancelScheduledRestore(el)
  clearTextareaComposition(el)
  detachFrameSync(el)
  while (isSelectionLocked(el)) unlockSelection(el)
}
