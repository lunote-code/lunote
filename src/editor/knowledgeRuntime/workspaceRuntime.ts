import { pathsEqual } from '../../lib/workspacePathUtils'
import type { AbsoluteDocPath, DocKey } from './types'

export type WorkspaceTab = {
  id: string
  absolutePath: AbsoluteDocPath
  docKey: DocKey
  pinned: boolean
  lastActiveAt: number
}

export type WorkspacePane = {
  id: string
  tabIds: string[]
  activeTabId: string | null
}

export type WorkspaceState = {
  vaultId: string | null
  tabs: Map<string, WorkspaceTab>
  panes: WorkspacePane[]
  activePaneId: string | null
  history: AbsoluteDocPath[]
  graphViewport: { x: number; y: number; zoom: number }
}

const state: WorkspaceState = {
  vaultId: null,
  tabs: new Map(),
  panes: [],
  activePaneId: null,
  history: [],
  graphViewport: { x: 0, y: 0, zoom: 1 },
}

let tabSeq = 0

export function bindWorkspaceVault(vaultId: string | null): void {
  if (state.vaultId === vaultId) return
  state.vaultId = vaultId
  state.tabs.clear()
  state.panes = [{ id: 'main', tabIds: [], activeTabId: null }]
  state.activePaneId = 'main'
  state.history = []
}

export function openDocumentTab(
  absolutePath: AbsoluteDocPath,
  docKey: DocKey,
  options?: { pinned?: boolean; activate?: boolean },
): WorkspaceTab {
  const existing = [...state.tabs.values()].find((t) => pathsEqual(t.absolutePath, absolutePath))
  if (existing) {
    existing.lastActiveAt = performance.now()
    if (options?.activate !== false) activateTab(existing.id)
    return existing
  }
  const tab: WorkspaceTab = {
    id: `tab-${++tabSeq}`,
    absolutePath,
    docKey,
    pinned: options?.pinned ?? false,
    lastActiveAt: performance.now(),
  }
  state.tabs.set(tab.id, tab)
  const pane = state.panes[0]
  if (pane) {
    pane.tabIds.push(tab.id)
    if (options?.activate !== false) pane.activeTabId = tab.id
  }
  pushHistory(absolutePath)
  return tab
}

export function activateTab(tabId: string): void {
  const pane = state.panes.find((p) => p.tabIds.includes(tabId))
  if (pane) {
    pane.activeTabId = tabId
    const tab = state.tabs.get(tabId)
    if (tab) {
      tab.lastActiveAt = performance.now()
      pushHistory(tab.absolutePath)
    }
  }
}

export function closeTab(tabId: string): void {
  const tab = state.tabs.get(tabId)
  state.tabs.delete(tabId)
  for (const pane of state.panes) {
    pane.tabIds = pane.tabIds.filter((id) => id !== tabId)
    if (pane.activeTabId === tabId) {
      pane.activeTabId = pane.tabIds[pane.tabIds.length - 1] ?? null
    }
  }
  if (tab) {
    state.history = state.history.filter((p) => !pathsEqual(p, tab.absolutePath))
  }
}

function pushHistory(path: AbsoluteDocPath): void {
  state.history = state.history.filter((p) => !pathsEqual(p, path))
  state.history.push(path)
  if (state.history.length > 100) state.history.shift()
}

export function getWorkspaceState(): Readonly<WorkspaceState> {
  return state
}

export function getActiveTab(): WorkspaceTab | null {
  const pane = state.panes.find((p) => p.id === state.activePaneId) ?? state.panes[0]
  if (!pane?.activeTabId) return null
  return state.tabs.get(pane.activeTabId) ?? null
}

export function setGraphViewport(viewport: { x: number; y: number; zoom: number }): void {
  state.graphViewport = viewport
}

export function serializeWorkspaceSession(): string {
  return JSON.stringify({
    vaultId: state.vaultId,
    tabs: [...state.tabs.values()],
    panes: state.panes,
    activePaneId: state.activePaneId,
    history: state.history,
    graphViewport: state.graphViewport,
  })
}

export function restoreWorkspaceSession(json: string): void {
  try {
    const data = JSON.parse(json) as {
      vaultId: string | null
      tabs: WorkspaceTab[]
      panes: WorkspacePane[]
      activePaneId: string | null
      history: AbsoluteDocPath[]
      graphViewport: { x: number; y: number; zoom: number }
    }
    state.vaultId = data.vaultId
    state.tabs = new Map(data.tabs.map((t) => [t.id, t]))
    state.panes = data.panes
    state.activePaneId = data.activePaneId
    state.history = data.history
    state.graphViewport = data.graphViewport
  } catch {
    /* ignore corrupt session */
  }
}

export function resetWorkspaceRuntime(): void {
  state.vaultId = null
  state.tabs.clear()
  state.panes = []
  state.activePaneId = null
  state.history = []
  state.graphViewport = { x: 0, y: 0, zoom: 1 }
}
