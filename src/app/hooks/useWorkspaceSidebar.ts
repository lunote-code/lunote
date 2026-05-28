import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react'

import type { TranslateFn } from '../../i18n'
import { setWikiLinkSuggestPathProvider } from '../../editor/lunaWikiLinkSuggest'
import { runWorkspaceSearch } from '../search/workspaceSearch'
import { pathSetHas, pathsEqual } from '../../lib/workspacePathUtils'
import {
  filterSidebarWorkspaceTree,
  flattenWorkspaceFiles,
  noteFileStem,
  sortWorkspaceTree,
} from '../workspace/workspaceTree'
import {
  WORKSPACE_FILE_DRAG_THRESHOLD_PX,
  collectFolderNodes,
  isValidMoveDest,
  resolveWorkspaceFilePathUnderPointer,
  type WorkspaceDragTarget,
} from '../workspace/workspaceDrag'
import type { FileSortMode, FsTreeNode, SearchResult } from '../workspace/types'
import type { EditorDocMenuState, FileContextMenuState } from '../workspace/contextMenuTypes'
import { isBufferTabId } from '../workspace/constants'

export type WorkspaceSidebarDeps = {
  t: TranslateFn
  rootDir: string
  rootDirRef: MutableRefObject<string>
  activePath: string
  fileTree: FsTreeNode[]
  fileSortMode: FileSortMode
  expandedDirs: Set<string>
  setExpandedDirs: Dispatch<SetStateAction<Set<string>>>
  searchText: string
  setSearchResults: Dispatch<SetStateAction<SearchResult[]>>
  sidebarListMode: 'files' | 'outline'
  draggingWorkspaceFile: string | null
  setDraggingWorkspaceFile: Dispatch<SetStateAction<string | null>>
  dragOverTarget: WorkspaceDragTarget | null
  setDragOverTarget: Dispatch<SetStateAction<WorkspaceDragTarget | null>>
  setEditorDocMenu: Dispatch<SetStateAction<EditorDocMenuState | null>>
  setFileContextMenu: Dispatch<SetStateAction<FileContextMenuState | null>>
  searchResults: SearchResult[]
  dispatchOpenDocument: (root: string, path: string) => Promise<void>
  handleMoveFileToFolder: (filePath: string, destDir: string) => Promise<void>
  toggleDir: (path: string) => void
  tabLabel: (path: string) => string
  setStatus: (msg: string) => void
}

export function useWorkspaceSidebar(deps: WorkspaceSidebarDeps) {
  const {
    t,
    rootDir,
    rootDirRef,
    activePath,
    fileTree,
    fileSortMode,
    setExpandedDirs,
    searchText,
    setSearchResults,
    sidebarListMode,
    draggingWorkspaceFile,
    setDraggingWorkspaceFile,
    setDragOverTarget,
    setEditorDocMenu,
    setFileContextMenu,
    searchResults,
    dispatchOpenDocument,
    handleMoveFileToFolder,
    toggleDir,
    tabLabel,
    setStatus,
  } = deps

  const filePointerSessionRef = useRef<{ path: string; x: number; y: number; active: boolean } | null>(null)
  const suppressWorkspaceFileClickRef = useRef(false)
  const openWorkspaceFileFromSidebarRef = useRef<(path: string) => void>(() => {})
  const lastSidebarOpenRef = useRef<{ path: string; at: number } | null>(null)
  const handleMoveFileToFolderRef = useRef<(filePath: string, destDir: string) => void>(() => {})

  const workspaceFolderName = useMemo(() => {
    if (!rootDir.trim()) return t('app.titleBar.noFolder')
    const norm = rootDir.replace(/[/\\]+$/u, '')
    const parts = norm.split(/[/\\]/u)
    return parts[parts.length - 1] || norm
  }, [rootDir, t])

  const activeDocumentTitle = useMemo(() => {
    if (!activePath) return t('app.titleBar.noDoc')
    const label = tabLabel(activePath)
    return noteFileStem(label) || label || t('app.tab.unnamed')
  }, [activePath, tabLabel, t])

  const activeDocumentSubtitle = useMemo(() => {
    if (!activePath) return workspaceFolderName
    const label = tabLabel(activePath)
    const dir = label.replace(/\\/g, '/').replace(/\/?[^/]*$/u, '')
    if (dir) return dir
    if (isBufferTabId(activePath)) return t('app.titleBar.tempDoc')
    return workspaceFolderName
  }, [activePath, tabLabel, workspaceFolderName, t])

  const flatWorkspaceFiles = useMemo(
    () => (rootDir && fileTree.length > 0 ? flattenWorkspaceFiles(fileTree, rootDir) : []),
    [fileTree, rootDir],
  )

  useEffect(() => {
    if (!rootDir) {
      setWikiLinkSuggestPathProvider(null)
      return
    }
    setWikiLinkSuggestPathProvider(() =>
      flatWorkspaceFiles
        .filter((f) => /\.md$/iu.test(f.relativePath))
        .map((f) => ({
          docKey: f.relativePath.replace(/\.md$/iu, ''),
          title: f.label.replace(/\.md$/iu, ''),
        })),
    )
    return () => setWikiLinkSuggestPathProvider(null)
  }, [flatWorkspaceFiles, rootDir])

  const sortedFlatWorkspaceFiles = useMemo(() => {
    const next = [...flatWorkspaceFiles]
    next.sort((a, b) => {
      if (fileSortMode === 'group') {
        return (
          (a.sublabel ?? '').localeCompare(b.sublabel ?? '', undefined, { sensitivity: 'base' }) ||
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })
        )
      }
      if (fileSortMode === 'naturalAsc') {
        return a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base', numeric: true })
      }
      if (fileSortMode === 'nameAsc') {
        return (
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
          (a.sublabel ?? '').localeCompare(b.sublabel ?? '', undefined, { sensitivity: 'base' })
        )
      }
      if (fileSortMode === 'modifiedAsc') {
        return (
          (a.modifiedAtMs ?? Number.MAX_SAFE_INTEGER) - (b.modifiedAtMs ?? Number.MAX_SAFE_INTEGER) ||
          a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base', numeric: true })
        )
      }
      return (
        (a.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (b.createdAtMs ?? Number.MAX_SAFE_INTEGER) ||
        a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base', numeric: true })
      )
    })
    return next
  }, [flatWorkspaceFiles, fileSortMode])

  const sortedFileTree = useMemo(
    () => filterSidebarWorkspaceTree(sortWorkspaceTree(fileTree, fileSortMode)),
    [fileTree, fileSortMode],
  )

  const workspaceFolderNodes = useMemo(() => collectFolderNodes(sortedFileTree), [sortedFileTree])

  const sidebarSearchIndex = useMemo(
    () =>
      sortedFlatWorkspaceFiles.map((f) => ({
        path: f.path,
        title: f.label,
        sublabel: f.sublabel ?? '',
        relativePath: f.relativePath,
      })),
    [sortedFlatWorkspaceFiles],
  )

  useEffect(() => {
    const rawQuery = searchText.trim()
    if (!rootDir || !rawQuery) {
      setSearchResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const hits = await runWorkspaceSearch(rootDir, rawQuery, sidebarSearchIndex, 30)
        if (!cancelled) setSearchResults(hits)
      })()
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [rootDir, searchText, setSearchResults, sidebarSearchIndex])

  const onWorkspaceFilePointerDown = useCallback(
    (e: ReactPointerEvent, path: string) => {
      if (!rootDir) return
      filePointerSessionRef.current = { path, x: e.clientX, y: e.clientY, active: false }
    },
    [rootDir],
  )

  const openWorkspaceFileFromSidebar = useCallback(
    (path: string) => {
      if (suppressWorkspaceFileClickRef.current) return
      const root = rootDirRef.current.trim()
      if (!root) return
      const now = Date.now()
      const last = lastSidebarOpenRef.current
      if (last && pathsEqual(last.path, path) && now - last.at < 80) return
      lastSidebarOpenRef.current = { path, at: now }
      void (async () => {
        try {
          await dispatchOpenDocument(root, path)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const display = /20\s*MB|exceeds.*limit/i.test(message)
            ? t('app.status.noteTooLarge')
            : message
          setStatus(t('app.status.openFailed', { message: display }))
        }
      })()
    },
    [dispatchOpenDocument, rootDirRef, setStatus, t],
  )

  openWorkspaceFileFromSidebarRef.current = openWorkspaceFileFromSidebar
  handleMoveFileToFolderRef.current = handleMoveFileToFolder

  const toggleWorkspaceDir = useCallback(
    (path: string) => {
      if (suppressWorkspaceFileClickRef.current) return
      toggleDir(path)
    },
    [toggleDir],
  )

  const onSidebarFileContextMenu = useCallback(
    (
      e: ReactMouseEvent,
      path: string,
      isDirectory = false,
      variant: 'item' | 'blank' = 'item',
    ) => {
      e.preventDefault()
      e.stopPropagation()
      const pad = 8
      const mw = 232
      const mh = 380
      let x = e.clientX
      let y = e.clientY
      if (x + mw > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - pad - mw)
      if (y + mh > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - pad - mh)
      if (x < pad) x = pad
      if (y < pad) y = pad
      setEditorDocMenu(null)
      setFileContextMenu({ x, y, path, isDirectory, variant })
    },
    [setEditorDocMenu, setFileContextMenu],
  )

  const onSidebarBlankContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      if (!rootDir) return
      if (sidebarListMode !== 'files') return
      if (searchText && searchResults.length > 0) return
      const target = e.target as HTMLElement
      if (target.closest('.note-item, .tree-folder, .tree-file, .file-ctx-menu')) return
      onSidebarFileContextMenu(e, rootDir, true, 'blank')
    },
    [onSidebarFileContextMenu, rootDir, searchResults.length, searchText, sidebarListMode],
  )

  useEffect(() => {
    const resolveDropTargetUnderPointer = (clientX: number, clientY: number): WorkspaceDragTarget | null => {
      const normRoot = rootDirRef.current.replace(/[/\\]+$/u, '')
      const stack = document.elementsFromPoint(clientX, clientY)
      for (const el of stack) {
        if (!(el instanceof HTMLElement)) continue
        if (el.classList.contains('tree-file-dragging')) continue

        const folderEl = el.closest('[data-workspace-folder-path].tree-folder') as HTMLElement | null
        if (folderEl) {
          const path = folderEl.getAttribute('data-workspace-folder-path') ?? ''
          if (path) return { destDir: path, kind: 'folder', anchorPath: path }
        }

        const fileDropEl = el.closest('[data-workspace-drop-dir]') as HTMLElement | null
        if (fileDropEl) {
          const destDir = fileDropEl.getAttribute('data-workspace-drop-dir') ?? ''
          const anchorPath = fileDropEl.getAttribute('data-workspace-file-path') ?? undefined
          if (destDir) return { destDir, kind: 'file', anchorPath }
        }

        const rootEl = el.closest('[data-workspace-root-drop]') as HTMLElement | null
        if (rootEl && !el.closest('.tree-node')) {
          const destDir = rootEl.getAttribute('data-workspace-root-drop') ?? normRoot
          if (destDir) return { destDir, kind: 'root' }
        }
      }
      return null
    }

    const onPointerMove = (e: PointerEvent) => {
      const session = filePointerSessionRef.current
      if (!session) return
      if (!session.active) {
        const dist = Math.hypot(e.clientX - session.x, e.clientY - session.y)
        if (dist < WORKSPACE_FILE_DRAG_THRESHOLD_PX) return
        session.active = true
        setDraggingWorkspaceFile(session.path)
      }
      const target = resolveDropTargetUnderPointer(e.clientX, e.clientY)
      setDragOverTarget(target)
      if (target?.kind === 'folder' && target.anchorPath) {
        setExpandedDirs((prev) => {
          if (pathSetHas(prev, target.anchorPath!)) return prev
          const next = new Set(prev)
          next.add(target.anchorPath!)
          return next
        })
      }
    }

    const finishPointerDrag = (e: PointerEvent) => {
      const session = filePointerSessionRef.current
      if (!session) return
      filePointerSessionRef.current = null
      if (!session.active) {
        if (suppressWorkspaceFileClickRef.current) return
        const targetPath =
          resolveWorkspaceFilePathUnderPointer(e.clientX, e.clientY) ?? session.path
        openWorkspaceFileFromSidebarRef.current(targetPath)
        return
      }
      suppressWorkspaceFileClickRef.current = true
      window.setTimeout(() => {
        suppressWorkspaceFileClickRef.current = false
      }, 100)
      const target = resolveDropTargetUnderPointer(e.clientX, e.clientY)
      if (target && isValidMoveDest(session.path, target.destDir)) {
        void handleMoveFileToFolderRef.current(session.path, target.destDir)
      } else {
        setDraggingWorkspaceFile(null)
        setDragOverTarget(null)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', finishPointerDrag)
    window.addEventListener('pointercancel', finishPointerDrag)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', finishPointerDrag)
      window.removeEventListener('pointercancel', finishPointerDrag)
    }
  }, [rootDirRef, setDragOverTarget, setDraggingWorkspaceFile, setExpandedDirs])

  useEffect(() => {
    document.body.classList.toggle('is-workspace-file-dragging', Boolean(draggingWorkspaceFile))
    return () => {
      document.body.classList.remove('is-workspace-file-dragging')
    }
  }, [draggingWorkspaceFile])

  return {
    workspaceFolderName,
    activeDocumentTitle,
    activeDocumentSubtitle,
    sortedFlatWorkspaceFiles,
    sortedFileTree,
    workspaceFolderNodes,
    sidebarSearchIndex,
    toggleWorkspaceDir,
    openWorkspaceFileFromSidebar,
    onWorkspaceFilePointerDown,
    onSidebarFileContextMenu,
    onSidebarBlankContextMenu,
  }
}
