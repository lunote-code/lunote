import type { CodeBlockMode, CodeBlockRuntime, CodeBlockRuntimeSnapshot, CodeBlockType } from './types'

const blockMap = new Map<string, CodeBlockRuntime>()
const pendingByBlockId = new Map<string, Partial<CodeBlockRuntime['state']>>()
let focusedBlockId: string | null = null
const listeners = new Set<() => void>()

let cachedSnapshot: CodeBlockRuntimeSnapshot | null = null
let emitSuppressed = 0

function defaultState(
  draft = '',
  mode: CodeBlockMode = 'preview',
): CodeBlockRuntime['state'] {
  return { draft, mode, height: 0, scrollTop: 0 }
}

function rebuildSnapshot(): CodeBlockRuntimeSnapshot {
  cachedSnapshot = { blockMap, focusedBlockId, pendingByBlockId }
  return cachedSnapshot
}

function emit(): void {
  if (emitSuppressed > 0) return
  rebuildSnapshot()
  listeners.forEach((fn) => fn())
}

export function suppressRuntimeEmit(): void {
  emitSuppressed += 1
}

export function releaseRuntimeEmit(): void {
  emitSuppressed = Math.max(0, emitSuppressed - 1)
}

/** Kernel transaction end: single emit*/
export function flushRuntimeEmit(): void {
  if (emitSuppressed > 0) return
  rebuildSnapshot()
  listeners.forEach((fn) => fn())
}

export type SilentBlockPatch = Partial<CodeBlockRuntime['state']> & {
  dirty?: boolean
}

/** Kernel-specific: silent patch, no emit*/
export function applyPatchSilent(blockId: string, patch: SilentBlockPatch): boolean {
  const b = blockMap.get(blockId)
  if (!b) {
    if (patch.mode === undefined) return false
    const pending = pendingByBlockId.get(blockId) ?? {}
    if (pending.mode === patch.mode) return false
    pendingByBlockId.set(blockId, { ...pending, mode: patch.mode })
    return true
  }

  let changed = false
  if (patch.draft !== undefined && b.state.draft !== patch.draft) {
    b.state.draft = patch.draft
    changed = true
  }
  if (patch.mode !== undefined && b.state.mode !== patch.mode) {
    b.state.mode = patch.mode
    changed = true
  }
  if (patch.height != null && b.state.height !== patch.height) {
    b.state.height = patch.height
    changed = true
  }
  if (patch.scrollTop != null && b.state.scrollTop !== patch.scrollTop) {
    b.state.scrollTop = patch.scrollTop
    changed = true
  }
  if (patch.dirty !== undefined && b.ui.dirty !== patch.dirty) {
    b.ui.dirty = patch.dirty
    changed = true
  }
  return changed
}

export function subscribeCodeBlockRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCodeBlockRuntimeSnapshot(): CodeBlockRuntimeSnapshot {
  return cachedSnapshot ?? rebuildSnapshot()
}

export function getBlock(blockId: string): CodeBlockRuntime | undefined {
  return blockMap.get(blockId)
}

export function getFocusedBlockId(): string | null {
  return focusedBlockId
}

export function getBlockMode(blockId: string): CodeBlockMode {
  const b = blockMap.get(blockId)
  if (b) return b.state.mode
  return pendingByBlockId.get(blockId)?.mode ?? 'preview'
}

/** Create runtime (draft/mode is only initialized once)*/
export function registerBlock(
  blockId: string,
  type: CodeBlockType,
  init?: { draft?: string; mode?: CodeBlockMode },
): void {
  if (!blockId) return
  if (blockMap.has(blockId)) return

  const pending = pendingByBlockId.get(blockId)
  pendingByBlockId.delete(blockId)

  blockMap.set(blockId, {
    blockId,
    type,
    state: defaultState(
      init?.draft ?? pending?.draft ?? '',
      init?.mode ?? pending?.mode ?? 'preview',
    ),
    ui: { focused: false, dirty: false },
  })
  emit()
}

export function removeBlock(blockId: string): void {
  if (!blockMap.delete(blockId)) {
    pendingByBlockId.delete(blockId)
    if (focusedBlockId === blockId) focusedBlockId = null
    return
  }
  pendingByBlockId.delete(blockId)
  if (focusedBlockId === blockId) focusedBlockId = null
  emit()
}

export function updateBlockDraft(blockId: string, value: string): void {
  const b = blockMap.get(blockId)
  if (!b || b.state.draft === value) return
  b.state.draft = value
  b.ui.dirty = true
  emit()
}

/** PM→CBR: Synchronize draft, do not mark dirty (Bridge only)*/
export function applyBlockDraftFromPm(blockId: string, value: string): void {
  const b = blockMap.get(blockId)
  if (!b || b.state.draft === value) return
  b.state.draft = value
  b.ui.dirty = false
  emit()
}

export function setBlockMode(blockId: string, mode: CodeBlockMode): void {
  const b = blockMap.get(blockId)
  if (b) {
    if (b.state.mode === mode) return
    b.state.mode = mode
    emit()
    return
  }
  const pending = pendingByBlockId.get(blockId) ?? {}
  if (pending.mode === mode) return
  pendingByBlockId.set(blockId, { ...pending, mode })
  emit()
}

export function setBlockLayout(
  blockId: string,
  patch: Partial<Pick<CodeBlockRuntime['state'], 'height' | 'scrollTop'>>,
): void {
  const b = blockMap.get(blockId)
  if (!b) return
  let changed = false
  if (patch.height != null && b.state.height !== patch.height) {
    b.state.height = patch.height
    changed = true
  }
  if (patch.scrollTop != null && b.state.scrollTop !== patch.scrollTop) {
    b.state.scrollTop = patch.scrollTop
    changed = true
  }
  if (changed) emit()
}

export function focusBlock(blockId: string | null): void {
  if (focusedBlockId === blockId) return
  if (focusedBlockId) {
    const prev = blockMap.get(focusedBlockId)
    if (prev) prev.ui.focused = false
  }
  focusedBlockId = blockId
  if (blockId) {
    const b = blockMap.get(blockId)
    if (b) b.ui.focused = true
  }
  emit()
}

export function setBlockDirty(blockId: string, dirty: boolean): void {
  const b = blockMap.get(blockId)
  if (!b || b.ui.dirty === dirty) return
  b.ui.dirty = dirty
  emit()
}

export function clearCodeBlockRuntime(): void {
  blockMap.clear()
  pendingByBlockId.clear()
  focusedBlockId = null
  emit()
}
