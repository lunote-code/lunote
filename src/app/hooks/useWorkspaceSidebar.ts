import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react'

import type { TranslateFn } from '../../i18n'
import { setWikiLinkSuggestPathProvider } from '../../editor/lunaWikiLinkSuggest'
import { pathInList, pathsEqual } from '../../lib/workspacePathUtils'
import { isBufferTabId } from '../workspace/constants'
import {
  collectDirPaths,
  countFilesInTree,
  filterSidebarWorkspaceTree,
  filterWorkspaceTreeByQuery,
  flattenWorkspaceFiles,
  sortWorkspaceTree,
} from '../workspace/workspaceTree'
import {
  WORKSPACE_FILE_DRAG_THRESHOLD_PX,
  collectFolderNodes,
  isValidBulkMoveDest,
  isValidMoveDest,
  type WorkspaceDragTarget,
} from '../workspace/workspaceDrag'
import { resolveWorkspaceSidebarDropTarget } from '../workspace/workspaceSidebarDropTarget'
import {
  collectVisibleFilePathsInTree,
  computeShiftRangeSelection,
} from '../workspace/workspaceFileMultiSelect'
import type { FileSortMode, FsTreeNode } from '../workspace/types'
import type { EditorDocMenuState, FileContextMenuState } from '../workspace/contextMenuTypes'
import { deriveWindowTitleParts } from '../../platform/tauri/windowTitleModel'

export type WorkspaceSidebarDeps = {
  t: TranslateFn
  rootDir: string
  rootDirRef: MutableRefObject<string>
  activePath: string
  fileTree: FsTreeNode[]
  fileSortMode: FileSortMode
  searchText: string
  sidebarListMode: 'files' | 'outline'
  sidebarFileView: 'tree' | 'list'
  expandedDirs: Set<string>
  draggingWorkspaceFile: string[] | null
  setDraggingWorkspaceFile: Dispatch<SetStateAction<string[] | null>>
  dragOverTarget: WorkspaceDragTarget | null
  setDragOverTarget: Dispatch<SetStateAction<WorkspaceDragTarget | null>>
  setEditorDocMenu: Dispatch<SetStateAction<EditorDocMenuState | null>>
  setFileContextMenu: Dispatch<SetStateAction<FileContextMenuState | null>>
  dispatchOpenDocument: (root: string, path: string, reason?: string) => Promise<void>
  handleMoveFileToFolder: (sourcePath: string | string[], destDir: string, isDirectory?: boolean) => Promise<void>
  toggleDir: (path: string) => void
  setExpandedDirs: Dispatch<SetStateAction<Set<string>>>
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
    searchText,
    sidebarListMode,
    sidebarFileView,
    expandedDirs,
    draggingWorkspaceFile,
    setDraggingWorkspaceFile,
    setDragOverTarget,
    setEditorDocMenu,
    setFileContextMenu,
    dispatchOpenDocument,
    handleMoveFileToFolder,
    toggleDir,
    setExpandedDirs,
    tabLabel,
    setStatus,
  } = deps

  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([])
  const selectionAnchorRef = useRef<string | null>(null)
  const selectedFilePathsRef = useRef<string[]>([])
  const filePointerSessionRef = useRef<{
    path: string
    isDirectory: boolean
    bulkPaths?: string[]
    x: number
    y: number
    active: boolean
  } | null>(null)
  const suppressWorkspaceFileClickRef = useRef(false)
  const lastSidebarOpenRef = useRef<{ path: string; at: number } | null>(null)
  const handleMoveFileToFolderRef = useRef<
    (sourcePath: string | string[], destDir: string, isDirectory?: boolean) => void
  >(() => {})

  useEffect(() => {
    selectedFilePathsRef.current = selectedFilePaths
  }, [selectedFilePaths])

  const workspaceFolderName = useMemo(() => {
    if (!rootDir.trim()) return t('app.titleBar.noFolder')
    const norm = rootDir.replace(/[/\\]+$/u, '')
    const parts = norm.split(/[/\\]/u)
    return parts[parts.length - 1] || norm
  }, [rootDir, t])

  const { documentTitle: windowTitleDocument, workspaceTitle: windowTitleWorkspace } = useMemo(
    () =>
      deriveWindowTitleParts({
        activePath,
        rootDir,
        tabLabel,
        workspaceFolderName,
      }),
    [activePath, rootDir, tabLabel, workspaceFolderName],
  )

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

  const baseSortedFileTree = useMemo(
    () => filterSidebarWorkspaceTree(sortWorkspaceTree(fileTree, fileSortMode)),
    [fileTree, fileSortMode],
  )

  const filterQuery = searchText.trim()
  const isSidebarFiltering = Boolean(filterQuery)

  const sortedFileTree = useMemo(() => {
    if (!isSidebarFiltering) return baseSortedFileTree
    return filterWorkspaceTreeByQuery(baseSortedFileTree, filterQuery, rootDir)
  }, [baseSortedFileTree, filterQuery, isSidebarFiltering, rootDir])

  const filteredFlatWorkspaceFiles = useMemo(() => {
    if (!isSidebarFiltering) return sortedFlatWorkspaceFiles
    const q = filterQuery.toLowerCase()
    return sortedFlatWorkspaceFiles.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.relativePath.toLowerCase().includes(q) ||
        (f.sublabel?.toLowerCase().includes(q) ?? false),
    )
  }, [filterQuery, isSidebarFiltering, sortedFlatWorkspaceFiles])

  const sidebarFilterMatchCount = useMemo(() => {
    if (!isSidebarFiltering) return 0
    return countFilesInTree(sortedFileTree)
  }, [isSidebarFiltering, sortedFileTree])

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

  const orderedVisibleFilePaths = useMemo(() => {
    if (sidebarFileView === 'list') {
      return filteredFlatWorkspaceFiles.map((f) => f.path)
    }
    return collectVisibleFilePathsInTree(sortedFileTree, expandedDirs)
  }, [expandedDirs, filteredFlatWorkspaceFiles, sidebarFileView, sortedFileTree])

  const clearWorkspaceFileSelection = useCallback(() => {
    setSelectedFilePaths([])
    selectionAnchorRef.current = null
  }, [])

  useEffect(() => {
    clearWorkspaceFileSelection()
  }, [clearWorkspaceFileSelection, rootDir])

  /** Keep sidebar selection aligned with the active editor tab (tab bar, wikilink, etc.). */
  useEffect(() => {
    if (!activePath || isBufferTabId(activePath)) {
      clearWorkspaceFileSelection()
      return
    }
    setSelectedFilePaths([activePath])
    selectionAnchorRef.current = activePath
  }, [activePath, clearWorkspaceFileSelection])

  useEffect(() => {
    if (!isSidebarFiltering || !rootDir) return
    const dirs = collectDirPaths(sortedFileTree)
    if (dirs.length === 0) return
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      for (const d of dirs) next.add(d)
      return next
    })
  }, [isSidebarFiltering, rootDir, sortedFileTree, setExpandedDirs])

  const onWorkspaceFilePointerDown = useCallback(
    (e: ReactPointerEvent, path: string, isDirectory = false) => {
      if (!rootDir) return
      const selected = selectedFilePathsRef.current
      const bulkPaths =
        !isDirectory && pathInList(path, selected) && selected.length > 1 ? [...selected] : undefined
      filePointerSessionRef.current = { path, isDirectory, bulkPaths, x: e.clientX, y: e.clientY, active: false }
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

  handleMoveFileToFolderRef.current = handleMoveFileToFolder

  const isFilePathSelected = useCallback(
    (path: string) => selectedFilePaths.some((p) => pathsEqual(p, path)),
    [selectedFilePaths],
  )

  const handleWorkspaceFileClick = useCallback(
    (path: string, modifiers: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      if (modifiers.shiftKey && selectionAnchorRef.current) {
        const range = computeShiftRangeSelection(
          orderedVisibleFilePaths,
          selectionAnchorRef.current,
          path,
        )
        setSelectedFilePaths(range)
        return
      }
      if (modifiers.metaKey || modifiers.ctrlKey) {
        setSelectedFilePaths((prev) => {
          if (pathInList(path, prev)) {
            return prev.filter((p) => !pathsEqual(p, path))
          }
          return [...prev, path]
        })
        selectionAnchorRef.current = path
        return
      }
      setSelectedFilePaths([path])
      selectionAnchorRef.current = path
      openWorkspaceFileFromSidebar(path)
    },
    [openWorkspaceFileFromSidebar, orderedVisibleFilePaths],
  )

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
      // Keep sidebar selection on the active tab; context menu actions use `path` / `bulkDeletePaths`.
      const bulkDeletePaths =
        !isDirectory && pathInList(path, selectedFilePaths) && selectedFilePaths.length > 1
          ? [...selectedFilePaths]
          : undefined
      setFileContextMenu({ x, y, path, isDirectory, variant, bulkDeletePaths })
    },
    [selectedFilePaths, setEditorDocMenu, setFileContextMenu],
  )

  const onSidebarBlankContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      if (!rootDir) return
      if (sidebarListMode !== 'files') return
      const target = e.target as HTMLElement
      if (target.closest('.note-item, .tree-folder, .tree-file, .file-ctx-menu')) return
      onSidebarFileContextMenu(e, rootDir, true, 'blank')
    },
    [onSidebarFileContextMenu, rootDir, sidebarListMode],
  )

  useEffect(() => {
    const resolveDropTargetUnderPointer = (clientX: number, clientY: number): WorkspaceDragTarget | null =>
      resolveWorkspaceSidebarDropTarget(clientX, clientY, rootDirRef.current)

    const onPointerMove = (e: PointerEvent) => {
      const session = filePointerSessionRef.current
      if (!session) return
      if (!session.active) {
        const dist = Math.hypot(e.clientX - session.x, e.clientY - session.y)
        if (dist < WORKSPACE_FILE_DRAG_THRESHOLD_PX) return
        session.active = true
        const dragPaths = session.bulkPaths ?? [session.path]
        setDraggingWorkspaceFile(dragPaths)
      }
      const target = resolveDropTargetUnderPointer(e.clientX, e.clientY)
      const dragPaths = session.bulkPaths ?? [session.path]
      const canDrop =
        target &&
        (session.isDirectory
          ? isValidMoveDest(session.path, target.destDir)
          : isValidBulkMoveDest(dragPaths, target.destDir))
      if (canDrop) {
        setDragOverTarget(target)
      } else {
        setDragOverTarget(null)
      }
    }

    const finishPointerDrag = (e: PointerEvent) => {
      const session = filePointerSessionRef.current
      if (!session) return
      filePointerSessionRef.current = null
      if (!session.active) {
        if (suppressWorkspaceFileClickRef.current) return
        if (session.isDirectory) return
        return
      }
      suppressWorkspaceFileClickRef.current = true
      window.setTimeout(() => {
        suppressWorkspaceFileClickRef.current = false
      }, 100)
      const target = resolveDropTargetUnderPointer(e.clientX, e.clientY)
      const dragPaths = session.bulkPaths ?? [session.path]
      const canDrop =
        target &&
        (session.isDirectory
          ? isValidMoveDest(session.path, target.destDir)
          : isValidBulkMoveDest(dragPaths, target.destDir))
      if (canDrop) {
        void handleMoveFileToFolderRef.current(
          session.isDirectory ? session.path : dragPaths,
          target.destDir,
          session.isDirectory,
        )
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
  }, [rootDirRef, setDragOverTarget, setDraggingWorkspaceFile])

  useEffect(() => {
    document.body.classList.toggle('is-workspace-file-dragging', Boolean(draggingWorkspaceFile))
    return () => {
      document.body.classList.remove('is-workspace-file-dragging')
    }
  }, [draggingWorkspaceFile])

  return {
    workspaceFolderName,
    windowTitleDocument,
    windowTitleWorkspace,
    sortedFlatWorkspaceFiles: filteredFlatWorkspaceFiles,
    sortedFileTree,
    workspaceFolderNodes,
    sidebarSearchIndex,
    sidebarFilterMatchCount,
    isSidebarFiltering,
    toggleWorkspaceDir,
    openWorkspaceFileFromSidebar,
    onWorkspaceFilePointerDown,
    onSidebarFileContextMenu,
    onSidebarBlankContextMenu,
    selectedFilePaths,
    isFilePathSelected,
    handleWorkspaceFileClick,
    clearWorkspaceFileSelection,
  }
}
