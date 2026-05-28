/** General editing path: After dispatching the selection, wait for some paint before measuring the geometry, otherwise coordsAtPos may fall on a tree that has not been reflowed.*/
export const LAYOUT_STABILIZATION_FRAME_COUNT = 3

/**
 * What you see is what you get ↔ Source code mode switching: wait a few more frames before writing to the CodeMirror selection,
 * Let React submit props + CM when the first frame document measurement is completed to avoid dispatching on unstable scrollDOM.
 */
/** After the CM is mounted by React, the line box measurement of the first frame is occasionally late, leaving 1 more frame before writing the selection / coordsAtPos*/
export const MODE_SWITCH_PRE_SELECTION_STABLE_FRAMES = 3

/**
 * On the mode switching path, from the selection area dispatch to the barrier before coordsAtPos/scroll,
 * Longer than `LAYOUT_STABILIZATION_FRAME_COUNT`, covering CM6/PM different reflow cadences.
 */
export const MODE_SWITCH_POST_SELECTION_STABLE_FRAMES = 5

/** After caret anchors the scroll, wait for 1 frame to retest the geometry and absorb the residual layout triggered by scroll.*/
export const POST_SCROLL_CARET_REFINE_FRAMES = 1

/** A short barrier before focus reduces the coordinate drift caused by the same transient competition between scroll and focus.*/
export const PRE_FOCUS_STABLE_FRAMES = 2

export async function waitAnimationFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
}

/** Check `cancelled` before each frame, and return `false` if it has been canceled (it will also stop if the `count` is not reached).*/
export async function waitLayoutStabilizationBarrier(
  count: number,
  cancelled: () => boolean,
): Promise<boolean> {
  for (let i = 0; i < count; i++) {
    if (cancelled()) return false
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  return !cancelled()
}
