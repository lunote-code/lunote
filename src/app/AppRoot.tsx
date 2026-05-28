import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import 'katex/dist/katex.min.css'
import '../App.css'
import './appMenuBar.css'
import type { AtomicVisualDocumentEnter, TiptapMarkdownEditorHandle } from '../editor/TiptapMarkdownEditor'
import { EditorOpenReason, type EditorOpenReason as EditorOpenReasonKind } from '../editor/editorOpenReason'
import { type SourceModeEnterAnchor } from '../editor/viewportModeAnchor'
import {
  createInitialModeSwitchFsmState,
  modeSwitchFsmReducer,
  type ModeSwitchAnchorPayload,
} from '../editor/modeSwitchFSM'
import { VIEWPORT_DOCUMENT_NODE_ID, viewportAnchorEngine } from '../editor/viewportAnchorEngine'
import { useSidebarOutlineHeadings } from './hooks/useSidebarOutlineHeadings'
import { canonicalMarkdownOutline } from '../markdown/canonicalMarkdownOutline'
import {
  createInitialLunaEditorSurface,
  lunaEditorSurfaceReducer,
  registerLunaSurfaceDispatch,
  unregisterLunaSurfaceDispatch,
} from '../editor/lunaEditorSurfaceState'
import { setLunaManifestCommandExecutor } from '../editor/lunaEphemeralFormatting'
import { setCmManifestCommandExecutor } from '../editor/cmManifestBridge'
import {
  filterOutPath,
  pathsEqual,
  relativePathUnderRoot,
} from '../lib/workspacePathUtils'
import { useAppStatus } from './hooks/useAppStatus'
import { useAppDialogs } from './hooks/useAppDialogs'
import { useAutoUpdateCheck } from './hooks/useAutoUpdateCheck'
import { useWorkspaceExternalSync } from './hooks/useWorkspaceExternalSync'
import { useEditorModeSwitch } from './hooks/useEditorModeSwitch'
import { useTabNavigation } from './hooks/useTabNavigation'
import { useWorkspaceLoader } from './hooks/useWorkspaceLoader'
import { useDocumentSave } from './hooks/useDocumentSave'
import { useRenameAndFileOps } from './hooks/useRenameAndFileOps'
import { useDocumentKernelEffects } from './hooks/useDocumentKernelEffects'
import { useEditorNavigationReveal } from './hooks/useEditorNavigationReveal'
import { useWorkspaceSidebar } from './hooks/useWorkspaceSidebar'
import { useSourceEditorExtensions } from './hooks/useSourceEditorExtensions'
import { useAssetHandlers } from './hooks/useAssetHandlers'
import { useEditorCommands } from './hooks/useEditorCommands'
import { useEditorDocMenu } from './hooks/useEditorDocMenu'
import {
  createInitialAppMenuContext,
  createInitialAppMenuUiDeps,
  useAppCommandHosts,
} from './hooks/useAppCommandHosts'
import { useAppMenuAndShortcuts } from './hooks/useAppMenuAndShortcuts'
import { useAppBootstrap } from './hooks/useAppBootstrap'
import { AppSidebarPanel } from './components/AppSidebarPanel'
import { AppEditorMain } from './components/AppEditorMain'
import { AppRootOverlays } from './components/AppRootOverlays'
import {
  dispatchAppMenuFromTauri,
  executeManifestCommand,
} from '../menu'
import type { AppMenuContext, AppMenuUiDeps, PaletteCommandDef } from '../menu'
import { setActiveTransactionDoc } from '../menu/commandTransaction'
import { setInputRouterDocId } from '../vm/inputRouter'
import { initEditorMutationBridge } from '../editor/editorMutationBridge'
import { useI18n } from '../i18n'
import '../editor/knowledgeOS/ui/knowledgePanels.css'
import { absolutePathToDocKeyOs } from '../editor/knowledgeOS'
import { KnowledgeRightRail } from '../editor/knowledgeOS/ui/KnowledgeRightRail'
import { KnowledgeSurfaceSplitHandle } from '../editor/knowledgeOS/ui/KnowledgeSurfaceSplitHandle'
import { useSurfaceSplitLayout } from '../editor/knowledgeOS/ui/useSurfaceSplitLayout'
import { AppMenuBar } from './AppMenuBar'
import { usesInAppMenuBar } from './shellPlatform'
import { resolveWikiLinkTargetAtCmPos } from '../editor/compiler/wikiInteractionMetadata'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigate,
  dispatchWikiHover,
} from '../editor/knowledgeOS/ui/interactionTransaction'
import { beginNavigationReveal } from '../editor/knowledgeOS/editorNavigationReadiness'
import { registerKnowledgeInteractionHost } from '../editor/knowledgeOS/ui/knowledgeInteractionHost'
import type { WikiLinkEditorHandlers } from '../editor/knowledgeOS/ui/cmWikiLinkExtension'
import { persistKnowledgeWorkspace } from '../editor/knowledgeOS/ui/knowledgeAppIntegration'
import {
  activateWorkspaceTab,
  getKnowledgeWorkspaceSnapshot,
  initKnowledgeOS,
  openNoteInWorkspace,
  setBacklinkPanelDocKey,
} from '../editor/knowledgeOS'
import type { WikiLinkTarget } from '../editor/knowledgeRuntime/types'
import { normalizeAssetStorageConfig } from '../assets/assetStoragePolicy'
import type { AssetStorageConfig } from '../assets/assetStoragePolicy'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../settings/appSettingsStore'
import { buildEditorFontFamilyCss, isEditorMonoFont } from '../settings-runtime/editorFontPresets'
import { normalizeEditorFontSize } from '../settings-runtime/editorTypography'
import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  subscribeDocumentRuntime,
} from '../documentRuntime/documentKernel'
import { subscribeThemeRuntime } from '../theme-runtime/themeRuntime'
import {
  APP_DISPLAY_NAME,
  LARGE_DOC_THRESHOLD,
  isBufferTabId,
} from './workspace/constants'
import type {
  FileSortMode,
  RenameDialogState,
  SearchResult,
} from './workspace/types'
import type { WorkspaceDragTarget } from './workspace/workspaceDrag'
import type { EditorDocMenuState, FileContextMenuState } from './workspace/contextMenuTypes'
import type { SaveConflictState } from './document/saveConflictState'
function App() {
  const { t, paletteCommands: compiledPaletteCommands, toolbarSidebar } = useI18n()
  const inAppMenuBar = useMemo(() => usesInAppMenuBar(), [])

  const onAppMenuBarAction = useCallback((action: string) => {
    requestAnimationFrame(() => {
      void executeManifestCommand(action, appMenuCtxRef.current, paletteUiDepsRef.current)
    })
  }, [])

  const onAppMenuBarOpenRecent = useCallback((path: string) => {
    void dispatchAppMenuFromTauri(
      () => appMenuCtxRef.current,
      { action: 'open-recent', path },
      paletteUiDepsRef.current,
    )
  }, [])
  const tRef = useRef(t)
  tRef.current = t
  const documentSnapshot = useSyncExternalStore(
    subscribeDocumentRuntime,
    getDocumentRuntimeSnapshot,
    getDocumentRuntimeSnapshot,
  )
  const activePath = documentSnapshot.activePath
  const content = documentSnapshot.content
  /** Updated synchronously with setState for navigation reveal to read the target document before commit*/
  const activePathRef = useRef(activePath)
  const contentRef = useRef(content)
  activePathRef.current = activePath
  contentRef.current = content
  const [savedAt, setSavedAt] = useState('')
  const { status, setStatus } = useAppStatus()
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? Number(saved) : 310
  })
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const saved = localStorage.getItem('sidebarVisible')
    return saved ? saved === '1' : true
  })
  const [sidebarFileView, setSidebarFileView] = useState<'tree' | 'list'>(() => {
    const saved = localStorage.getItem('sidebarFileView')
    return saved === 'list' ? 'list' : 'tree'
  })
  const [sidebarListMode, setSidebarListMode] = useState<'files' | 'outline'>(() => {
    const saved = localStorage.getItem('sidebarListMode')
    return saved === 'outline' ? 'outline' : 'files'
  })
  const openGlobalSearchModal = useCallback(() => {
    setGlobalSearchQuery('')
    setGlobalSearchOpen(true)
  }, [])
  const openKnowledgeSearchModal = useCallback(() => {
    setKnowledgeSearchQuery('')
    setKnowledgeSearchOpen(true)
  }, [])
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null)
  const fileContextMenuRef = useRef<HTMLDivElement | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<WorkspaceDragTarget | null>(null)
  const [draggingWorkspaceFile, setDraggingWorkspaceFile] = useState<string | null>(null)
  const rootDirRef = useRef('')
  const [editorDocMenu, setEditorDocMenu] = useState<EditorDocMenuState | null>(null)
  const editorDocMenuRef = useRef<HTMLDivElement | null>(null)
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; path: string; index: number; total: number } | null>(null)
  const tabContextMenuRef = useRef<HTMLDivElement | null>(null)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)
  const [workspaceMenuPopStyle, setWorkspaceMenuPopStyle] = useState<CSSProperties | null>(null)
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>(() => {
    const saved = localStorage.getItem('fileSortMode')
    if (saved === 'group' || saved === 'naturalAsc' || saved === 'nameAsc' || saved === 'modifiedAsc' || saved === 'createdAsc') return saved
    return 'group'
  })
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null)
  const {
    deleteConfirmDialog,
    confirmDialog,
    unsavedDialog,
    alertDialog,
    confirmAppDialog,
    confirmDeleteFile,
    closeDeleteConfirmDialog,
    closeConfirmDialog,
    promptUnsavedChanges,
    closeUnsavedDialog,
    showAppAlert,
    closeAlertDialog,
  } = useAppDialogs(t)

  useAutoUpdateCheck(confirmAppDialog, t)

  const [renameInputValue, setRenameInputValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [renameSubmitting, setRenameSubmitting] = useState(false)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  /** Main editing area: What you see is what you get (FSM `pane: render`) or source code (`pane: source`); `mainPaneMode` names the compatibility layer*/
  const [editorSurface, dispatchEditorSurface] = useReducer(
    lunaEditorSurfaceReducer,
    undefined,
    createInitialLunaEditorSurface,
  )
  const mainPaneMode: 'visual' | 'source' = editorSurface.pane === 'render' ? 'visual' : 'source'
  const mainPaneModeRef = useRef(mainPaneMode)
  mainPaneModeRef.current = mainPaneMode
  const setMainPaneMode = useCallback((mode: 'visual' | 'source') => {
    dispatchEditorSurface({ type: 'SET_PANE', pane: mode === 'visual' ? 'render' : 'source' })
  }, [])
  const [modeSwitchFsm, dispatchModeSwitchFsm] = useReducer(
    modeSwitchFsmReducer,
    undefined,
    () => createInitialModeSwitchFsmState('visual'),
  )
  const onModeSwitchAnchorPayload = useCallback((payload: ModeSwitchAnchorPayload | null) => {
    dispatchModeSwitchFsm({ type: 'ANCHOR_READY', pendingAnchor: payload })
  }, [])
  const onModeSwitchEnhancementFailed = useCallback((error: unknown) => {
    dispatchModeSwitchFsm({ type: 'ENHANCEMENT_FAILED', error })
  }, [])
  const onModeSwitchApplyingAnchor = useCallback(() => {
    dispatchModeSwitchFsm({ type: 'APPLYING_ANCHOR' })
  }, [])
  const [focusMode, setFocusMode] = useState(() => {
    const saved = localStorage.getItem('focusMode')
    return saved ? saved === '1' : false
  })
  const [statusbarVisible, setStatusbarVisible] = useState(() => {
    const saved = localStorage.getItem('statusbarVisible')
    return saved ? saved === '1' : true
  })
  /** When the cursor is in the text/source code editing area, the top bar and footer are weakened, close to the Typora writing state*/
  const [editorBodyFocused, setEditorBodyFocused] = useState(false)
  const [isDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })
  const [aboutOpen, setAboutOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('')
  const [commandPaletteIndex, setCommandPaletteIndex] = useState(0)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [knowledgeSearchOpen, setKnowledgeSearchOpen] = useState(false)
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState('')
  const [knowledgeRailVisible, setKnowledgeRailVisible] = useState(() => {
    const saved = localStorage.getItem('knowledgeRailVisible')
    return saved ? saved === '1' : true
  })
  const [wikiHoverId, setWikiHoverId] = useState<string | null>(null)
  const wikiHoverIdRef = useRef<string | null>(null)
  const wikiHandlersRef = useRef<WikiLinkEditorHandlers | null>(null)
  const wikiTargetResolverRef = useRef<((pos: number) => WikiLinkTarget | null) | null>(null)
  const paletteCommandDefs = useMemo((): PaletteCommandDef[] => compiledPaletteCommands, [compiledPaletteCommands])
  const setActiveOutlineIdRef = useRef<(id: string) => void>(() => {})
  const [activeOutlineId, setActiveOutlineId] = useState('')
  const openedTabs = documentSnapshot.openedTabs
  const [bufferTabLabels, setBufferTabLabels] = useState<Record<string, string>>({})
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recentFiles') ?? '[]') as string[]
    } catch {
      return []
    }
  })

  const updateRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const merged = [path, ...filterOutPath(prev, path)].slice(0, 8)
      localStorage.setItem('recentFiles', JSON.stringify(merged))
      return merged
    })
  }, [])

  useEffect(() => {
    registerLunaSurfaceDispatch(dispatchEditorSurface)
    return unregisterLunaSurfaceDispatch
  }, [dispatchEditorSurface])

  useEffect(() => {
    initKnowledgeOS()
  }, [])

  const mainWithRailRef = useRef<HTMLElement | null>(null)

  const isLargeDoc = content.length >= LARGE_DOC_THRESHOLD
  const performanceMode = isLargeDoc || focusMode

  const outlineHeadings = useSidebarOutlineHeadings(activePath, content)

  const contentStats = useMemo(() => {
    const plain = content.replace(/\s+/g, '')
    const headings = (content.match(/^#{1,6}\s+/gm) || []).length
    return {
      chars: plain.length,
      lines: content.split('\n').length,
      headings,
    }
  }, [content])

  const panesRef = useRef<HTMLElement | null>(null)
  const outlineSpyCtxRef = useRef({ sidebarListMode: 'files' as 'files' | 'outline' })
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null)
  const createNewNoteRef = useRef<() => Promise<void>>(async () => {})
  const bufferBodiesRef = useRef<Record<string, string>>({})
  /** The cached text when switching tabs (synchronized with kernel events, see tabBodiesStore)*/
  /** mtime+size of the opened disk file, used to detect external changes*/
  const fileStatRef = useRef<Record<string, { modifiedSecs: number; size: number }>>({})
  const leaveCurrentTabRef = useRef<(() => Promise<boolean>) | null>(null)
  const saveAllDirtyDocumentsRef = useRef<() => Promise<boolean>>(async () => true)
  const flushEditorToMemoryRef = useRef<() => Promise<boolean>>(async () => true)
  const sessionGuardRef = useRef({ activePath: '', content: '', openedTabs: [] as string[] })
  const editorViewRef = useRef<EditorView | null>(null)
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const modeToggleRetryCountRef = useRef(0)
  /**⌘/ prohibits PM serialization from writing back React content (avoiding \\ escape overlay)*/
  const suppressMarkdownSerdeRef = useRef(false)
  /** Command+/ Enter source code: PM side selection + viewport anchor point (one consumption)*/
  const pendingSourceModeAnchorRef = useRef<SourceModeEnterAnchor | null>(null)
  /** Source code mode: only written when Visual→Source, for selection of a single EditorState.create; cleared when opening the file*/
  const sourceCodeMirrorBootSelectionRef = useRef<{
    from: number
    to: number
    scrollTop?: number
    scrollRatio?: number
  } | null>(null)
  /** It only increments when Visual→Source (⌘/) is separated from coldOpenGeneration to avoid sharing the mount generation between cold open and mode switching.*/
  const [sourceCodeMirrorInstanceKey, setSourceCodeMirrorInstanceKey] = useState(0)
  /** Cold open path increment: dispatchOpenDocument / loadTabContent / revert / empty workspace; participate in CM mountKey, force new scroll container*/
  const [coldOpenGeneration, setColdOpenGeneration] = useState(0)
  const bumpColdOpenGeneration = useCallback(() => {
    setColdOpenGeneration((n) => n + 1)
  }, [])
  /** Tag switching generation: discard expired leaveCurrentTab + loadTabContent*/
  const tabNavGenerationRef = useRef(0)
  const externalReloadGenerationRef = useRef(0)
  /** Inactive dirty tags are recorded when external changes are made and prompted when switching back to the tag.*/
  const [externalDiskChangedPaths, setExternalDiskChangedPaths] = useState<Set<string>>(() => new Set())
  const [saveConflict, setSaveConflict] = useState<SaveConflictState | null>(null)
  /** This application briefly ignores the workspace-changed storm after writing to disk.*/
  const suppressWorkspaceRefreshUntilRef = useRef(0)
  const kernelContentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [atomicVisualDocumentEnter, setAtomicVisualDocumentEnter] = useState<AtomicVisualDocumentEnter | null>(null)
  const [editorOpenReason, setEditorOpenReason] = useState<EditorOpenReasonKind>(EditorOpenReason.ColdOpen)
  const [assetStorageConfig, setAssetStorageConfigState] = useState<AssetStorageConfig>(() =>
    normalizeAssetStorageConfig(getAppSettingsSnapshot().assetStorage),
  )
  const [editorTypography, setEditorTypography] = useState(() => {
    const editor = getAppSettingsSnapshot().appearance?.editor
    return {
      fontFamily: editor?.fontFamily ?? '',
      fontSize: normalizeEditorFontSize(editor?.fontSize),
    }
  })

  useEffect(() => {
    return subscribeAppSettings(() => {
      const snapshot = getAppSettingsSnapshot()
      const editor = snapshot.appearance?.editor
      setAssetStorageConfigState(normalizeAssetStorageConfig(snapshot.assetStorage))
      setEditorTypography({
        fontFamily: editor?.fontFamily ?? '',
        fontSize: normalizeEditorFontSize(editor?.fontSize),
      })
    })
  }, [])

  const editorSurfaceStyle = useMemo(() => {
    const style: Record<string, string> = {}
    const family = editorTypography.fontFamily.trim()
    const cssFamily = buildEditorFontFamilyCss(family)
    if (cssFamily) {
      style['--editor-content-font-family'] = cssFamily
      if (isEditorMonoFont(family)) {
        style['--font-mono'] = cssFamily
      }
    }
    if (typeof editorTypography.fontSize === 'number') {
      const px = `${editorTypography.fontSize}px`
      style['--editor-content-font-size'] = px
      style.fontSize = px
    }
    return style as CSSProperties
  }, [editorTypography.fontFamily, editorTypography.fontSize])

  useEffect(() => {
    editorViewRef.current?.requestMeasure()
  }, [editorTypography.fontSize, editorTypography.fontFamily])

  const logModeSwitchState = useCallback((_phase: string) => {}, [])

  const cmMountKey = useMemo(
    () => `cm:${activePath || 'scratch'}:${coldOpenGeneration}:${sourceCodeMirrorInstanceKey}`,
    [activePath, coldOpenGeneration, sourceCodeMirrorInstanceKey],
  )
  const visualMountKey = useMemo(
    () => `visual:${activePath || 'scratch'}:${coldOpenGeneration}`,
    [activePath, coldOpenGeneration],
  )

  const onAtomicVisualDocumentEnterConsumed = useCallback(() => {
    setAtomicVisualDocumentEnter(null)
  }, [])

  const resetModeSwitchEditorBootstrap = useCallback(() => {
    logModeSwitchState('resetModeSwitchEditorBootstrap')
    pendingSourceModeAnchorRef.current = null
    setAtomicVisualDocumentEnter(null)
    sourceCodeMirrorBootSelectionRef.current = null
    setEditorOpenReason(EditorOpenReason.ColdOpen)
    dispatchModeSwitchFsm({ type: 'CLEAR_MODE_SWITCH_PAYLOAD' })
  }, [dispatchModeSwitchFsm, logModeSwitchState])
  const {
    rootDir,
    setRootDir,
    fileTree,
    setFileTree,
    expandedDirs,
    setExpandedDirs,
    loadNotes,
    refreshFileTree,
    chooseFolder,
    closeWorkspace,
    toggleDir,
    workspaceRestoringRef,
    pendingRestoreEventIdRef,
  } = useWorkspaceLoader({
    t,
    activePath,
    content,
    openedTabs,
    confirmAppDialog,
    bufferBodiesRef,
    setBufferTabLabels,
    fileStatRef,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    setStatus,
  })

  rootDirRef.current = rootDir

  const activeDocKey = useMemo(() => {
    if (!rootDir || !activePath || isBufferTabId(activePath)) return null
    return absolutePathToDocKeyOs(activePath, rootDir)
  }, [rootDir, activePath])

  useEffect(() => {
    setBacklinkPanelDocKey(activeDocKey)
  }, [activeDocKey])

  const knowledgeRailOpen = Boolean(rootDir && !focusMode && knowledgeRailVisible)
  const surfaceSplit = useSurfaceSplitLayout(mainWithRailRef, knowledgeRailOpen)

  const syncWikiHoverId = useCallback((id: string | null) => {
    wikiHoverIdRef.current = id
    setWikiHoverId(id)
  }, [])

  const handleWikiHover = useCallback(
    (target: WikiLinkTarget | null, pos: { x: number; y: number }) => {
      dispatchWikiHover(target, pos)
    },
    [],
  )

  const tabLabel = useCallback(
    (path: string) => {
      if (isBufferTabId(path)) return bufferTabLabels[path] || t('app.tab.unnamed')
      const rel = relativePathUnderRoot(rootDir, path)
      if (rel === null) return path.replace(/\\/g, '/').split('/').pop() ?? path
      return rel
    },
    [rootDir, bufferTabLabels, t],
  )

  useWorkspaceExternalSync({
    rootDir,
    t,
    tabLabel,
    setStatus,
    setExternalDiskChangedPaths,
    refreshFileTree,
    confirmAppDialog,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    fileStatRef,
    externalReloadGenerationRef,
    suppressWorkspaceRefreshUntilRef,
    workspaceRestoringRef,
  })

  /** Menu listen is only registered once, and ref is used to read the latest callback to avoid dependency changes / HMR superimposes multiple listeners, causing the format command to be executed multiple times*/
  const appMenuCtxRef = useRef<AppMenuContext>(createInitialAppMenuContext())

  const paletteUiDepsRef = useRef<AppMenuUiDeps>(createInitialAppMenuUiDeps())

  useEffect(() => {
    setActiveOutlineIdRef.current = (id) => setActiveOutlineId((p) => (p === id ? p : id))
  }, [])

  useEffect(() => {
    if (!fileContextMenu) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      if (fileContextMenuRef.current?.contains(e.target as Node)) return
      setFileContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFileContextMenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [fileContextMenu])

  useEffect(() => {
    if (!editorDocMenu) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      if (editorDocMenuRef.current?.contains(e.target as Node)) return
      setEditorDocMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditorDocMenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [editorDocMenu])

  useEffect(() => {
    if (!tabContextMenu) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      if (tabContextMenuRef.current?.contains(e.target as Node)) return
      setTabContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTabContextMenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [tabContextMenu])

  useEffect(() => {
    if (!workspaceMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (workspaceMenuRef.current?.contains(e.target as Node)) return
      setWorkspaceMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWorkspaceMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [workspaceMenuOpen])

  const placeWorkspaceMenu = useCallback(() => {
    const wrap = workspaceMenuRef.current
    const pop = workspaceMenuPopRef.current
    if (!wrap || !pop) return
    const pad = 8
    const br = wrap.getBoundingClientRect()
    const w = Math.min(Math.max(pop.offsetWidth, 200), window.innerWidth - 2 * pad)
    const h = pop.offsetHeight || 1
    let left = br.left + br.width / 2 - w / 2
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad))
    let top = br.top - h - 8
    if (top < pad) top = br.bottom + 8
    const roomBelow = window.innerHeight - top - pad
    const maxHeight = h > roomBelow ? roomBelow : undefined
    setWorkspaceMenuPopStyle({
      position: 'fixed',
      left,
      top,
      width: w,
      visibility: 'visible',
      maxHeight: maxHeight,
      overflowY: maxHeight ? 'auto' : undefined,
    })
  }, [])

  useLayoutEffect(() => {
    if (!workspaceMenuOpen || !rootDir) {
      setWorkspaceMenuPopStyle(null)
      return
    }
    let cancelled = false
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!cancelled) placeWorkspaceMenu()
      })
    })
    return () => {
      cancelled = true
    }
  }, [workspaceMenuOpen, rootDir, placeWorkspaceMenu, sidebarWidth, fileSortMode, sidebarVisible])

  useEffect(() => {
    if (!workspaceMenuOpen || !rootDir) return
    const onResize = () => placeWorkspaceMenu()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [workspaceMenuOpen, rootDir, placeWorkspaceMenu])

  useEffect(() => {
    if (!renameDialog) return
    requestAnimationFrame(() => {
      const input = renameInputRef.current
      if (!input) return
      input.focus()
      if (renameDialog.mode === 'newFolder' || renameDialog.mode === 'newNote') input.select()
    })
  }, [renameDialog])

  const { isVisualEditorBoundToActivePath, toggleMainPaneMode, handleSourceViewReady } = useEditorModeSwitch({
    mainPaneMode,
    modeSwitchFsm,
    activePath,
    refs: {
      activePathRef,
      contentRef,
      visualEditorRef,
      editorViewRef,
      mainPaneModeRef,
      pendingSourceModeAnchorRef,
      sourceCodeMirrorBootSelectionRef,
      suppressMarkdownSerdeRef,
      modeToggleRetryCountRef,
    },
    setters: {
      setMainPaneMode,
      setAtomicVisualDocumentEnter,
      setSourceCodeMirrorInstanceKey,
      setEditorOpenReason,
      dispatchModeSwitchFsm,
    },
    onModeSwitchAnchorPayload,
    onModeSwitchEnhancementFailed,
    onModeSwitchApplyingAnchor,
    logModeSwitchState,
  })

  const { saveCurrent, saveAsCurrent, runAppExportFormat } = useDocumentSave({
    t,
    activePath,
    content,
    rootDir,
    mainPaneMode,
    isDark,
    bufferTabLabels,
    setBufferTabLabels,
    assetStorageConfig,
    activePathRef,
    contentRef,
    visualEditorRef,
    suppressMarkdownSerdeRef,
    suppressWorkspaceRefreshUntilRef,
    isVisualEditorBoundToActivePath,
    setSavedAt,
    setSaveConflict,
    setStatus,
    refreshFileTree,
    updateRecent,
    resetModeSwitchEditorBootstrap,
  })

  const {
    pasteImageHandlerRef,
    pasteImageIntoVisualEditor,
    pickAndImportLunaAsset,
    importDroppedAssets,
    importDroppedAssetLinks,
    handleLunaAssetLinkClick,
    getLunaAssetTooltip,
  } = useAssetHandlers({
    t,
    rootDir,
    activePath,
    assetStorageConfig,
    activePathRef,
    contentRef,
    setStatus,
  })

  const { editorExtensions, toggleSidebarListOutline } = useSourceEditorExtensions({
    isLargeDoc,
    sidebarListMode,
    setSidebarListMode,
    outlineSpyCtxRef,
    setActiveOutlineIdRef,
    setActiveOutlineId,
    wikiHandlersRef,
    wikiTargetResolverRef,
    pasteImageHandlerRef,
    editorViewRef,
  })

  const {
    focusActiveEditor,
    openFindPanel,
    findNextInDocument,
    findPreviousInDocument,
    copySelectionAs,
    cutSelectionToClipboard,
    pastePlainFromClipboard,
    insertImagesFromPicker,
    handleEditorContentChange,
    cancelPendingKernelContentDebounce,
  } = useEditorCommands({
    t,
    mainPaneMode,
    mainPaneModeRef,
    activePathRef,
    contentRef,
    visualEditorRef,
    editorViewRef,
    kernelContentDebounceRef,
    pasteImageIntoVisualEditor,
    setStatus,
  })

  useDocumentKernelEffects({
    rootDir,
    fileStatRef,
    activePathRef,
    contentRef,
    focusActiveEditor,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    updateRecent,
    logModeSwitchState,
    setStatus,
    t,
  })

  const dispatchOpenDocument = useCallback(async (root: string, path: string): Promise<void> => {
    const target = path.trim()
    const current = activePathRef.current.trim()
    if (
      target &&
      !pathsEqual(target, current) &&
      !workspaceRestoringRef.current
    ) {
      const left = await leaveCurrentTabRef.current?.()
      if (left === false) return
    }
    await dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT',
      root,
      path,
      source: 'dispatchOpenDocument-adapter',
    })
  }, [])

  const {
    openRenameDialog,
    openNewNoteDialog,
    submitRename,
    handleFileContextPick,
    handleMoveFileToFolder,
  } = useRenameAndFileOps({
    t,
    rootDir,
    activePath,
    openedTabs,
    renameDialog,
    renameInputValue,
    setRenameDialog,
    setRenameInputValue,
    setRenameError,
    setRenameSubmitting,
    setFileContextMenu,
    setEditorDocMenu,
    setRecentFiles,
    setFileTree,
    setExpandedDirs,
    setDraggingWorkspaceFile,
    setDragOverTarget,
    dispatchOpenDocument,
    refreshFileTree,
    confirmDeleteFile,
    resetModeSwitchEditorBootstrap,
    setStatus,
  })

  const { scrollPreviewToHeading, revealNavigationAnchor, revealNavigationAnchorAfterOpen } =
    useEditorNavigationReveal({
      mainPaneMode,
      activePathRef,
      contentRef,
      mainPaneModeRef,
      visualEditorRef,
      editorViewRef,
    })

  const {
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
  } = useWorkspaceSidebar({
    t,
    rootDir,
    rootDirRef,
    activePath,
    fileTree,
    fileSortMode,
    expandedDirs,
    setExpandedDirs,
    searchText,
    setSearchResults,
    sidebarListMode,
    draggingWorkspaceFile,
    setDraggingWorkspaceFile,
    dragOverTarget,
    setDragOverTarget,
    setEditorDocMenu,
    setFileContextMenu,
    searchResults,
    dispatchOpenDocument,
    handleMoveFileToFolder,
    toggleDir,
    tabLabel,
    setStatus,
  })




  const {
    saveAllOpenTabs,
    scratchNewDocument,
    scratchNewTab,
    dispatchOpenDocumentInTab,
    closeTab,
    onTabContextMenu,
    handleTabContextPick,
    activateTab,
  } = useTabNavigation({
    t,
    rootDir,
    activePath,
    openedTabs,
    mainPaneMode,
    externalDiskChangedPaths,
    setExternalDiskChangedPaths,
    setSaveConflict,
    setSavedAt,
    setStatus,
    setBufferTabLabels,
    setTabContextMenu,
    setFileContextMenu,
    setEditorDocMenu,
    activePathRef,
    contentRef,
    visualEditorRef,
    editorViewRef,
    sourceCodeMirrorBootSelectionRef,
    setAtomicVisualDocumentEnter,
    setEditorOpenReason,
    bufferBodiesRef,
    tabNavGenerationRef,
    suppressWorkspaceRefreshUntilRef,
    saveAllDirtyDocumentsRef,
    leaveCurrentTabRef,
    flushEditorToMemoryRef,
    saveCurrent,
    confirmAppDialog,
    promptUnsavedChanges,
    dispatchOpenDocument,
    focusActiveEditor,
    resetModeSwitchEditorBootstrap,
    logModeSwitchState,
    bumpColdOpenGeneration,
    beginNavigationReveal,
    revealNavigationAnchorAfterOpen,
    cancelPendingKernelContentDebounce,
  })

  const createNewNote = useCallback(async () => {
    if (!rootDir) {
      await scratchNewDocument()
      return
    }
    openNewNoteDialog(rootDir, rootDir)
  }, [rootDir, scratchNewDocument, openNewNoteDialog])

  useLayoutEffect(() => {
    createNewNoteRef.current = createNewNote
  }, [createNewNote])

  const { editorDiskFileReady, editorCanRevealInOs, handleEditorTextColorPick, handleEditorDocMenuPick } =
    useEditorDocMenu({
      t,
      rootDir,
      activePath,
      mainPaneMode,
      mainPaneModeRef,
      visualEditorRef,
      editorViewRef,
      appMenuCtxRef,
      paletteUiDepsRef,
      setEditorDocMenu,
      setStatus,
      pasteImageIntoVisualEditor,
      pastePlainFromClipboard,
      saveCurrent,
      openRenameDialog,
      dispatchOpenDocumentInTab,
      resetModeSwitchEditorBootstrap,
      bumpColdOpenGeneration,
      confirmAppDialog,
    })

  useAppCommandHosts({
    appMenuCtxRef,
    paletteUiDepsRef,
    t,
    rootDir,
    activePath,
    content,
    recentFiles,
    setRootDir,
    loadNotes,
    chooseFolder,
    closeWorkspace,
    saveCurrent,
    saveAsCurrent,
    saveAllOpenTabs,
    refreshFileTree,
    setFileTree,
    setExpandedDirs,
    setStatus,
    updateRecent,
    setRecentFiles,
    openRenameDialog,
    openNewNoteDialog,
    confirmDeleteFile,
    confirmAppDialog,
    showAppAlert,
    runAppExportFormat,
    scratchNewDocument,
    scratchNewTab,
    toggleMainPaneMode,
    openFindPanel,
    findNextInDocument,
    findPreviousInDocument,
    copySelectionAs,
    cutSelectionToClipboard,
    pastePlainFromClipboard,
    insertImagesFromPicker,
    mainPaneMode,
    setMainPaneMode,
    setFocusMode,
    setSidebarVisible,
    setSidebarListMode,
    sidebarVisible,
    sidebarListMode,
    openGlobalSearchModal,
    setStatusbarVisible,
    setAboutOpen,
    setCommandPaletteOpen,
    setCommandPaletteQuery,
    setCommandPaletteIndex,
    pendingSourceModeAnchorRef,
    resetModeSwitchEditorBootstrap,
    closeTab,
  })

  const { paletteFiltered, runPaletteCommand } = useAppMenuAndShortcuts({
    recentFiles,
    saveCurrent,
    saveAsCurrent,
    toggleMainPaneMode,
    pastePlainFromClipboard,
    setFocusMode,
    globalSearchOpen,
    setAboutOpen,
    aboutOpen,
    closeTab,
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandPaletteQuery,
    setCommandPaletteQuery,
    commandPaletteIndex,
    setCommandPaletteIndex,
    commandPaletteInputRef,
    paletteCommandDefs,
    activePathRef,
    appMenuCtxRef,
    paletteUiDepsRef,
  })

  useAppBootstrap({
    tRef,
    rootDir,
    setRootDir,
    loadNotes,
    workspaceRestoringRef,
    pendingRestoreEventIdRef,
    setStatus,
    mainPaneModeRef,
    visualEditorRef,
    sessionGuardRef,
    activePathRef,
    contentRef,
    bufferBodiesRef,
    saveAllDirtyDocumentsRef,
    promptUnsavedChanges,
  })


  const clearEditorSelectionForNavigation = useCallback(() => {
    if (mainPaneMode === 'visual') {
      visualEditorRef.current?.collapseSelectionForNavigation()
      return
    }
    const v = editorViewRef.current
    if (!v) return
    const head = v.state.selection.main.head
    v.dispatch({ selection: EditorSelection.cursor(head) })
  }, [mainPaneMode])

  useEffect(() => {
    registerKnowledgeInteractionHost({
      getRootDir: () => rootDir,
      openAbsolutePath: (absolutePath) => {
        if (!rootDir) return
        void dispatchOpenDocumentInTab(rootDir, absolutePath)
      },
      clearEditorSelection: clearEditorSelectionForNavigation,
      focusEditor: focusActiveEditor,
      onHoverIdChange: syncWikiHoverId,
      openSearchModal: openKnowledgeSearchModal,
      revealNavigationAnchor,
    })
    return () => registerKnowledgeInteractionHost(null)
  }, [
    rootDir,
    dispatchOpenDocumentInTab,
    clearEditorSelectionForNavigation,
    focusActiveEditor,
    syncWikiHoverId,
    revealNavigationAnchor,
    openKnowledgeSearchModal,
  ])

  useEffect(() => subscribeThemeRuntime(), [])

  // Initialize EditorMutationBridge — must run before any command executes.
  // The bridge holds React refs (not values), so it always sees the latest editor
  // instance without needing to be re-called on every render.
  useEffect(() => {
    initEditorMutationBridge(visualEditorRef, editorViewRef, mainPaneModeRef)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wire manifest command executor into Tiptap and CM bridges
  useEffect(() => {
    const exec = async (commandId: string) => {
      await executeManifestCommand(commandId, appMenuCtxRef.current!, paletteUiDepsRef.current!)
    }
    setLunaManifestCommandExecutor(exec)
    setCmManifestCommandExecutor(exec)
    // InputRouter dispatches VMCommands directly through vmReduce → applyVMSteps
    // No external executor injection needed — the pipeline is self-contained
    return () => {
      setLunaManifestCommandExecutor(null)
      setCmManifestCommandExecutor(null)
    }
  }, [])

  // Notify Transaction VM and InputRouter when active document changes (document-scoped log)
  useEffect(() => {
    const docId = activePath ?? ''
    setActiveTransactionDoc(docId)
    setInputRouterDocId(docId)
  }, [activePath])

  useEffect(() => {
    localStorage.setItem('sidebarVisible', sidebarVisible ? '1' : '0')
  }, [sidebarVisible])

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    localStorage.setItem('sidebarFileView', sidebarFileView)
  }, [sidebarFileView])

  useEffect(() => {
    localStorage.setItem('fileSortMode', fileSortMode)
  }, [fileSortMode])

  useEffect(() => {
    localStorage.setItem('sidebarListMode', sidebarListMode)
  }, [sidebarListMode])

  useEffect(() => {
    outlineSpyCtxRef.current = { sidebarListMode }
  }, [sidebarListMode])

  useEffect(() => {
    if (mainPaneMode === 'source') return
    viewportAnchorEngine.unregisterSourceNode(VIEWPORT_DOCUMENT_NODE_ID)
  }, [mainPaneMode])

  /** When the sidebar is "Outline Only", outline highlighting is synchronized according to the cursor (one frame is added when switching modes/sidebar)*/
  useEffect(() => {
    if (sidebarListMode !== 'outline') return
    if (mainPaneMode === 'visual') return
    requestAnimationFrame(() => {
      const v = editorViewRef.current
      if (!v) return
      const id = canonicalMarkdownOutline.activeHeadingIdBeforeOffset(
        v.state.doc.toString(),
        v.state.selection.main.head,
      )
      setActiveOutlineId((p) => (p === id ? p : id))
    })
  }, [sidebarListMode, mainPaneMode])

  useEffect(() => {
    if (mainPaneMode === 'visual') {
      editorViewRef.current = null
    }
  }, [mainPaneMode])

  useEffect(() => {
    localStorage.setItem('focusMode', focusMode ? '1' : '0')
  }, [focusMode])

  useEffect(() => {
    localStorage.setItem('statusbarVisible', statusbarVisible ? '1' : '0')
  }, [statusbarVisible])

  useEffect(() => {
    sessionGuardRef.current = { activePath, content, openedTabs }
  }, [activePath, content, openedTabs])



  useEffect(() => {
    if (!rootDir || workspaceRestoringRef.current) return
    for (const p of openedTabs) {
      if (!isBufferTabId(p)) {
        openNoteInWorkspace(p, absolutePathToDocKeyOs(p, rootDir))
      }
    }
    const ws = getKnowledgeWorkspaceSnapshot()
    const match = ws.tabs.find((t) => pathsEqual(t.absolutePath, activePath))
    if (match) activateWorkspaceTab(match.id)
    persistKnowledgeWorkspace(rootDir)
  }, [rootDir, openedTabs, activePath, knowledgeRailVisible])

  useEffect(() => {
    localStorage.setItem('knowledgeRailVisible', knowledgeRailVisible ? '1' : '0')
  }, [knowledgeRailVisible])








  const onWikiLinkNavigate = useCallback((target: unknown) => {
    dispatchKnowledgeNavigate('editor', asMetadataResolvedTarget(target as WikiLinkTarget, 'compiler'))
  }, [])

  useEffect(() => {
    wikiHandlersRef.current = {
      onNavigate: (target) =>
        dispatchKnowledgeNavigate('editor', asMetadataResolvedTarget(target, 'compiler')),
      onHover: handleWikiHover,
    }
  }, [handleWikiHover])

  useEffect(() => {
    wikiTargetResolverRef.current = (pos: number) => {
      if (!rootDir || !activePath) return null
      const hit = resolveWikiLinkTargetAtCmPos(pos, { rootDir, activePath })
      return hit?.target ?? null
    }
  }, [activePath, rootDir])

  const refreshActiveEditorAfterPathReload = useCallback(
    (path: string) => {
      if (!pathsEqual(path, activePathRef.current)) return
      resetModeSwitchEditorBootstrap()
      bumpColdOpenGeneration()
      focusActiveEditor()
    },
    [resetModeSwitchEditorBootstrap, bumpColdOpenGeneration, focusActiveEditor],
  )

  const onSaveConflictCancel = useCallback(() => setSaveConflict(null), [])

  const onSaveConflictUseDisk = useCallback(() => {
    void (async () => {
      const conflict = saveConflict
      if (!conflict || !rootDir) return
      setSaveConflict(null)
      await dispatchDocumentCommand({
        type: 'REVERT_DOCUMENT',
        root: rootDir,
        path: conflict.path,
        source: 'save-conflict-disk',
      })
      refreshActiveEditorAfterPathReload(conflict.path)
      setStatus(t('app.menu.revertedFromDisk'))
    })()
  }, [saveConflict, rootDir, refreshActiveEditorAfterPathReload, setStatus, t])

  const onSaveConflictKeepLocal = useCallback(() => {
    void (async () => {
      const conflict = saveConflict
      if (!conflict || !rootDir) return
      setSaveConflict(null)
      try {
        await dispatchDocumentCommand({
          type: 'SAVE_DOCUMENT',
          root: rootDir,
          path: conflict.path,
          content: conflict.local,
          source: 'save-conflict-force',
          forceOverwrite: true,
        })
        suppressWorkspaceRefreshUntilRef.current = Date.now() + 2500
        setSavedAt(new Date().toLocaleTimeString())
        refreshActiveEditorAfterPathReload(conflict.path)
        setStatus(t('app.status.saved'))
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        setStatus(t('app.status.saveFailed', { message }))
      }
    })()
  }, [saveConflict, rootDir, refreshActiveEditorAfterPathReload, setStatus, t])
  return (
    <div className="app-shell workspace workspace-root" data-testid="app-shell">
      {inAppMenuBar ? (
        <AppMenuBar
          recentFiles={recentFiles}
          onRunAction={onAppMenuBarAction}
          onOpenRecent={onAppMenuBarOpenRecent}
        />
      ) : null}
    <div
      className={`layout workspace-split mod-root ${sidebarVisible && !focusMode ? 'with-sidebar' : 'without-sidebar'} ${focusMode ? 'focus-mode' : ''} ${knowledgeRailVisible && rootDir && !focusMode ? 'with-knowledge-rail' : ''}`}
      style={
        sidebarVisible && !focusMode
          ? ({
              '--sidebar-width': `${Math.max(240, Math.min(520, sidebarWidth))}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {sidebarVisible && !focusMode && (
        <AppSidebarPanel
          toolbarSidebar={toolbarSidebar}
          t={t}
          rootDir={rootDir}
          activePath={activePath}
          mainPaneMode={mainPaneMode}
          searchText={searchText}
          setSearchText={setSearchText}
          setSearchResults={setSearchResults}
          searchResults={searchResults}
          sidebarListMode={sidebarListMode}
          draggingWorkspaceFile={draggingWorkspaceFile}
          dragOverTarget={dragOverTarget}
          setDragOverTarget={setDragOverTarget}
          onSidebarBlankContextMenu={onSidebarBlankContextMenu}
          dispatchOpenDocument={dispatchOpenDocument}
          onSidebarFileContextMenu={onSidebarFileContextMenu}
          outlineHeadings={outlineHeadings}
          activeOutlineId={activeOutlineId}
          scrollPreviewToHeading={scrollPreviewToHeading}
          fileTree={fileTree}
          sidebarFileView={sidebarFileView}
          workspaceFolderNodes={workspaceFolderNodes}
          sortedFlatWorkspaceFiles={sortedFlatWorkspaceFiles}
          sortedFileTree={sortedFileTree}
          expandedDirs={expandedDirs}
          toggleWorkspaceDir={toggleWorkspaceDir}
          openWorkspaceFileFromSidebar={openWorkspaceFileFromSidebar}
          onWorkspaceFilePointerDown={onWorkspaceFilePointerDown}
          handleMoveFileToFolder={handleMoveFileToFolder}
          createNewNote={createNewNote}
          workspaceFolderName={workspaceFolderName}
          workspaceMenuRef={workspaceMenuRef}
          workspaceMenuPopRef={workspaceMenuPopRef}
          workspaceMenuOpen={workspaceMenuOpen}
          setWorkspaceMenuOpen={setWorkspaceMenuOpen}
          workspaceMenuPopStyle={workspaceMenuPopStyle}
          fileSortMode={fileSortMode}
          setFileSortMode={setFileSortMode}
          setSidebarVisible={setSidebarVisible}
          setStatus={setStatus}
          chooseFolder={chooseFolder}
          toggleMainPaneMode={toggleMainPaneMode}
          refreshFileTree={refreshFileTree}
          appMenuCtxRef={appMenuCtxRef}
          paletteUiDepsRef={paletteUiDepsRef}
          setSidebarFileView={setSidebarFileView}
          sidebarStatusLine={
            (status || t('app.status.pickFolder', { app: APP_DISPLAY_NAME })) +
            (savedAt ? ' ' + t('app.search.savedAt', { time: savedAt }) : '')
          }
        />
      )}
      {sidebarVisible && !focusMode && (
        <div
          className="resize-handle resize-handle-sidebar"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = sidebarWidth
            const onMove = (moveEvent: MouseEvent) => {
              const next = startWidth + (moveEvent.clientX - startX)
              setSidebarWidth(Math.max(240, Math.min(520, next)))
            }
            const onUp = () => {
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
          title={t('app.sidebar.resize')}
        />
      )}
      <AppEditorMain
        t={t}
        mainWithRailRef={mainWithRailRef}
        knowledgeRailOpen={knowledgeRailOpen}
        editorBodyFocused={editorBodyFocused}
        setEditorBodyFocused={setEditorBodyFocused}
        focusMode={focusMode}
        sidebarVisible={sidebarVisible}
        setSidebarVisible={setSidebarVisible}
        activePath={activePath}
        workspaceFolderName={workspaceFolderName}
        tabLabel={tabLabel}
        activeDocumentTitle={activeDocumentTitle}
        activeDocumentSubtitle={activeDocumentSubtitle}
        setFocusMode={setFocusMode}
        sidebarListMode={sidebarListMode}
        toggleSidebarListOutline={toggleSidebarListOutline}
        rootDir={rootDir}
        knowledgeRailVisible={knowledgeRailVisible}
        setKnowledgeRailVisible={setKnowledgeRailVisible}
        openedTabs={openedTabs}
        externalDiskChangedPaths={externalDiskChangedPaths}
        activateTab={activateTab}
        closeTab={closeTab}
        onTabContextMenu={onTabContextMenu}
        mainPaneMode={mainPaneMode}
        toggleMainPaneMode={toggleMainPaneMode}
        panesRef={panesRef}
        editorSurfaceStyle={editorSurfaceStyle}
        setFileContextMenu={setFileContextMenu}
        setEditorDocMenu={setEditorDocMenu}
        visualEditorRef={visualEditorRef}
        editorViewRef={editorViewRef}
        content={content}
        handleEditorContentChange={handleEditorContentChange}
        setActiveOutlineId={setActiveOutlineId}
        setStatus={setStatus}
        pasteImageIntoVisualEditor={pasteImageIntoVisualEditor}
        importDroppedAssets={importDroppedAssets}
        pickAndImportLunaAsset={pickAndImportLunaAsset}
        handleLunaAssetLinkClick={handleLunaAssetLinkClick}
        getLunaAssetTooltip={getLunaAssetTooltip}
        onWikiLinkNavigate={onWikiLinkNavigate}
        atomicVisualDocumentEnter={atomicVisualDocumentEnter}
        onAtomicVisualDocumentEnterConsumed={onAtomicVisualDocumentEnterConsumed}
        editorOpenReason={editorOpenReason}
        handleWikiHover={handleWikiHover}
        suppressMarkdownSerdeRef={suppressMarkdownSerdeRef}
        cmMountKey={cmMountKey}
        visualMountKey={visualMountKey}
        editorExtensions={editorExtensions}
        handleSourceViewReady={handleSourceViewReady}
        importDroppedAssetLinks={importDroppedAssetLinks}
        statusbarVisible={statusbarVisible}
        status={status}
        savedAt={savedAt}
        contentStats={contentStats}
        performanceMode={performanceMode}
        sourceCodeMirrorBootSelectionRef={sourceCodeMirrorBootSelectionRef}
        knowledgeRailSlot={
          knowledgeRailOpen ? (
            <>
              <KnowledgeSurfaceSplitHandle onPointerDown={surfaceSplit.onSplitterPointerDown} />
              <KnowledgeRightRail
                visible
                activeDocKey={activeDocKey}
                onOpenSearch={openKnowledgeSearchModal}
                onClose={() => setKnowledgeRailVisible(false)}
              />
            </>
          ) : null
        }
      />
      <AppRootOverlays
        t={t}
        globalSearchOpen={globalSearchOpen}
        globalSearchQuery={globalSearchQuery}
        onGlobalSearchQueryChange={setGlobalSearchQuery}
        onGlobalSearchClose={() => setGlobalSearchOpen(false)}
        knowledgeSearchOpen={knowledgeSearchOpen}
        knowledgeSearchQuery={knowledgeSearchQuery}
        onKnowledgeSearchQueryChange={setKnowledgeSearchQuery}
        onKnowledgeSearchClose={() => setKnowledgeSearchOpen(false)}
        rootDir={rootDir}
        workspaceSearchIndex={sidebarSearchIndex}
        onGlobalSearchOpenDocument={dispatchOpenDocumentInTab}
        wikiHoverId={wikiHoverId}
        commandPaletteOpen={commandPaletteOpen}
        commandPaletteQuery={commandPaletteQuery}
        commandPaletteIndex={commandPaletteIndex}
        commandPaletteInputRef={commandPaletteInputRef}
        paletteFiltered={paletteFiltered}
        onCommandPaletteClose={() => setCommandPaletteOpen(false)}
        onCommandPaletteQueryChange={setCommandPaletteQuery}
        onCommandPaletteIndexChange={setCommandPaletteIndex}
        onRunPaletteCommand={(id) => void runPaletteCommand(id)}
        aboutOpen={aboutOpen}
        onAboutClose={() => setAboutOpen(false)}
        deleteConfirmDialog={deleteConfirmDialog}
        onDeleteConfirm={() => closeDeleteConfirmDialog(true)}
        onDeleteCancel={() => closeDeleteConfirmDialog(false)}
        unsavedDialog={unsavedDialog}
        onUnsavedChoice={closeUnsavedDialog}
        confirmDialog={confirmDialog}
        onConfirmDialog={closeConfirmDialog}
        alertDialog={alertDialog}
        onAlertClose={closeAlertDialog}
        renameDialog={renameDialog}
        renameInputValue={renameInputValue}
        renameError={renameError}
        renameSubmitting={renameSubmitting}
        renameInputRef={renameInputRef}
        onRenameInputChange={setRenameInputValue}
        onRenameSubmit={() => void submitRename()}
        onRenameClose={() => {
          if (renameSubmitting) return
          setRenameDialog(null)
        }}
        fileContextMenu={fileContextMenu}
        fileContextMenuRef={fileContextMenuRef}
        onFileContextPick={handleFileContextPick}
        editorDocMenu={editorDocMenu}
        editorDocMenuRef={editorDocMenuRef}
        editorDiskFileReady={editorDiskFileReady}
        editorCanRevealInOs={editorCanRevealInOs}
        onEditorDocMenuPick={handleEditorDocMenuPick}
        onEditorTextColorPick={handleEditorTextColorPick}
        onExportPick={(format) => {
          setEditorDocMenu(null)
          void runAppExportFormat(format)
        }}
        tabContextMenu={tabContextMenu}
        tabContextMenuRef={tabContextMenuRef}
        onTabContextPick={handleTabContextPick}
        saveConflictOpen={saveConflict != null}
        saveConflictPath={saveConflict?.path ?? ''}
        saveConflictBase={saveConflict?.base ?? ''}
        saveConflictLocal={saveConflict?.local ?? ''}
        saveConflictDisk={saveConflict?.disk ?? ''}
        onSaveConflictCancel={onSaveConflictCancel}
        onSaveConflictUseDisk={onSaveConflictUseDisk}
        onSaveConflictKeepLocal={onSaveConflictKeepLocal}
      />
    </div>
    </div>
  )
}

export default App
