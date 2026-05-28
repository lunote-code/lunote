import type { SelectionSnapshot } from './selectionSnapshot'
import { cancelPendingFrames } from './v2/selectionFrameScheduler'
import { scheduleValueMutation } from './v2/selectionFrameSync'

/** v2: restore binding Frame N+2 pipeline*/
export function scheduleSelectionRestore(
  el: HTMLTextAreaElement,
  snapshot: SelectionSnapshot,
  _options?: { unlock?: boolean },
): void {
  scheduleValueMutation(el, el.value, snapshot.start, snapshot.end)
}

export function cancelScheduledRestore(el: HTMLTextAreaElement): void {
  cancelPendingFrames(el)
}
