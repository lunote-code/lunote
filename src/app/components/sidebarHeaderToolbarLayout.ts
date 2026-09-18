import type { SidebarPanelView } from '../workspace/sidebarPanelView'

export const SIDEBAR_HEADER_BTN_SIZE_PX = 28
export const SIDEBAR_HEADER_BTN_GAP_PX = 4
export const SIDEBAR_HEADER_SECTION_GAP_PX = 4

export function sidebarHeaderSlotWidth(count: number): number {
  if (count <= 0) return 0
  return count * SIDEBAR_HEADER_BTN_SIZE_PX + (count - 1) * SIDEBAR_HEADER_BTN_GAP_PX
}

function sidebarHeaderRowWidth(
  visibleViewCount: number,
  trailingSlotCount: number,
  needsOverflow: boolean,
): number {
  const leadingCount = visibleViewCount + (needsOverflow ? 1 : 0)
  const leadingWidth = sidebarHeaderSlotWidth(leadingCount)
  const trailingWidth = sidebarHeaderSlotWidth(trailingSlotCount)
  if (leadingWidth <= 0 && trailingWidth <= 0) return 0
  if (leadingWidth <= 0) return trailingWidth
  if (trailingWidth <= 0) return leadingWidth
  return leadingWidth + SIDEBAR_HEADER_SECTION_GAP_PX + trailingWidth
}

export function computeSidebarHeaderVisibleViews(
  containerWidth: number,
  viewCount: number,
  trailingSlotCount: number,
): { maxVisible: number; needsOverflow: boolean } {
  if (viewCount <= 0) {
    return { maxVisible: 0, needsOverflow: false }
  }

  if (sidebarHeaderRowWidth(viewCount, trailingSlotCount, false) <= containerWidth) {
    return { maxVisible: viewCount, needsOverflow: false }
  }

  for (let visible = viewCount - 1; visible >= 1; visible -= 1) {
    if (sidebarHeaderRowWidth(visible, trailingSlotCount, true) <= containerWidth) {
      return { maxVisible: visible, needsOverflow: true }
    }
  }

  return { maxVisible: 1, needsOverflow: viewCount > 1 }
}

export function splitSidebarHeaderViews(
  views: readonly SidebarPanelView[],
  activeView: SidebarPanelView,
  maxVisible: number,
): { visible: SidebarPanelView[]; overflow: SidebarPanelView[] } {
  if (maxVisible >= views.length) {
    return { visible: [...views], overflow: [] }
  }

  const ordered = [activeView, ...views.filter((view) => view !== activeView)]
  return {
    visible: ordered.slice(0, maxVisible),
    overflow: ordered.slice(maxVisible),
  }
}
