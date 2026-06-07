/**
 * Knowledge OS UI Bridge — OKFL single OSKernelClock driver snapshot.
 */
import { subscribeKnowledgeEvents, subscribeLinkIndexState } from '../knowledgeRuntime'
import { initKnowledgeSurfaceRuntime, onKsrWorkspaceOpened } from '../knowledgeSurfaceRuntime'
import type { ContentResolver } from '../knowledgeInteractionRuntime'
import { refreshBacklinkPanel, subscribeBacklinkPanel } from './backlinkPanelRuntime'
import { getBacklinkPanelSnapshot } from './backlinkPanelRuntime'
import {
  flushDeferredGraphLayout,
  getNoteGraphSnapshot,
  subscribeNoteGraph,
} from './noteGraphRuntime'
import { beginKnowledgeOSBoot, endKnowledgeOSBoot, resetKnowledgeOSBoot } from './knowledgeOSBoot'
import {
  getKnowledgeSearchSnapshot,
  subscribeKnowledgeSearch,
  clearKnowledgeSearchCache,
} from './knowledgeSearchRuntime'
import {
  getKnowledgeWorkspaceSnapshot,
  openKnowledgeWorkspace,
  persistKnowledgeUILayout,
  restoreKnowledgeUILayoutFromStorage,
  subscribeKnowledgeWorkspace,
} from './knowledgeWorkspaceRuntime'
import { getNavigationSnapshot, subscribeNavigation } from './noteNavigationRuntime'
import { resetNoteLifecycleRuntime } from './noteLifecycleRuntime'
import { resetNoteNavigationRuntime } from './noteNavigationRuntime'
import { resetBacklinkPanelRuntime } from './backlinkPanelRuntime'
import { resetGraphInteractionGuard } from './graphInteractionGuard'
import { resetGraphLayoutDependencyRuntime } from './graphLayoutDependencyRuntime'
import { resetGraphViewportFocusRuntime } from './graphViewportFocusRuntime'
import { resetGraphNodeActivationRuntime } from './graphNodeActivationRuntime'
import { resetRenderConvergenceTracker } from './graphRenderConvergence'
import { resetGraphNavigationRuntime } from './graphNavigationRuntime'
import { resetGraphReadinessRuntime } from './graphReadinessRuntime'
import { resetNoteGraphRuntime } from './noteGraphRuntime'
import { resetKnowledgeSearchRuntime } from './knowledgeSearchRuntime'
import { resetKnowledgeWorkspaceRuntime } from './knowledgeWorkspaceRuntime'
import { registerVaultFileAdapter, openKnowledgeVault, closeKnowledgeVault } from './vaultRuntime'
import type { KnowledgeOSSnapshot, VaultFileAdapter } from './types'
import { bindGraphViewportOsInvalidation } from './graphViewportOsBinding'
import { bindInteractionAxisOsInvalidation } from './ui/interactionModel/interactionAxisOsBinding'
import { resetSurfaceLayoutRuntime } from './surfaceLayoutRuntime'
import {
  initSurfaceSplitLayoutRuntime,
  resetSurfaceSplitLayoutRuntime,
  restoreSurfaceSplitLayoutFromStorage,
} from './layout/surfaceSplitLayoutRuntime'
import { bindSurfaceSplitOsInvalidation } from './layout/surfaceSplitOsBinding'
import { resetInteractionTransactionState } from './ui/interactionTransaction'
import {
  bumpLiveKernelTick,
  getCurrentOSKernelTick,
  getLiveOSKernelTick,
  resetOSKernelClock,
} from './osKernelClock'
import { buildKernelTickState, projectUnifiedKnowledgeOSSlice } from './osKernelProjection'
import { getSurfaceLayoutSnapshot } from './surfaceLayoutRuntime'
import { ACTIVE_KNOWLEDGE_OS_MODULES } from './activeRuntimeScope'

const osListeners = new Set<() => void>()
let unsubKnowledgeEvents: (() => void) | null = null
let cachedOsSnapshot: KnowledgeOSSnapshot | null = null
let revisionQueued = false
let buildingOsSnapshot = false

function notifyOsListeners(): void {
  cachedOsSnapshot = null
  for (const fn of osListeners) {
    fn()
  }
}

function flushOsRevision(): void {
  revisionQueued = false
  bumpLiveKernelTick('knowledge-invalidate')
  notifyOsListeners()
}

/** Combine multiple invalidations within the same macro task → single kernel tick (non-time debounce).*/
export function requestOsRevision(): void {
  if (revisionQueued) return
  revisionQueued = true
  queueMicrotask(flushOsRevision)
}

export function bumpOsRevisionImmediate(): void {
  if (revisionQueued) {
    revisionQueued = false
  }
  bumpLiveKernelTick('knowledge-invalidate')
  notifyOsListeners()
}

/** Only refreshes the snapshot cache, does not advance the kernel tick (time-travel cursor movement).*/
export function invalidateKnowledgeOSSnapshot(): void {
  notifyOsListeners()
}

/** @deprecated using interactionModel.commitInteractionState*/
export function commitInteractionOsRevision(): void {
  bumpOsRevisionImmediate()
}

function buildOsSnapshot(): KnowledgeOSSnapshot {
  if (buildingOsSnapshot && cachedOsSnapshot) {
    return cachedOsSnapshot
  }
  buildingOsSnapshot = true
  try {
    return buildOsSnapshotInner()
  } finally {
    buildingOsSnapshot = false
  }
}

function buildOsSnapshotInner(): KnowledgeOSSnapshot {
  const ws = getKnowledgeWorkspaceSnapshot()
  const activeDocKey = ws.activeDocKey
  const tick = getCurrentOSKernelTick()

  const navigation = projectUnifiedKnowledgeOSSlice(getNavigationSnapshot(), tick)
  const graph = projectUnifiedKnowledgeOSSlice(getNoteGraphSnapshot(), tick)
  const search = projectUnifiedKnowledgeOSSlice(getKnowledgeSearchSnapshot(), tick)
  const workspace = projectUnifiedKnowledgeOSSlice(ws, tick)
  let backlinks: ReturnType<typeof getBacklinkPanelSnapshot> = null
  if (activeDocKey != null) {
    const bl = getBacklinkPanelSnapshot(activeDocKey)
    if (bl) {
      backlinks = projectUnifiedKnowledgeOSSlice(bl, tick)
    }
  }

  const kernelTickState = buildKernelTickState()

  return {
    revision: tick,
    vaultId: ws.vaultId,
    rootDir: ws.rootDir,
    activeDocKey,
    navigation,
    backlinks,
    graph,
    search,
    workspace,
    kernelTickState,
    surfaceLayout: getSurfaceLayoutSnapshot(tick),
  }
}

export function getKnowledgeOSSnapshot(): Readonly<KnowledgeOSSnapshot> {
  const tick = getCurrentOSKernelTick()
  if (cachedOsSnapshot && cachedOsSnapshot.revision === tick) {
    return cachedOsSnapshot
  }
  cachedOsSnapshot = buildOsSnapshot()
  return cachedOsSnapshot
}

export function getKnowledgeOSRevision(): number {
  return getLiveOSKernelTick()
}

export function subscribeKnowledgeOSSnapshot(listener: () => void): () => void {
  osListeners.add(listener)
  queueMicrotask(() => listener())
  return () => osListeners.delete(listener)
}

let knowledgeUIBridgeBooted = false

export function initKnowledgeOS(options?: {
  fileAdapter?: VaultFileAdapter
  contentResolver?: ContentResolver
}): void {
  if (knowledgeUIBridgeBooted) return
  knowledgeUIBridgeBooted = true
  if (import.meta.env.DEV) {
    console.debug('[KnowledgeOS] active runtime scope', ACTIVE_KNOWLEDGE_OS_MODULES)
  }
  beginKnowledgeOSBoot()
  if (options?.fileAdapter) registerVaultFileAdapter(options.fileAdapter)
  initKnowledgeSurfaceRuntime(options?.contentResolver)
  bindInteractionAxisOsInvalidation(() => invalidateKnowledgeOSSnapshot())
  bindGraphViewportOsInvalidation(() => invalidateKnowledgeOSSnapshot())
  bindSurfaceSplitOsInvalidation(() => invalidateKnowledgeOSSnapshot())
  initSurfaceSplitLayoutRuntime()

  const relay = () => requestOsRevision()
  subscribeNavigation(relay)
  subscribeBacklinkPanel(relay)
  subscribeNoteGraph(relay)
  subscribeKnowledgeSearch(relay)
  subscribeKnowledgeWorkspace(relay)
  subscribeLinkIndexState(() => {
    refreshBacklinkPanel()
    const wsActive = getKnowledgeWorkspaceSnapshot().activeDocKey
    if (wsActive) refreshBacklinkPanel(wsActive)
    requestOsRevision()
  })

  if (!unsubKnowledgeEvents) {
    unsubKnowledgeEvents = subscribeKnowledgeEvents((ev) => {
      if (
        ev.kind === 'index-updated' ||
        ev.kind === 'graph-updated' ||
        ev.kind === 'document-renamed'
      ) {
        refreshBacklinkPanel()
        const wsActive = getKnowledgeWorkspaceSnapshot().activeDocKey
        if (wsActive) refreshBacklinkPanel(wsActive)
        clearKnowledgeSearchCache()
        requestOsRevision()
      }
    })
  }

  const finishBoot = (): void => {
    endKnowledgeOSBoot()
    flushDeferredGraphLayout()
    invalidateKnowledgeOSSnapshot()
  }

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => finishBoot(), { timeout: 1200 })
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(finishBoot)
    })
  }
}

export function onKnowledgeOSWorkspaceOpened(rootDir: string): void {
  openKnowledgeVault(rootDir)
  openKnowledgeWorkspace(rootDir)
  onKsrWorkspaceOpened(rootDir)
  const vaultId = rootDir.replace(/\\/g, '/').replace(/\/+$/u, '')
  restoreKnowledgeUILayoutFromStorage(vaultId)
  restoreSurfaceSplitLayoutFromStorage()
  bumpLiveKernelTick('workspace')
  notifyOsListeners()
}

export function onKnowledgeOSWorkspaceClosing(rootDir: string): void {
  const vaultId = rootDir.replace(/\\/g, '/').replace(/\/+$/u, '')
  persistKnowledgeUILayout(vaultId)
  closeKnowledgeVault(vaultId)
  resetKnowledgeOS()
}

export function resetKnowledgeOS(): void {
  resetKnowledgeOSBoot()
  resetSurfaceLayoutRuntime()
  resetSurfaceSplitLayoutRuntime()
  resetInteractionTransactionState()
  resetNoteLifecycleRuntime()
  resetNoteNavigationRuntime()
  resetBacklinkPanelRuntime()
  resetGraphInteractionGuard()
  resetGraphReadinessRuntime()
  resetGraphNodeActivationRuntime()
  resetRenderConvergenceTracker()
  resetGraphLayoutDependencyRuntime()
  resetGraphViewportFocusRuntime()
  resetGraphNavigationRuntime()
  resetNoteGraphRuntime()
  resetKnowledgeSearchRuntime()
  resetKnowledgeWorkspaceRuntime()
  registerVaultFileAdapter(null)
  osListeners.clear()
  resetOSKernelClock()
  cachedOsSnapshot = null
  revisionQueued = false
  if (unsubKnowledgeEvents) {
    unsubKnowledgeEvents()
    unsubKnowledgeEvents = null
  }
}
