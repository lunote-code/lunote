import { pathsEqual } from '../../lib/workspacePathUtils'
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
import { absolutePathToDocKeyOs, getKnowledgeVaultRoot } from './vaultRuntime'
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

export function openNoteInWorkspace(
  absolutePath: AbsoluteDocPath,
  docKey: DocKey,
  options?: { activate?: boolean },
): void {
  openDocumentTab(absolutePath, docKey, options)
  notify()
}

/** Mirror Luna opened tabs into Knowledge workspace; close tabs no longer open in Luna. */
export function syncKnowledgeWorkspaceTabsFromLuna(
  rootDir: string,
  openedTabPaths: readonly string[],
  activePath: string | null,
  isBufferTab: (path: string) => boolean,
): void {
  const root = rootDir.replace(/[/\\]+$/u, '')
  const lunaOpenPaths = openedTabPaths.filter((path) => !isBufferTab(path))

  const staleTabIds = [...getWorkspaceState().tabs.values()]
    .filter((tab) => !lunaOpenPaths.some((path) => pathsEqual(path, tab.absolutePath)))
    .map((tab) => tab.id)
  for (const tabId of staleTabIds) {
    closeTab(tabId)
  }

  for (const path of lunaOpenPaths) {
    openDocumentTab(path, absolutePathToDocKeyOs(path, root), { activate: false })
  }

  if (activePath && !isBufferTab(activePath)) {
    const activeTab = [...getWorkspaceState().tabs.values()].find((tab) =>
      pathsEqual(tab.absolutePath, activePath),
    )
    if (activeTab) activateTab(activeTab.id)
  }

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

export { setGraphViewport }

export function resetKnowledgeWorkspaceRuntime(): void {
  revision = 0
  listeners.clear()
}
