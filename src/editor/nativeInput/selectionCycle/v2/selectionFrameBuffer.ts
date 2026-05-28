import type { SelectionSnapshot } from '../selectionSnapshot'

export type FramePhase = 'capture' | 'mutate' | 'commit' | 'restore' | 'idle'

export type FrameBufferEntry = {
  phase: FramePhase
  frameIndex: number
  capture?: SelectionSnapshot
  restoreTarget?: SelectionSnapshot
  value?: string
}

const buffers = new WeakMap<HTMLTextAreaElement, FrameBufferEntry[]>()

export function pushFrameBuffer(el: HTMLTextAreaElement, entry: FrameBufferEntry): void {
  const list = buffers.get(el) ?? []
  list.push(entry)
  if (list.length > 32) list.shift()
  buffers.set(el, list)
}

export function peekLatestBuffer(el: HTMLTextAreaElement): FrameBufferEntry | undefined {
  const list = buffers.get(el)
  return list?.[list.length - 1]
}

export function clearFrameBuffer(el: HTMLTextAreaElement): void {
  buffers.delete(el)
}

export function getFrameBuffer(el: HTMLTextAreaElement): readonly FrameBufferEntry[] {
  return buffers.get(el) ?? []
}
