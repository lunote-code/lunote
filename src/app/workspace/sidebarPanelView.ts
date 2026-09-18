export type SidebarPanelView = 'files-list' | 'files-tree' | 'outline' | 'calendar'

export type SidebarListMode = 'files' | 'outline' | 'calendar'
export type SidebarFileView = 'tree' | 'list'

const STORAGE_KEY = 'sidebarPanelView'
const LEGACY_LIST_MODE_KEY = 'sidebarListMode'
const LEGACY_FILE_VIEW_KEY = 'sidebarFileView'

export function isCalendarPanelView(view: SidebarPanelView): boolean {
  return view === 'calendar'
}

export function isOutlinePanelView(view: SidebarPanelView): boolean {
  return view === 'outline'
}

export function isFilesPanelView(view: SidebarPanelView): view is 'files-list' | 'files-tree' {
  return view === 'files-list' || view === 'files-tree'
}

export function sidebarListModeFromPanelView(view: SidebarPanelView): SidebarListMode {
  if (view === 'outline') return 'outline'
  if (view === 'calendar') return 'calendar'
  return 'files'
}

export function sidebarFileViewFromPanelView(view: SidebarPanelView): SidebarFileView {
  return view === 'files-list' ? 'list' : 'tree'
}

export function filesPanelViewFromFileView(fileView: SidebarFileView): 'files-list' | 'files-tree' {
  return fileView === 'list' ? 'files-list' : 'files-tree'
}

export function loadSidebarPanelView(): SidebarPanelView {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'files-list' || saved === 'files-tree' || saved === 'outline' || saved === 'calendar') {
    return saved
  }

  const listMode = localStorage.getItem(LEGACY_LIST_MODE_KEY)
  if (listMode === 'outline') return 'outline'

  const fileView = localStorage.getItem(LEGACY_FILE_VIEW_KEY)
  return fileView === 'list' ? 'files-list' : 'files-tree'
}

export function persistSidebarPanelView(view: SidebarPanelView): void {
  localStorage.setItem(STORAGE_KEY, view)
  localStorage.setItem(LEGACY_LIST_MODE_KEY, sidebarListModeFromPanelView(view))
  localStorage.setItem(LEGACY_FILE_VIEW_KEY, sidebarFileViewFromPanelView(view))
}

export function resolveFilesPanelView(
  current: SidebarPanelView,
  lastFiles: 'files-list' | 'files-tree',
): 'files-list' | 'files-tree' {
  return isFilesPanelView(current) ? current : lastFiles
}
