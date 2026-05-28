import { arbitrateAuthority } from './deterministic'
import { bumpDocumentTick } from './documentClock'
import { shouldBlockRuntimeSelectionCommit } from './nativeInput'

export type SelectionRealm = 'pm' | 'block-textarea' | 'block' | 'none'

export type AuthoritativeSelection = {
  realm: SelectionRealm
  blockId: string | null
  pmFrom: number | null
  pmTo: number | null
  textareaStart: number | null
  textareaEnd: number | null
  focusId: number | null
  revision: number
}

let selection: AuthoritativeSelection = {
  realm: 'none',
  blockId: null,
  pmFrom: null,
  pmTo: null,
  textareaStart: null,
  textareaEnd: null,
  focusId: null,
  revision: 0,
}

const listeners = new Set<() => void>()

function emit(): void {
  bumpDocumentTick('selection')
  listeners.forEach((fn) => fn())
}

export function subscribeSelectionRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthoritativeSelection(): Readonly<AuthoritativeSelection> {
  return selection
}

export function commitPmSelection(from: number, to: number): void {
  if (shouldBlockRuntimeSelectionCommit()) return
  arbitrateAuthority({ domain: 'selection', incoming: 'pm' })
  selection = {
    realm: 'pm',
    blockId: null,
    pmFrom: from,
    pmTo: to,
    textareaStart: null,
    textareaEnd: null,
    focusId: null,
    revision: selection.revision + 1,
  }
  emit()
}

export function commitBlockTextSelection(
  blockId: string,
  start: number,
  end: number,
  focusId?: number,
): void {
  if (shouldBlockRuntimeSelectionCommit()) return
  arbitrateAuthority({ domain: 'selection', incoming: 'block-textarea', blockId })
  selection = {
    realm: 'block-textarea',
    blockId,
    pmFrom: null,
    pmTo: null,
    textareaStart: start,
    textareaEnd: end,
    focusId: focusId ?? null,
    revision: selection.revision + 1,
  }
  emit()
}

export function commitBlockSelection(blockId: string | null): void {
  arbitrateAuthority({ domain: 'selection', incoming: 'cbr', blockId: blockId ?? undefined })
  selection = {
    realm: blockId ? 'block' : 'none',
    blockId,
    pmFrom: null,
    pmTo: null,
    textareaStart: null,
    textareaEnd: null,
    focusId: null,
    revision: selection.revision + 1,
  }
  emit()
}

export function clearAuthoritativeSelection(): void {
  selection = {
    realm: 'none',
    blockId: null,
    pmFrom: null,
    pmTo: null,
    textareaStart: null,
    textareaEnd: null,
    focusId: null,
    revision: selection.revision + 1,
  }
  emit()
}
