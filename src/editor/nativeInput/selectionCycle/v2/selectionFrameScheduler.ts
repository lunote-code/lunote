export type ElementFrameState = {
  frameIndex: number
  generation: number
  blockId: string | null
  pendingRaf1: number | null
  pendingRaf2: number | null
}

const frameState = new WeakMap<HTMLTextAreaElement, ElementFrameState>()

function ensureState(el: HTMLTextAreaElement): ElementFrameState {
  let s = frameState.get(el)
  if (!s) {
    s = {
      frameIndex: 0,
      generation: 0,
      blockId: null,
      pendingRaf1: null,
      pendingRaf2: null,
    }
    frameState.set(el, s)
  }
  return s
}

export function getFrameIndex(el: HTMLTextAreaElement): number {
  return ensureState(el).frameIndex
}

export function advanceFrame(el: HTMLTextAreaElement): number {
  const s = ensureState(el)
  s.frameIndex += 1
  return s.frameIndex
}

export function bumpGeneration(el: HTMLTextAreaElement): number {
  const s = ensureState(el)
  s.generation += 1
  return s.generation
}

export function isGenerationCurrent(el: HTMLTextAreaElement, generation: number): boolean {
  return ensureState(el).generation === generation
}

export function setElementBlockId(el: HTMLTextAreaElement, blockId: string | null): string | null {
  const s = ensureState(el)
  const prev = s.blockId
  s.blockId = blockId
  return prev
}

export function cancelPendingFrames(el: HTMLTextAreaElement): void {
  const s = ensureState(el)
  if (s.pendingRaf1 != null) cancelAnimationFrame(s.pendingRaf1)
  if (s.pendingRaf2 != null) cancelAnimationFrame(s.pendingRaf2)
  s.pendingRaf1 = null
  s.pendingRaf2 = null
}

/** Frame N+1 commit → Frame N+2 restore (single pipeline, no mutual cancellation)*/
export function scheduleCommitRestorePipeline(
  el: HTMLTextAreaElement,
  generation: number,
  onCommitFrame: () => void,
  onRestoreFrame: () => void,
): void {
  const s = ensureState(el)
  cancelPendingFrames(el)

  s.pendingRaf1 = requestAnimationFrame(() => {
    s.pendingRaf1 = null
    if (!isGenerationCurrent(el, generation)) return
    advanceFrame(el)
    onCommitFrame()

    s.pendingRaf2 = requestAnimationFrame(() => {
      s.pendingRaf2 = null
      if (!isGenerationCurrent(el, generation)) return
      advanceFrame(el)
      onRestoreFrame()
    })
  })
}

export function scheduleRestoreFrame(
  el: HTMLTextAreaElement,
  generation: number,
  onRestoreFrame: () => void,
): void {
  scheduleCommitRestorePipeline(el, generation, () => {}, onRestoreFrame)
}

export function resetFrameState(el: HTMLTextAreaElement, blockId?: string | null): void {
  cancelPendingFrames(el)
  const s = ensureState(el)
  s.frameIndex = 0
  s.generation += 1
  if (blockId !== undefined) s.blockId = blockId
}

export function flushFrameScheduler(el: HTMLTextAreaElement): void {
  cancelPendingFrames(el)
  bumpGeneration(el)
}
