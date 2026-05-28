import {
  activateTab,
  bindWorkspaceVault,
  closeTab,
  getActiveTab,
  getWorkspaceState,
  onKnowledgeWorkspaceOpened,
  openDocumentTab,
  getDocumentMeta,
} from '../knowledgeRuntime'
import { setGraphViewport } from '../knowledgeRuntime/workspaceRuntime'
import { vaultIdFromRoot } from '../knowledgeRuntime'
import { getKnowledgeVaultRoot } from './vaultRuntime'
import type { AbsoluteDocPath, DocKey } from '../knowledgeRuntime/types'
import type { KnowledgeWorkspaceSnapshot, KnowledgeWorkspaceTabSnapshot } from './types'

let revision = 0
const listeners = new Set<() => void>()

function notify(): void {
  revision += 1
  listeners.forEach((fn) => fn())
}

function buildSnapshot(): KnowledgeWorkspaceSnapshot {
  const ws = getWorkspaceState()
  const active = getActiveTab()
  const tabs: KnowledgeWorkspaceTabSnapshot[] = [...ws.tabs.values()].map((t) => {
    const meta = getDocumentMeta(t.docKey)
    return {
      id: t.id,
      docKey: t.docKey,
      absolutePath: t.absolutePath,
      title: meta?.title ?? t.docKey.split('/').pop() ?? t.docKey,
      pinned: t.pinned,
      active: active?.id === t.id,
    }
  })
  tabs.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return a.title.localeCompare(b.title)
  })

  return {
    vaultId: ws.vaultId,
    rootDir: null,
    tabs,
    activeDocKey: active?.docKey ?? null,
    revision,
  }
}

export function openKnowledgeWorkspace(rootDir: string): void {
  onKnowledgeWorkspaceOpened(rootDir)
  bindWorkspaceVault(vaultIdFromRoot(rootDir))
  notify()
}

export function openNoteInWorkspace(absolutePath: AbsoluteDocPath, docKey: DocKey): void {
  openDocumentTab(absolutePath, docKey)
  notify()
}

export function activateWorkspaceTab(tabId: string): void {
  activateTab(tabId)
  notify()
}

export function closeWorkspaceTab(tabId: string): void {
  closeTab(tabId)
  notify()
}

export function getKnowledgeWorkspaceSnapshot(): KnowledgeWorkspaceSnapshot {
  const snap = buildSnapshot()
  return { ...snap, rootDir: getKnowledgeVaultRoot() }
}

export function subscribeKnowledgeWorkspace(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const KNOWLEDGE_UI_LAYOUT_PREFIX = 'luna.knowledge.layout.'

export function persistKnowledgeUILayout(vaultId: string): void {
  const trimmed = vaultId.trim()
  if (!trimmed) return
  try {
    const ws = getWorkspaceState()
    const json = JSON.stringify({
      vaultId: trimmed,
      graphViewport: ws.graphViewport,
    })
    localStorage.setItem(`${KNOWLEDGE_UI_LAYOUT_PREFIX}${trimmed}`, json)
  } catch {
    /* ignore quota */
  }
}

export function restoreKnowledgeUILayoutFromStorage(vaultId: string): void {
  const trimmed = vaultId.trim()
  if (!trimmed) return
  try {
    const json = localStorage.getItem(`${KNOWLEDGE_UI_LAYOUT_PREFIX}${trimmed}`)
    if (!json) return
    const data = JSON.parse(json) as { graphViewport?: { x: number; y: number; zoom: number } }
    if (data.graphViewport) setGraphViewport(data.graphViewport)
  } catch {
    /* ignore corrupt layout */
  }
  notify()
}

/** @deprecated Luna snapshot is the true source of tab; only UI layout is retained for persistence*/
export function persistWorkspaceSession(vaultId: string): void {
  persistKnowledgeUILayout(vaultId)
}

/** @deprecated Luna snapshot is the true source of tab; only restores UI layout such as map viewport*/
export function restoreWorkspaceSessionFromStorage(vaultId: string): void {
  restoreKnowledgeUILayoutFromStorage(vaultId)
}

export { setGraphViewport }

export function resetKnowledgeWorkspaceRuntime(): void {
  revision = 0
  listeners.clear()
}
