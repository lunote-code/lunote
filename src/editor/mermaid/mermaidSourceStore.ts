import type { Editor } from '@tiptap/core'

import {
  clearPmMeta,
  getPmMetaForBlock,
  listPmMetaBlockIds,
  removePmMeta,
  setPmMeta,
  updatePmMetaPos,
} from '../codeBlockRuntime/bridge/pmBlockRegistry'
import { flushBlockToPm, flushAllBlocksToPm } from '../codeBlockRuntime/bridge/cbrToPmSync'
import type { CbrFlushReason } from '../codeBlockRuntime/bridge/cbrToPmSync'
import { clearCommitTracking } from '../codeBlockRuntime/bridge/syncGuard'
import {
  getBlock,
  getBlockMode,
  getFocusedBlockId,
  getCodeBlockRuntimeSnapshot,
  registerBlock as registerCbrBlock,
  removeBlock as removeCbrBlock,
  setBlockMode,
  subscribeCodeBlockRuntime,
  clearCodeBlockRuntime,
} from '../codeBlockRuntime'
import {
  pushRuntimeSnapshot,
  createRuntimeSnapshot,
} from '../codeBlockRuntime/kernel'
import { commitCbrUi, commitInputDraft, publishCanonicalSnapshot } from '../documentRuntime/sourceOfTruth'
import {
  clearCollaborativeState,
  clearPatchQueues,
  clearRemoteReconciliation,
  reconcileRemoteQueue,
  resumeRemotePatch,
  suspendRemotePatch,
} from '../codeBlockRuntime/collab'
import { cancelBlockRender, invalidateBlockParse } from '../runtimeEngine'
import { setBlockFocus } from '../documentRuntime'
import {
  cancelAllAsyncBlockRender,
  clearRuntimeSurface,
  destroyBlockLifecycle,
  releaseRenderHost,
} from '../runtimeEngine/unified'
import type { CodeBlockMode } from '../codeBlockRuntime'
import type { MermaidFlushReason } from './mermaidSourceBridge'
import { resolveMermaidBlockPos } from './mermaidSourceCommit'
import { newMermaidCommitId } from './mermaidSourceCommitId'

export type MermaidViewTab = 'source' | 'preview'

export type MermaidBlockSession = {
  blockId: string
  pos: number
  draft: string
  tab: MermaidViewTab
  commitId: string
  version: number
  anchorEl: HTMLElement | null
}

let composing = false

function tabToMode(tab: MermaidViewTab): CodeBlockMode {
  return tab === 'source' ? 'edit' : 'preview'
}

function modeToTab(mode: CodeBlockMode): MermaidViewTab {
  return mode === 'edit' ? 'source' : 'preview'
}

function buildSession(blockId: string): MermaidBlockSession | undefined {
  const runtime = getBlock(blockId)
  const meta = getPmMetaForBlock(blockId)
  if (!runtime || runtime.type !== 'mermaid' || !meta) return undefined
  return {
    blockId,
    pos: meta.pos,
    draft: runtime.state.draft,
    tab: modeToTab(runtime.state.mode),
    commitId: meta.commitId,
    version: meta.version,
    anchorEl: null,
  }
}

export type MermaidSessionSnapshot = {
  sessions: Map<string, MermaidBlockSession>
  activeBlockId: string | null
  codeTabBlockIds: readonly string[]
  pendingTabByBlockId: ReadonlyMap<string, MermaidViewTab>
}

let cachedMermaidSnapshot: MermaidSessionSnapshot | null = null
const mermaidListeners = new Set<() => void>()

function rebuildMermaidSnapshot(): MermaidSessionSnapshot {
  const sessions = new Map<string, MermaidBlockSession>()
  const codeTabBlockIds: string[] = []
  const pendingTabByBlockId = new Map<string, MermaidViewTab>()

  for (const blockId of listPmMetaBlockIds()) {
    const session = buildSession(blockId)
    if (session) {
      sessions.set(blockId, session)
      if (session.tab === 'source') codeTabBlockIds.push(blockId)
    }
  }

  for (const [id, partial] of getCodeBlockRuntimeSnapshot().pendingByBlockId) {
    if (partial.mode != null) pendingTabByBlockId.set(id, modeToTab(partial.mode))
  }

  cachedMermaidSnapshot = {
    sessions,
    activeBlockId: getFocusedBlockId(),
    codeTabBlockIds,
    pendingTabByBlockId,
  }
  return cachedMermaidSnapshot
}

function emitMermaid(): void {
  rebuildMermaidSnapshot()
  mermaidListeners.forEach((fn) => fn())
}

subscribeCodeBlockRuntime(() => emitMermaid())

export function subscribeMermaidSourceStore(listener: () => void): () => void {
  mermaidListeners.add(listener)
  return () => mermaidListeners.delete(listener)
}

export function getMermaidSessionSnapshot(): MermaidSessionSnapshot {
  return cachedMermaidSnapshot ?? rebuildMermaidSnapshot()
}

export function getMermaidCodeTabSessions(): MermaidBlockSession[] {
  return getMermaidSessionSnapshot().codeTabBlockIds
    .map((id) => getMermaidBlockSession(id))
    .filter((s): s is MermaidBlockSession => !!s)
}

export function getActiveMermaidBlockId(): string | null {
  return getFocusedBlockId()
}

export function getMermaidBlockSession(blockId: string): MermaidBlockSession | undefined {
  return buildSession(blockId)
}

export function getActiveMermaidBlockSession(): MermaidBlockSession | undefined {
  const id = getFocusedBlockId()
  return id ? buildSession(id) : undefined
}

export function isMermaidSourceComposing(): boolean {
  return composing
}

export function setMermaidSourceComposing(active: boolean): void {
  composing = active
}

export function getMermaidBlockTab(blockId: string): MermaidViewTab {
  return modeToTab(getBlockMode(blockId))
}

export function setActiveMermaidTab(blockId: string, tab: MermaidViewTab): void {
  const mode = tabToMode(tab)
  setBlockMode(blockId, mode)
  reconcileRemoteQueue(blockId)
  const meta = getPmMetaForBlock(blockId)
  if (!meta) return
  commitCbrUi(blockId, { mode }, meta.commitId)
}

export function registerMermaidBlockSession(blockId: string, pos: number, initialSource: string): void {
  if (getPmMetaForBlock(blockId)) {
    updateMermaidBlockPos(blockId, pos)
    return
  }
  registerCbrBlock(blockId, 'mermaid', {
    draft: initialSource,
    mode: getBlockMode(blockId),
  })
  setPmMeta(blockId, {
    pos,
    commitId: newMermaidCommitId(),
    version: 1,
  })
  pushRuntimeSnapshot(createRuntimeSnapshot())
  publishCanonicalSnapshot()
  emitMermaid()
}

export function updateMermaidBlockPos(blockId: string, pos: number): void {
  updatePmMetaPos(blockId, pos)
}

export function setMermaidCodeTabOpen(blockId: string, open: boolean): void {
  setActiveMermaidTab(blockId, open ? 'source' : 'preview')
}

export function bindMermaidBlockAnchor(_blockId: string, _anchorEl: HTMLElement): void {
  /*CBR: no anchor/portal*/
}

export function setActiveMermaidBlockId(blockId: string | null): void {
  const prev = getFocusedBlockId()
  if (prev && prev !== blockId) {
    resumeRemotePatch(prev)
    reconcileRemoteQueue(prev)
  }
  setBlockFocus(blockId)
  if (blockId) suspendRemotePatch(blockId)
}

export function setMermaidBlockDraft(blockId: string, draft: string): void {
  commitInputDraft(blockId, draft)
}

export function flushMermaidBlockSession(
  editor: Editor,
  blockId: string,
  reason: MermaidFlushReason,
  commitId?: string,
): boolean {
  reconcileRemoteQueue(blockId)
  return flushBlockToPm(editor, blockId, reason as CbrFlushReason, commitId)
}

export function flushActiveMermaidBlock(editor: Editor, reason: MermaidFlushReason): boolean {
  const id = getFocusedBlockId()
  if (!id) return false
  return flushMermaidBlockSession(editor, id, reason)
}

export function removeMermaidBlockSession(blockId: string): void {
  const had = removePmMeta(blockId)
  removeCbrBlock(blockId)
  clearCommitTracking(blockId)
  clearCollaborativeState(blockId)
  clearPatchQueues(blockId)
  clearRemoteReconciliation(blockId)
  cancelBlockRender(blockId)
  cancelAllAsyncBlockRender(blockId)
  destroyBlockLifecycle(blockId)
  releaseRenderHost(blockId)
  clearRuntimeSurface(blockId)
  invalidateBlockParse(blockId)
  if (!had) return
  emitMermaid()
}

export function notifyMermaidPmDocChanged(editor: Editor): void {
  remapMermaidPositions(editor)
  emitMermaid()
}

export function flushAllMermaidBlocks(editor: Editor, reason: MermaidFlushReason): void {
  flushAllBlocksToPm(editor, reason as CbrFlushReason)
}

export function clearMermaidSourceStore(): void {
  clearPmMeta()
  clearCodeBlockRuntime()
  clearCommitTracking()
  clearCollaborativeState()
  clearPatchQueues()
  clearRemoteReconciliation()
  emitMermaid()
}

/** Bridge: remap pos (CBR sync has processed draft)*/
export function remapMermaidPositions(editor: Editor): void {
  for (const blockId of listPmMetaBlockIds()) {
    const meta = getPmMetaForBlock(blockId)!
    const resolved = resolveMermaidBlockPos(editor, meta.pos)
    if (resolved == null) {
      removeMermaidBlockSession(blockId)
      continue
    }
    if (resolved !== meta.pos) {
      updatePmMetaPos(blockId, resolved)
    }
  }
}
