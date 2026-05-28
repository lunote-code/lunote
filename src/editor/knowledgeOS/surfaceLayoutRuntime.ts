/**
 * Knowledge Surface Layout — Container-driven dimensions, bound by OSKernelClock tick.
 */
import type { OSKernelTickId } from './osKernelClock'
import { getCurrentOSKernelTick } from './osKernelClock'
import { getSurfaceSplitLayout, isSurfaceSplitDragging } from './layout/surfaceSplitLayoutRuntime'

export type SurfacePanelType = 'graph' | 'backlink' | 'search'

export type PanelLayoutRect = {
  width: number
  height: number
}

export type TabSurfaceLayoutSnapshot = {
  tabContainerRect: PanelLayoutRect
  activePanelRect: PanelLayoutRect
  availableWidth: number
  availableHeight: number
  activePanel: SurfacePanelType | null
  /** Runtime driven rail width (synchronized with split)*/
  railWidth: number
}

export type SplitSurfaceLayoutSnapshot = {
  editorWidth: number
  railWidth: number
  splitRatio: number
  splitAreaWidth: number
}

export type SurfaceLayoutSnapshot = {
  kernelTick: OSKernelTickId
  revision: number
  split: SplitSurfaceLayoutSnapshot
  tab: TabSurfaceLayoutSnapshot
  graphPanel: PanelLayoutRect
  backlinkPanel: PanelLayoutRect
  searchPanel: PanelLayoutRect
}

const DEFAULT_RECT: PanelLayoutRect = { width: 0, height: 0 }

const DEFAULT_TAB: TabSurfaceLayoutSnapshot = {
  tabContainerRect: { ...DEFAULT_RECT },
  activePanelRect: { ...DEFAULT_RECT },
  availableWidth: 0,
  availableHeight: 0,
  activePanel: null,
  railWidth: 0,
}

let panelRects: Record<SurfacePanelType, PanelLayoutRect> = {
  graph: { ...DEFAULT_RECT },
  backlink: { ...DEFAULT_RECT },
  search: { ...DEFAULT_RECT },
}

let tabLayout: TabSurfaceLayoutSnapshot = { ...DEFAULT_TAB, tabContainerRect: { ...DEFAULT_RECT }, activePanelRect: { ...DEFAULT_RECT } }

let layoutRevision = 0
const listeners = new Set<() => void>()

function notifyLayout(): void {
  layoutRevision += 1
  for (const fn of listeners) {
    fn()
  }
}

export function resetSurfaceLayoutRuntime(): void {
  panelRects = {
    graph: { ...DEFAULT_RECT },
    backlink: { ...DEFAULT_RECT },
    search: { ...DEFAULT_RECT },
  }
  tabLayout = {
    ...DEFAULT_TAB,
    tabContainerRect: { ...DEFAULT_RECT },
    activePanelRect: { ...DEFAULT_RECT },
  }
  layoutRevision = 0
  listeners.clear()
}

export function subscribeSurfaceLayout(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSurfaceLayoutRevision(): number {
  return layoutRevision
}

function normalizeRect(rect: { width: number; height: number }): PanelLayoutRect {
  return {
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  }
}

function rectsEqual(a: PanelLayoutRect, b: PanelLayoutRect): boolean {
  return a.width === b.width && a.height === b.height
}

function syncPanelRectFromTab(activePanel: SurfacePanelType, rect: PanelLayoutRect): void {
  panelRects = { ...panelRects, [activePanel]: { ...rect } }
}

/**
 * Tab surface layout host: Report the tab root container and active panel size.
 */
export function reportTabSurfaceLayout(
  input: {
    tabContainerRect: { width: number; height: number }
    activePanel: SurfacePanelType
    activePanelRect: { width: number; height: number }
  },
  kernelTick?: OSKernelTickId,
): boolean {
  if (isSurfaceSplitDragging()) return false
  const tabContainerRect = normalizeRect(input.tabContainerRect)
  const activePanelRect = normalizeRect(input.activePanelRect)
  const next: TabSurfaceLayoutSnapshot = {
    tabContainerRect,
    activePanelRect,
    availableWidth: activePanelRect.width,
    availableHeight: activePanelRect.height,
    activePanel: input.activePanel,
    railWidth: 0,
  }

  const prev = tabLayout
  const panelUnchanged =
    rectsEqual(prev.tabContainerRect, tabContainerRect) &&
    rectsEqual(prev.activePanelRect, activePanelRect) &&
    prev.activePanel === next.activePanel

  if (panelUnchanged) {
    return false
  }

  tabLayout = next
  syncPanelRectFromTab(input.activePanel, activePanelRect)
  void (kernelTick ?? getCurrentOSKernelTick())
  notifyLayout()
  return true
}

export function getSplitSurfaceLayoutSnapshot(kernelTick?: OSKernelTickId): SplitSurfaceLayoutSnapshot {
  const split = getSurfaceSplitLayout(kernelTick)
  return {
    editorWidth: split.editorWidth,
    railWidth: split.railWidth,
    splitRatio: split.splitRatio,
    splitAreaWidth: split.splitAreaWidth,
  }
}

function mergeTabWithSplitWidth(
  tab: TabSurfaceLayoutSnapshot,
  railWidth: number,
  splitAreaWidth: number,
): TabSurfaceLayoutSnapshot {
  if (isSurfaceSplitDragging() || railWidth <= 0 || splitAreaWidth <= 0) {
    return { ...tab, tabContainerRect: { ...tab.tabContainerRect }, activePanelRect: { ...tab.activePanelRect } }
  }
  const height = tab.tabContainerRect.height || tab.activePanelRect.height
  const panelHeight = tab.activePanelRect.height || height
  return {
    ...tab,
    railWidth,
    availableWidth: railWidth,
    tabContainerRect: { width: railWidth, height },
    activePanelRect: {
      width: railWidth,
      height: panelHeight,
    },
  }
}

export function getTabSurfaceLayoutSnapshot(kernelTick?: OSKernelTickId): TabSurfaceLayoutSnapshot {
  const tick = kernelTick ?? getCurrentOSKernelTick()
  const split = getSplitSurfaceLayoutSnapshot(tick)
  const base = {
    ...tabLayout,
    tabContainerRect: { ...tabLayout.tabContainerRect },
    activePanelRect: { ...tabLayout.activePanelRect },
  }
  return mergeTabWithSplitWidth(base, split.railWidth, split.splitAreaWidth)
}

/**
 * Container size reported by useSurfaceLayout / ResizeObserver (non-React layout decisions).
 * When graph / backlink is inside Tab, it will be subject to tab.activePanelRect. Only search or independent host will be updated here.
 */
export function reportPanelContainerRect(
  type: SurfacePanelType,
  rect: { width: number; height: number },
  kernelTick?: OSKernelTickId,
): boolean {
  if (type !== 'search' && tabLayout.activePanel === type && tabLayout.activePanelRect.width > 0) {
    return false
  }

  const next = normalizeRect(rect)
  const prev = panelRects[type]
  if (prev.width === next.width && prev.height === next.height) {
    return false
  }
  panelRects = { ...panelRects, [type]: next }
  void (kernelTick ?? getCurrentOSKernelTick())
  notifyLayout()
  return true
}

export function computePanelLayout(
  type: SurfacePanelType,
  containerRect: { width: number; height: number },
  kernelTick?: OSKernelTickId,
): PanelLayoutRect {
  const layout = normalizeRect(containerRect)
  reportPanelContainerRect(type, layout, kernelTick)
  return getPanelLayoutForType(type, kernelTick)
}

export function getSurfaceLayoutSnapshot(kernelTick?: OSKernelTickId): SurfaceLayoutSnapshot {
  const tick = kernelTick ?? getCurrentOSKernelTick()
  const split = getSplitSurfaceLayoutSnapshot(tick)
  const tab = getTabSurfaceLayoutSnapshot(tick)
  return {
    kernelTick: tick,
    revision: layoutRevision,
    split,
    tab,
    graphPanel: { ...panelRects.graph },
    backlinkPanel: { ...panelRects.backlink },
    searchPanel: { ...panelRects.search },
  }
}

export function getPanelLayoutForType(
  type: SurfacePanelType,
  kernelTick?: OSKernelTickId,
): PanelLayoutRect {
  const snap = getSurfaceLayoutSnapshot(kernelTick)
  const tab = snap.tab
  if (
    (type === 'graph' || type === 'backlink') &&
    tab.activePanel === type &&
    tab.activePanelRect.width > 0
  ) {
    return { ...tab.activePanelRect }
  }
  return snap[type === 'graph' ? 'graphPanel' : type === 'backlink' ? 'backlinkPanel' : 'searchPanel']
}
