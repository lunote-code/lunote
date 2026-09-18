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
  type SetStateAction,
} from 'react'
import { EditorSelection } from '@codemirror/state'
import '../App.css'
import './appMenuBar.css'
import type { AtomicVisualDocumentEnter } from '../editor/TiptapMarkdownEditor'
import { EditorOpenReason, type EditorOpenReason as EditorOpenReasonKind } from '../editor/editorOpenReason'
import {
  createInitialModeSwitchFsmState,
  modeSwitchFsmReducer,
  type ModeSwitchAnchorPayload,
} from '../editor/modeSwitchFSM'
import { isModeSwitchFreezeError } from '../editor/modeSwitchFreezeFailure'
import { VIEWPORT_DOCUMENT_NODE_ID, viewportAnchorEngine } from '../editor/viewportAnchorEngine'
import { useSidebarOutlineHeadings } from './hooks/useSidebarOutlineHeadings'
import type { TocHeading } from './components/DocumentOutlineBlock'
import { getSourceModeIdentity } from '../editor/sourceModeIdentity'
import { isQaAppRootOutlineMode } from './qa/qaAppRootOutlineHarness'
import { computeDocumentContentStats } from './documentContentStats'
import { parseFrontmatter } from '../editor/knowledgeRuntime/wikiLinkParser'
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
  mergeRecentFilePath,
  readRecentFilesFromStorage,
} from '../lib/recentFilesStorage'
import {
  mergeRecentWorkspacePath,
  readRecentWorkspacesFromStorage,
} from '../lib/recentWorkspacesStorage'
import {
  ancestorDirPathsForFile,
  joinRelativePath,
  pathHasParentDirSegment,
  pathsEqual,
  relativePathUnderRoot,
} from '../lib/workspacePathUtils'
import { useAppEditorSessionRefs } from './hooks/useAppEditorSessionRefs'
import { useAppOrchestrationRefs } from './session/useAppOrchestrationRefs'
import { useDocumentKernelRuntime } from './session/useDocumentKernelRuntime'
import { useDocumentOperationsController } from './session/useDocumentOperationsController'
import { useDocumentOverlaysController } from './session/useDocumentOverlaysController'
import { useDocumentRuntimeMirror } from './session/useDocumentRuntimeMirror'
import { useEditorSurfaceController } from './session/useEditorSurfaceController'
import { useWorkspaceSessionController } from './session/useWorkspaceSessionController'
import { useWorkspaceChromeController } from './session/useWorkspaceChromeController'
import { useAppChromeController } from './session/useAppChromeController'
import { useAppLifecycleController } from './session/useAppLifecycleController'
import { useGlobalSearchRevealController } from './session/useGlobalSearchRevealController'
import { useKnowledgeShellController } from './session/useKnowledgeShellController'
import { useAppStatus, inferStatusTone, type AppStatusTone } from './hooks/useAppStatus'
import { pushAppToast, shouldShowStatusToast, shouldSkipSaveStatusToast } from './toast/appToastStore'
import { AppToastHost } from './components/AppToastHost'
import { EditorRightRailContainer, type EditorRightRailView } from './components/EditorRightRailContainer'
import { useDocumentReloadFromDisk } from './hooks/useDocumentReloadFromDisk'
import { useLargeDocPerformanceHint } from './hooks/useLargeDocPerformanceHint'
import { useAppDialogs } from './hooks/useAppDialogs'
import { useAutoUpdateCheck } from './hooks/useAutoUpdateCheck'
import { type HistoryDialogState } from './hooks/useHistoryAndConflictOverlays'
import { WorkspaceExternalDropOverlay } from './components/WorkspaceExternalDropOverlay'
import { useEditorDocMenu } from './hooks/useEditorDocMenu'
import { resolveNewNoteContent } from '../templates/templateService'
import { AppSidebarPanel } from './components/AppSidebarPanel'
import {
  isFilesPanelView,
  loadSidebarPanelView,
  persistSidebarPanelView,
  resolveFilesPanelView,
  sidebarFileViewFromPanelView,
  sidebarListModeFromPanelView,
  type SidebarListMode,
  type SidebarPanelView,
} from './workspace/sidebarPanelView'
import { normalizeNewNoteStemInput } from './workspace/workspaceTree'
import { AppEditorMain } from './components/AppEditorMain'
import { AppRootOverlays } from './components/AppRootOverlays'
import {
  executeManifestCommand,
} from '../menu'
import type { PaletteCommandDef } from '../menu'
import { setActiveTransactionDoc } from '../menu/commandTransaction'
import { setInputRouterDocId } from '../vm/inputRouter'
import { bridgeReplaceSelection, initEditorMutationBridge } from '../editor/editorMutationBridge'
import { handleVerticalResizeKeyDown } from '../lib/verticalResizeKeyboard'
import { beginVerticalSplitDrag } from '../lib/verticalSplitDrag'
import { useI18n } from '../i18n'
import '../editor/knowledgeOS/ui/knowledgePanels.css'
import '../editor/ai/ui/aiPanel.css'
import { absolutePathToDocKeyOs } from '../editor/knowledgeOS'
import { AiRightRail } from '../editor/ai/ui/AiRightRail'
import { consumeAiPanelOpenRequest, subscribeAiPanelStore } from '../editor/ai/aiPanelStore'
import {
  useClearEditorAiInsertUndoOnPathChange,
  useEditorAiCursorInsert,
} from '../editor/ai/hooks/useEditorAiCursorInsert'
import { useEditorBlockAi } from '../editor/ai/hooks/useEditorBlockAi'
import { KnowledgeRightRail } from '../editor/knowledgeOS/ui/KnowledgeRightRail'
import { KnowledgeSurfaceSplitHandle } from '../editor/knowledgeOS/ui/KnowledgeSurfaceSplitHandle'
import { useSurfaceSplitLayout } from '../editor/knowledgeOS/ui/useSurfaceSplitLayout'
import { AppMenuBar } from './AppMenuBar'
import { usesInAppMenuBar, usesNativeMacAppMenu } from './shellPlatform'
import { resolveWikiLinkTargetAtCmPos } from '../editor/compiler/wikiInteractionMetadata'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigateBack,
  dispatchKnowledgeNavigateForward,
  dispatchKnowledgeNavigate,
  dispatchWikiHover,
} from '../editor/knowledgeOS/ui/interactionTransaction'
import { beginNavigationReveal } from '../editor/knowledgeOS/editorNavigationReadiness'
import { applyDocumentFrontmatterUpdate } from './document/applyDocumentFrontmatter'
import { appendWikiLinkToDocument } from './document/appendWikiLinkToDocument'
import { removeWikiLinkFromDocument } from './document/removeWikiLinkFromDocument'
import { readDocument } from '../io/documentIO'
import type { WikiLinkEditorHandlers } from '../editor/knowledgeOS/ui/cmWikiLinkExtension'
import {
  refreshBacklinkPanel,
  requestOsRevision,
  setBacklinkPanelDocKey,
  syncNoteGraphTopologyFromRoute,
} from '../editor/knowledgeOS'
import { getLinkIndexState, subscribeLinkIndexState } from '../editor/knowledgeRuntime/linkIndexState'
import { setPendingGraphCenter } from '../editor/knowledgeOS/graphNavigationRuntime'
import { dispatchOpenNoteNavigation } from '../navigation/navigationFactory'
import type { EmbeddedHtmlWorkspaceNoteTarget } from '../editor/resolveWorkspaceMarkdownHref'
import type { WikiLinkTarget } from '../editor/knowledgeRuntime/types'
import { normalizeAssetStorageConfig } from '../assets/assetStoragePolicy'
import type { AssetStorageConfig } from '../assets/assetStoragePolicy'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../settings/appSettingsStore'
import { buildEditorFontFamilyCss, isEditorMonoFont } from '../settings-runtime/editorFontPresets'
import { normalizeEditorFontSize } from '../settings-runtime/editorTypography'
import { normalizeEditorColumnWidth } from '../settings-runtime/editorColumnWidth'
import { resolveDocumentStatsEnabled } from '../settings-runtime/editorUiChrome'
import { createNote } from '../platform/tauri/documentService'
import { logInfo } from '../lib/lunaLogger'
import { getCurrentThemeMode, subscribeTheme, subscribeThemeRuntime } from '../theme-runtime/themeRuntime'
import { useSyncWindowTitle } from './hooks/useSyncWindowTitle'
import { markBootPhase, measureBootSince } from './bootPerf'
import { refreshWorkspaceIndex } from './workspace/workspaceIndexCoordinator'
import {
  APP_DISPLAY_NAME,
  LARGE_DOC_THRESHOLD,
  isBufferTabId,
} from './workspace/constants'
import { touchTabMru } from './document/tabMru'
import { openShortcutsCheatsheetDialog } from '../components/shortcutsCheatsheetStore'
import type {
  FileSortMode,
  RenameDialogState,
} from './workspace/types'
import type { WorkspaceDragTarget } from './workspace/workspaceDrag'
import type { EditorDocMenuState, FileContextMenuState } from './workspace/contextMenuTypes'
import { openSaveConflictDialog, type SaveConflictState } from './document/saveConflictState'
import { resolveWikiTarget } from '../editor/knowledgeOS/wikiLinkRuntime'

const SIDEBAR_WIDTH_MIN = 240
const SIDEBAR_WIDTH_MAX = 520
const SIDEBAR_WIDTH_STEP = 16

function shouldSkipTransientSaveFeedback(message: string, t: (key: string) => string): boolean {
  const trimmed = message.trim()
  return trimmed === t('app.status.saved') || trimmed === t('app.status.autosaved')
}

function App() {
  const {
    t,
    effectiveLocale,
    paletteCommands: compiledPaletteCommands,
    toolbarEditorFormat,
  } = useI18n()
  const inAppMenuBar = useMemo(() => usesInAppMenuBar(), [])
  const nativeMacAppMenu = useMemo(() => usesNativeMacAppMenu(), [])

  const tRef = useRef(t)
  tRef.current = t
  const statusbarVisibleRef = useRef(true)
  const {
    workspaceSessionSnapshot,
    activePath,
    content,
    openedTabs,
    activePathRef,
    contentRef,
  } = useDocumentRuntimeMirror()
  const onWorkspaceDocumentSavedRef = useRef<(path: string, savedAtMs?: number) => void>(() => {})
  const migrateNoteCalendarEditPathRef = useRef<(oldPath: string, newPath: string) => void>(() => {})
  const startupDocumentRuntimeLoggedRef = useRef<string | null>(null)
  const startupVisualEditorReadyLoggedRef = useRef<string | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const { status, statusTone, setStatus: setTransientStatus } = useAppStatus()
  const setStatus = useCallback((message: string, toneOverride?: AppStatusTone) => {
    const trimmed = message.trim()
    const skipTransient =
      Boolean(trimmed) && shouldSkipTransientSaveFeedback(trimmed, (key) => tRef.current(key))
    if (!skipTransient) {
      setTransientStatus(message, toneOverride)
    }
    if (!trimmed) return
    const tone = toneOverride ?? inferStatusTone(trimmed)
    if (shouldShowStatusToast(tone)) {
      const skipSaveToast = shouldSkipSaveStatusToast(trimmed, tRef.current)
      const showSaveToastWhenStatusbarHidden = skipSaveToast && !statusbarVisibleRef.current
      if (!skipSaveToast || showSaveToastWhenStatusbarHidden) {
        pushAppToast(trimmed, tone)
      }
    }
  }, [setTransientStatus])
  const [searchText, setSearchText] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? Number(saved) : 310
  })
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const saved = localStorage.getItem('sidebarVisible')
    return saved ? saved === '1' : true
  })
  const [sidebarPanelView, setSidebarPanelViewState] = useState<SidebarPanelView>(() => loadSidebarPanelView())
  const lastFilesPanelViewRef = useRef<'files-list' | 'files-tree'>(
    (() => {
      const initial = loadSidebarPanelView()
      return isFilesPanelView(initial) ? initial : 'files-tree'
    })(),
  )
  const setSidebarPanelView = useCallback((action: SetStateAction<SidebarPanelView>) => {
    setSidebarPanelViewState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      if (isFilesPanelView(next)) {
        lastFilesPanelViewRef.current = next
      }
      return next
    })
  }, [])
  const sidebarListMode = sidebarListModeFromPanelView(sidebarPanelView)
  const sidebarFileView = sidebarFileViewFromPanelView(sidebarPanelView)
  const setSidebarListMode = useCallback((action: SetStateAction<SidebarListMode>) => {
    setSidebarPanelView((prev) => {
      const mode =
        typeof action === 'function' ? action(sidebarListModeFromPanelView(prev)) : action
      if (mode === 'outline') return 'outline'
      if (mode === 'calendar') return 'calendar'
      return resolveFilesPanelView(prev, lastFilesPanelViewRef.current)
    })
  }, [setSidebarPanelView])
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null)
  const fileContextMenuRef = useRef<HTMLDivElement | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<WorkspaceDragTarget | null>(null)
  const [draggingWorkspaceFile, setDraggingWorkspaceFile] = useState<string[] | null>(null)
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
    workspacePasswordDialog,
    promptWorkspacePassword,
    closeWorkspacePasswordDialog,
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
    mainPaneModeRef.current = mode
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
    const message = isModeSwitchFreezeError(error)
      ? tRef.current('app.status.modeSwitchRestoreFailed')
      : error instanceof Error
        ? error.message
        : String(error)
    setStatus(tRef.current('app.status.operationFailed', { message }), 'error')
    setModeSwitchLoading(false)
    dispatchModeSwitchFsm({ type: 'ENHANCEMENT_FAILED', error })
  }, [setStatus])
  const onModeSwitchApplyingAnchor = useCallback(() => {
    dispatchModeSwitchFsm({ type: 'APPLYING_ANCHOR' })
  }, [])
  const [focusMode, setFocusMode] = useState(() => {
    const saved = localStorage.getItem('focusMode')
    return saved ? saved === '1' : false
  })
  const [statusbarVisible, setStatusbarVisible] = useState(() =>
    resolveDocumentStatsEnabled(getAppSettingsSnapshot().appearance?.ui),
  )
  statusbarVisibleRef.current = statusbarVisible
  /** When the cursor is in the text/source code editing area, the top bar and footer are weakened, close to the Typora writing state*/
  const [editorBodyFocused, setEditorBodyFocused] = useState(false)
  const isDark = useSyncExternalStore(
    subscribeTheme,
    () => getCurrentThemeMode() === 'dark',
    () => getCurrentThemeMode() === 'dark',
  )
  const [aboutOpen, setAboutOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('')
  const [commandPaletteIndex, setCommandPaletteIndex] = useState(0)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [quickSwitcherQuery, setQuickSwitcherQuery] = useState('')
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false)
  const [tabSwitcherQuery, setTabSwitcherQuery] = useState('')
  const [modeSwitchLoading, setModeSwitchLoading] = useState(false)
  const [knowledgeSearchOpen, setKnowledgeSearchOpen] = useState(false)
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState('')
  const closeGlobalSearch = useCallback(() => setGlobalSearchOpen(false), [])
  const closeQuickSwitcher = useCallback(() => setQuickSwitcherOpen(false), [])
  const closeTabSwitcher = useCallback(() => setTabSwitcherOpen(false), [])
  const closeKnowledgeSearch = useCallback(() => {
    setKnowledgeSearchOpen(false)
    setKnowledgeSearchQuery('')
  }, [])
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), [])
  const [knowledgeRailVisible, setKnowledgeRailVisibleState] = useState(() => {
    const saved = localStorage.getItem('knowledgeRailVisible')
    return saved ? saved === '1' : true
  })
  const setKnowledgeRailVisible = useCallback((value: SetStateAction<boolean>) => {
    setKnowledgeRailVisibleState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      if (!next) {
        setKnowledgeSearchOpen(false)
        setKnowledgeSearchQuery('')
      }
      return next
    })
  }, [])
  const [aiPanelVisible, setAiPanelVisible] = useState(() => {
    const saved = localStorage.getItem('aiPanelVisible')
    return saved ? saved === '1' : false
  })
  const [editorRightRailView, setEditorRightRailViewState] = useState<EditorRightRailView>(() => {
    const saved = localStorage.getItem('editorRightRailView')
    return saved === 'ai' ? 'ai' : 'knowledge'
  })
  const setEditorRightRailView = useCallback((view: EditorRightRailView) => {
    setEditorRightRailViewState(view)
    localStorage.setItem('editorRightRailView', view)
  }, [])
  const openGlobalSearchModal = useCallback(() => {
    if (!rootDirRef.current.trim()) {
      setStatus(tRef.current('app.menu.openWorkspaceFirst'))
      return
    }
    setKnowledgeSearchOpen(false)
    setQuickSwitcherOpen(false)
    setGlobalSearchQuery('')
    setGlobalSearchOpen(true)
  }, [setStatus])
  const openQuickSwitcherModal = useCallback(() => {
    if (!rootDirRef.current.trim()) {
      setStatus(tRef.current('app.menu.openWorkspaceFirst'))
      return
    }
    setKnowledgeSearchOpen(false)
    setGlobalSearchOpen(false)
    setTabSwitcherOpen(false)
    setQuickSwitcherQuery('')
    setQuickSwitcherOpen(true)
  }, [setStatus])
  const openTabSwitcherModal = useCallback(() => {
    setGlobalSearchOpen(false)
    setQuickSwitcherOpen(false)
    setKnowledgeSearchOpen(false)
    setTabSwitcherQuery('')
    setTabSwitcherOpen(true)
  }, [])
  const openKnowledgeSearchModal = useCallback(() => {
    setGlobalSearchOpen(false)
    setKnowledgeSearchQuery('')
    setFocusMode(false)
    setKnowledgeRailVisible(true)
    setEditorRightRailView('knowledge')
    setKnowledgeSearchOpen(true)
  }, [setFocusMode, setKnowledgeRailVisible, setEditorRightRailView])
  const [wikiHoverId, setWikiHoverId] = useState<string | null>(null)
  const wikiHoverIdRef = useRef<string | null>(null)
  const wikiHandlersRef = useRef<WikiLinkEditorHandlers | null>(null)
  const wikiTargetResolverRef = useRef<((pos: number) => WikiLinkTarget | null) | null>(null)
  const paletteCommandDefs = useMemo((): PaletteCommandDef[] => compiledPaletteCommands, [compiledPaletteCommands])
  const setActiveOutlineIdRef = useRef<(id: string) => void>(() => {})
  const [activeOutlineId, setActiveOutlineId] = useState('')
  const outlineActiveByPathRef = useRef(new Map<string, string>())
  const [bufferTabLabels, setBufferTabLabels] = useState<Record<string, string>>({})
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>(readRecentWorkspacesFromStorage)
  const [recentFiles, setRecentFiles] = useState<string[]>(readRecentFilesFromStorage)

  const updateRecentWorkspace = useCallback((root: string) => {
    setRecentWorkspaces((prev) => mergeRecentWorkspacePath(prev, root))
  }, [])

  const updateRecent = useCallback((path: string) => {
    setRecentFiles((prev) => mergeRecentFilePath(prev, path))
  }, [])

  useEffect(() => {
    registerLunaSurfaceDispatch(dispatchEditorSurface)
    return unregisterLunaSurfaceDispatch
  }, [dispatchEditorSurface])

  const mainWithRailRef = useRef<HTMLElement | null>(null)

  const isLargeDoc = content.length >= LARGE_DOC_THRESHOLD

  const onModeSwitchBusyChange = useCallback((busy: boolean) => {
    setModeSwitchLoading(busy)
  }, [])

  useEffect(() => {
    if (!activePath) return
    tabMruRef.current = touchTabMru(tabMruRef.current, activePath)
  }, [activePath])

  useLargeDocPerformanceHint({ isLargeDoc, activePath, setStatus, t })

  const outlineMarkdownSource = useMemo(() => {
    if (!activePath) return content
    if (mainPaneMode === 'source') {
      return getSourceModeIdentity(activePath) ?? content
    }
    return content
  }, [activePath, content, mainPaneMode])

  const markdownOutlineHeadings = useSidebarOutlineHeadings(activePath, outlineMarkdownSource)
  const liveOutlineByPathRef = useRef(new Map<string, TocHeading[]>())
  const outlineHeadingsRef = useRef<TocHeading[]>([])
  const [liveOutlineTick, setLiveOutlineTick] = useState(0)
  const handleOutlineHeadingsChange = useCallback((headings: TocHeading[]) => {
    const path = activePathRef.current
    if (!path || path === 'scratch') return
    if (headings.length === 0) {
      liveOutlineByPathRef.current.delete(path)
    } else {
      liveOutlineByPathRef.current.set(path, headings)
    }
    setLiveOutlineTick((tick) => tick + 1)
  }, [])
  const outlineHeadings = useMemo(() => {
    void liveOutlineTick
    if (activePath) {
      const live = liveOutlineByPathRef.current.get(activePath)
      if (live && live.length > 0) {
        return live
      }
    }
    return markdownOutlineHeadings
  }, [activePath, markdownOutlineHeadings, liveOutlineTick])
  outlineHeadingsRef.current = outlineHeadings

  useLayoutEffect(() => {
    setActiveOutlineId(outlineActiveByPathRef.current.get(activePath) ?? '')
  }, [activePath, mainPaneMode])

  useEffect(() => {
    if (!activePath || !activeOutlineId) return
    outlineActiveByPathRef.current.set(activePath, activeOutlineId)
  }, [activePath, activeOutlineId])

  const contentStats = useMemo(() => {
    const surface =
      mainPaneMode === 'visual' && activePath ? parseFrontmatter(content).body : content
    return computeDocumentContentStats(surface)
  }, [content, mainPaneMode, activePath])

  const panesRef = useRef<HTMLElement | null>(null)
  const outlineSpyCtxRef = useRef<{ sidebarListMode: SidebarListMode }>({ sidebarListMode: 'files' })
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null)
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null)
  const quickSwitcherInputRef = useRef<HTMLInputElement | null>(null)
  const tabSwitcherInputRef = useRef<HTMLInputElement | null>(null)
  const tabMruRef = useRef<string[]>([])
  const createNewNoteRef = useRef<() => Promise<void>>(async () => {})
  const {
    leaveCurrentTabRef,
    saveAllDirtyDocumentsRef,
    flushEditorToMemoryRef,
    dispatchOpenDocumentRef,
    dispatchOpenDocumentInTabRef,
    flushEditorToMemoryViaRef,
    dispatchOpenDocument,
    dispatchOpenDocumentInTabViaRef,
  } = useAppOrchestrationRefs()
  const bumpVisualSelectionRef = useRef<() => void>(() => {})
  /** Inactive dirty tags are recorded when external changes are made and prompted when switching back to the tag.*/
  const [externalDiskChangedPaths, setExternalDiskChangedPaths] = useState<Set<string>>(() => new Set())
  const [saveConflict, setSaveConflict] = useState<SaveConflictState | null>(null)
  const [documentHistoryDialog, setDocumentHistoryDialog] = useState<HistoryDialogState | null>(null)
  const openDocumentHistoryDialog = useCallback((dialogRoot: string, dialogPath: string) => {
    setDocumentHistoryDialog({ rootDir: dialogRoot, path: dialogPath })
  }, [])
  const dismissDocumentHistoryDialog = useCallback(() => {
    setDocumentHistoryDialog(null)
  }, [])
  /** This application briefly ignores the workspace-changed storm after writing to disk.*/
  const [atomicVisualDocumentEnter, setAtomicVisualDocumentEnter] = useState<AtomicVisualDocumentEnter | null>(null)
  const [editorOpenReason, setEditorOpenReason] = useState<EditorOpenReasonKind>(EditorOpenReason.ColdOpen)
  const {
    tabNavGenerationRef,
    modeSwitchGenerationRef,
    externalReloadGenerationRef,
    fileStatGenerationRef,
    fileStatRef,
    suppressWorkspaceRefreshUntilRef,
    kernelContentDebounceRef,
    documentNavigationInProgressRef,
    editorViewRef,
    visualEditorRef,
    modeToggleRetryCountRef,
    suppressMarkdownSerdeRef,
    pendingSourceModeAnchorRef,
    sourceCodeMirrorBootSelectionRef,
    coldOpenGeneration,
    bumpColdOpenGeneration,
    sourceCodeMirrorInstanceKey,
    setSourceCodeMirrorInstanceKey,
    resetModeSwitchEditorBootstrap,
  } = useAppEditorSessionRefs({
    dispatchModeSwitchFsm,
    setAtomicVisualDocumentEnter,
    setEditorOpenReason,
  })
  const [assetStorageConfig, setAssetStorageConfigState] = useState<AssetStorageConfig>(() =>
    normalizeAssetStorageConfig(getAppSettingsSnapshot().assetStorage),
  )
  const [editorTypography, setEditorTypography] = useState(() => {
    const editor = getAppSettingsSnapshot().appearance?.editor
    return {
      fontFamily: editor?.fontFamily ?? '',
      fontSize: normalizeEditorFontSize(editor?.fontSize),
      columnWidth: normalizeEditorColumnWidth(editor?.columnWidth),
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
        columnWidth: normalizeEditorColumnWidth(editor?.columnWidth),
      })
      setStatusbarVisible(resolveDocumentStatsEnabled(snapshot.appearance?.ui))
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
    style['--editor-column-width'] = `${editorTypography.columnWidth}px`
    return style as CSSProperties
  }, [editorTypography.fontFamily, editorTypography.fontSize, editorTypography.columnWidth])

  useEffect(() => {
    editorViewRef.current?.requestMeasure()
  }, [editorTypography.fontSize, editorTypography.fontFamily, editorTypography.columnWidth])

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

  const tabLabel = useCallback(
    (path: string) => {
      if (isBufferTabId(path)) return bufferTabLabels[path] || t('app.tab.unnamed')
      const rel = relativePathUnderRoot(rootDirRef.current, path)
      if (rel === null) return path.replace(/\\/g, '/').split('/').pop() ?? path
      return rel
    },
    [bufferTabLabels, t],
  )

  const {
    rootDir,
    setRootDir,
    fileTree,
    setFileTree,
    expandedDirs,
    setExpandedDirs,
    loadNotes,
    refreshFileTree,
    touchWorkspaceFileModifiedAt,
    chooseFolder,
    closeWorkspace,
    toggleDir,
    workspaceRestoringRef,
    pendingRestoreEventIdRef,
    workspaceSyncTick,
    acquireWorkspaceRestoreBarrier,
    releaseWorkspaceRestoreBarrier,
  } = useWorkspaceSessionController({
    loaderDeps: {
      t,
      activePath,
      content,
      openedTabs,
      promptUnsavedChanges,
      promptWorkspacePassword,
      setBufferTabLabels,
      fileStatRef,
      fileStatGenerationRef,
      flushEditorToMemoryRef,
      saveAllDirtyDocumentsRef,
      resetModeSwitchEditorBootstrap,
      bumpColdOpenGeneration,
      setStatus,
      onWorkspaceOpened: updateRecentWorkspace,
      setExternalDiskChangedPaths,
    },
    rootDirRef,
    externalSyncDeps: {
      t,
      tabLabel,
      setStatus,
      setExternalDiskChangedPaths,
      setSaveConflict,
      flushEditorToMemoryRef,
      resetModeSwitchEditorBootstrap,
      bumpColdOpenGeneration,
      fileStatRef,
      fileStatGenerationRef,
      externalReloadGenerationRef,
      suppressWorkspaceRefreshUntilRef,
    },
    setStatus,
    t,
  })

  useEffect(() => {
    if (!import.meta.env.DEV || !isQaAppRootOutlineMode()) return
    window.__QA_APP_ROOT_OUTLINE__ = {
      ready: () => Boolean(rootDirRef.current && activePathRef.current),
      activePath: () => activePathRef.current || null,
      getOutlineTitles: () => outlineHeadingsRef.current.map((heading) => heading.title),
      getMarkdownOutlineTitles: () => markdownOutlineHeadings.map((heading) => heading.title),
    }
    return () => {
      delete window.__QA_APP_ROOT_OUTLINE__
    }
  }, [activePath, rootDir, outlineHeadings, markdownOutlineHeadings])

  const activeDocKey = useMemo(() => {
    if (!rootDir || !activePath || isBufferTabId(activePath)) return null
    return absolutePathToDocKeyOs(activePath, rootDir)
  }, [rootDir, activePath])

  useEffect(() => {
    setBacklinkPanelDocKey(activeDocKey)
    if (!activeDocKey) return
    const linkIndexState = getLinkIndexState()
    if (linkIndexState === 'READY' || linkIndexState === 'UPDATING') {
      refreshBacklinkPanel(activeDocKey)
      setPendingGraphCenter(activeDocKey, `page:${activeDocKey}`)
      syncNoteGraphTopologyFromRoute(activeDocKey)
    }
    requestOsRevision()
  }, [activeDocKey])

  useEffect(() => {
    if (!activeDocKey) return
    return subscribeLinkIndexState(() => {
      if (getLinkIndexState() !== 'READY') return
      refreshBacklinkPanel(activeDocKey)
      setPendingGraphCenter(activeDocKey, `page:${activeDocKey}`)
      syncNoteGraphTopologyFromRoute(activeDocKey)
      requestOsRevision()
    })
  }, [activeDocKey])

  const knowledgeRailOpen = Boolean(rootDir && !focusMode && knowledgeRailVisible)
  const aiRailOpen = Boolean(rootDir && !focusMode && aiPanelVisible)
  const editorRightRailOpen = knowledgeRailOpen || aiRailOpen
  const surfaceSplit = useSurfaceSplitLayout(mainWithRailRef, editorRightRailOpen)

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

  useEditorAiCursorInsert({
    docKey: activeDocKey,
    activePath,
    activeTabLabel: activePath ? tabLabel(activePath) : null,
    content,
    visualEditorRef,
  })

  useEditorBlockAi({
    docKey: activeDocKey,
    activePath,
    activeTabLabel: activePath ? tabLabel(activePath) : null,
    content,
    visualEditorRef,
  })

  useClearEditorAiInsertUndoOnPathChange(activePath)

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
    let top = br.bottom + 8
    if (top + h > window.innerHeight - pad && br.top - h - 8 >= pad) {
      top = br.top - h - 8
    }
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
    if (!workspaceMenuOpen) {
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
    if (!workspaceMenuOpen) return
    const onResize = () => placeWorkspaceMenu()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [workspaceMenuOpen, placeWorkspaceMenu])

  useEffect(() => {
    if (!renameDialog) return
    requestAnimationFrame(() => {
      const input = renameInputRef.current
      if (!input) return
      input.focus()
      if (renameDialog.mode === 'newFolder' || renameDialog.mode === 'newNote') input.select()
    })
  }, [renameDialog])

  const {
    pasteImageIntoVisualEditor,
    pickAndImportLunaAsset,
    dropFilesIntoActiveNote,
    handleLunaAssetLinkClick,
    getLunaAssetTooltip,
    isVisualEditorBoundToActivePath,
    toggleMainPaneMode,
    handleSourceViewReady,
    focusActiveEditor,
    openFindPanel,
    findNextInDocument,
    findPreviousInDocument,
    copySelectionAs,
    cutSelectionToClipboard,
    pastePlainFromClipboard,
    insertImagesFromPicker,
    handleEditorContentChange,
    editorExtensions,
    scrollPreviewToHeading,
    revealNavigationAnchor,
    revealNavigationAnchorAfterOpen,
    editorHasTextSelection,
    selectionStats,
    isFormatCommandActive,
    applyEditorTextColor,
    bumpVisualSelection,
    visualSelectionTick,
    flushPendingKernelContentDebounce,
  } = useEditorSurfaceController({
    bumpVisualSelectionRef,
    assetDeps: {
      t,
      rootDir,
      activePath,
      assetStorageConfig,
      activePathRef,
      contentRef,
      mainPaneMode,
      visualEditorRef,
      editorViewRef,
      setStatus,
    },
    chromeParams: {
      t,
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
        modeSwitchGenerationRef,
        documentNavigationInProgressRef,
        kernelContentDebounceRef,
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
      onModeSwitchBusyChange,
      onModeSwitchBlocked: (reason) => {
        if (reason === 'code-block') {
          setStatus(t('editor.status.visualOpInCodeContext'), 'info')
        }
      },
      setStatus,
    },
    sourceExtensionsDeps: {
      isLargeDoc,
      sidebarListMode,
      outlineSpyCtxRef,
      setActiveOutlineIdRef,
      setActiveOutlineId,
      wikiHandlersRef,
      wikiTargetResolverRef,
      editorViewRef,
    },
    navigationRevealDeps: {
      mainPaneMode,
      activePathRef,
      contentRef,
      mainPaneModeRef,
      visualEditorRef,
      editorViewRef,
    },
  })
  const [editorDocumentLoading, setEditorDocumentLoading] = useState(false)

  useDocumentKernelRuntime({
    rootDir,
    rootDirRef,
    activePathRef,
    contentRef,
    focusActiveEditor,
    updateRecent,
    logModeSwitchState,
    setStatus,
    showAppAlert,
    t,
    sessionRefs: {
      fileStatRef,
      fileStatGenerationRef,
      resetModeSwitchEditorBootstrap,
      bumpColdOpenGeneration,
    },
  })

  const {
    saveCurrent,
    saveAsCurrent,
    runAppExportFormat,
    runAppPrint,
    saveAllOpenTabs,
    scratchNewDocument,
    scratchNewTab,
    dispatchOpenDocumentInTab,
    closeTab,
    onTabContextMenu,
    handleTabContextPick,
    reorderOpenedTabs,
    activateTab,
  } = useDocumentOperationsController({
    dispatchOpenDocumentRef,
    dispatchOpenDocumentInTabRef,
    saveDeps: {
      t,
      activePath,
      content,
      rootDir,
      rootDirRef,
      promptWorkspacePassword,
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
      onWorkspaceDocumentSaved: (path, savedAtMs) => onWorkspaceDocumentSavedRef.current(path, savedAtMs),
      updateRecent,
      resetModeSwitchEditorBootstrap,
      flushPendingKernelContentDebounce,
      setExternalDiskChangedPaths,
    },
    tabNavDeps: {
      t,
      rootDir,
      rootDirRef,
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
      documentNavigationInProgressRef,
      setEditorDocumentLoading,
      tabNavGenerationRef,
      suppressWorkspaceRefreshUntilRef,
      saveAllDirtyDocumentsRef,
      leaveCurrentTabRef,
      flushEditorToMemoryRef,
      confirmAppDialog,
      promptUnsavedChanges,
      showAppAlert,
      workspaceRestoringRef,
      focusActiveEditor,
      resetModeSwitchEditorBootstrap,
      logModeSwitchState,
      bumpColdOpenGeneration,
      beginNavigationReveal,
      revealNavigationAnchorAfterOpen,
      flushPendingKernelContentDebounce,
      documentHistoryOpen: documentHistoryDialog != null,
      closeDocumentHistoryDialog: dismissDocumentHistoryDialog,
      promptWorkspacePassword,
      onWorkspaceDocumentSaved: (path, savedAtMs) => onWorkspaceDocumentSavedRef.current(path, savedAtMs),
    },
  })

  const { openDocumentFromGlobalSearch } = useGlobalSearchRevealController({
    activePath,
    mainPaneMode,
    activePathRef,
    mainPaneModeRef,
    visualEditorRef,
    editorViewRef,
    dispatchOpenDocumentInTab,
  })

  const {
    openRenameDialog,
    openNewFolderDialog,
    openNewNoteDialog,
    openNewNoteFromTemplateDialog,
    submitRename,
    handleFileContextPick,
    handleMoveFileToFolder,
    workspaceFolderName,
    windowTitleDocument,
    windowTitleWorkspace,
    sortedFlatWorkspaceFiles,
    sortedFileTree,
    workspaceFolderNodes,
    sidebarSearchIndex,
    sidebarFilterMatchCount,
    isSidebarFiltering,
    toggleWorkspaceDir,
    onWorkspaceFilePointerDown,
    onSidebarFileContextMenu,
    onSidebarBlankContextMenu,
    isFilePathSelected,
    onWorkspaceFileClick,
    noteCalendarEdits,
    noteCalendarPreferPersistedOnly,
    externalDragActive,
    dropZone,
    shellDragProps,
  } = useWorkspaceChromeController({
    onWorkspaceDocumentSavedRef,
    migrateNoteCalendarEditPathRef,
    touchWorkspaceFileModifiedAt,
    dispatchOpenDocumentInTabViaRef,
    renameDeps: {
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
    },
    sidebarDeps: {
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
      dragOverTarget,
      setDragOverTarget,
      setEditorDocMenu,
      setFileContextMenu,
      toggleDir,
      setExpandedDirs,
      tabLabel,
      setStatus,
    },
    externalDropDeps: {
      t,
      rootDir,
      draggingWorkspaceFile,
      setStatus,
      setDragOverTarget,
      setExpandedDirs,
      refreshFileTree,
      dropFilesIntoActiveNote,
    },
  })

  const { quitAppSafely, openDailyNoteWithOffset } = useAppLifecycleController({
    t,
    rootDir,
    flushEditorToMemoryRef,
    saveAllDirtyDocumentsRef,
    promptUnsavedChanges,
    setStatus,
    dispatchOpenDocumentInTab,
  })

  const createNewNote = useCallback(async () => {
    if (!rootDir) {
      await scratchNewDocument()
      return
    }
    openNewNoteDialog(rootDir, rootDir)
  }, [rootDir, scratchNewDocument, openNewNoteDialog])

  const createNewNoteFromTemplate = useCallback(async () => {
    if (!rootDir) {
      await scratchNewDocument()
      return
    }
    openNewNoteFromTemplateDialog(rootDir, rootDir)
  }, [rootDir, scratchNewDocument, openNewNoteFromTemplateDialog])

  const createNewFolder = useCallback(() => {
    if (!rootDir) return
    openNewFolderDialog(rootDir, rootDir)
  }, [rootDir, openNewFolderDialog])

  const handleRenameTemplateChange = useCallback((templatePath: string) => {
    setRenameDialog((prev) =>
      prev && prev.mode === 'newNoteFromTemplate' ? { ...prev, templatePath } : prev,
    )
  }, [])


  useLayoutEffect(() => {
    createNewNoteRef.current = createNewNote
  }, [createNewNote])

  const { editorDiskFileReady, editorCanRevealInOs, handleEditorDocMenuPick } = useEditorDocMenu({
      t,
      rootDir,
      activePath,
      mainPaneMode,
      mainPaneModeRef,
      visualEditorRef,
      editorViewRef,
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

  const {
    appMenuCtxRef,
    paletteUiDepsRef,
    onFormatCommand,
    onAppMenuBarAction,
    onAppMenuBarOpenRecent,
    onAppMenuBarOpenRecentWorkspace,
    paletteFiltered,
    runPaletteCommand,
  } = useAppChromeController({
    nativeMacAppMenu,
    effectiveLocale,
    commandHostsDeps: {
      t,
      rootDir,
      activePath,
      content,
      recentFiles,
      recentWorkspaces,
      setRootDir,
      loadNotes,
      chooseFolder,
      closeWorkspace,
      saveCurrent,
      saveAsCurrent,
      saveAllOpenTabs,
      flushEditorToMemory: flushEditorToMemoryViaRef,
      refreshFileTree,
      setFileTree,
      setExpandedDirs,
      setStatus,
      updateRecent,
      setRecentFiles,
      setRecentWorkspaces,
      openRenameDialog,
      openNewNoteDialog,
      openNewNoteFromTemplateDialog,
      confirmDeleteFile,
      confirmAppDialog,
      showAppAlert,
      runAppExportFormat,
      runAppPrint,
      scratchNewDocument,
      scratchNewTab,
      openDailyNote: openDailyNoteWithOffset,
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
      setSidebarPanelView,
      sidebarVisible,
      sidebarListMode,
      openGlobalSearchModal,
      openQuickSwitcherModal,
      openTabSwitcherModal,
      openKnowledgeSearchModal,
      openShortcutsCheatsheet: openShortcutsCheatsheetDialog,
      setStatusbarVisible,
      setAboutOpen,
      setCommandPaletteOpen,
      setCommandPaletteQuery,
      setCommandPaletteIndex,
      openDocumentHistoryDialog,
      pendingSourceModeAnchorRef,
      resetModeSwitchEditorBootstrap,
      closeTab,
      quitApp: quitAppSafely,
    },
    menuShortcutsDeps: {
      recentWorkspaces,
      recentFiles,
      saveCurrent,
      saveAsCurrent,
      toggleMainPaneMode,
      pastePlainFromClipboard,
      setFocusMode,
      globalSearchOpen,
      quickSwitcherOpen,
      tabSwitcherOpen,
      knowledgeSearchOpen,
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
      globalSearchInputRef,
      quickSwitcherInputRef,
      paletteCommandDefs,
      activePathRef,
    },
    bootstrapDeps: {
      tRef,
      setRootDir,
      loadNotes,
      pendingRestoreEventIdRef,
      acquireWorkspaceRestoreBarrier,
      releaseWorkspaceRestoreBarrier,
      setStatus,
      flushEditorToMemoryRef,
      saveAllDirtyDocumentsRef,
      promptUnsavedChanges,
    },
    quickCaptureDeps: {
      onQuit: () => void quitAppSafely(),
      onStatus: setStatus,
    },
    macMenuDeps: {
      t,
      recentWorkspaces,
      recentFiles,
    },
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isBack =
        (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === 'ArrowLeft') ||
        (event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey && event.key === '[')
      const isForward =
        (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === 'ArrowRight') ||
        (event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey && event.key === ']')
      if (!isBack && !isForward) return
      const handled = isBack
        ? dispatchKnowledgeNavigateBack('command')
        : dispatchKnowledgeNavigateForward('command')
      if (!handled) return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])


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

  const insertWikiLinkAtCursor = useCallback((target: { docKey: string; title?: string }) => {
    const docKey = target.docKey.trim()
    if (!docKey) return false
    const title = target.title?.trim() ?? ''
    const insert =
      title && title !== docKey
        ? `[[${docKey}|${title}]]`
        : `[[${docKey}]]`
    focusActiveEditor()
    bridgeReplaceSelection(insert)
    focusActiveEditor()
    return true
  }, [focusActiveEditor])

  const createNoteFromWikiTarget = useCallback(
    async (target: WikiLinkTarget) => {
      if (!rootDir.trim()) {
        setStatus(t('app.menu.openWorkspaceFirst'), 'warning')
        return false
      }
      const rawDocKey = target.docKey.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/gu, '')
      const normalizedDocKey = rawDocKey.replace(/\.(md|markdown)$/iu, '')
      if (
        !normalizedDocKey ||
        normalizedDocKey === '.' ||
        normalizedDocKey === '..' ||
        pathHasParentDirSegment(normalizedDocKey) ||
        normalizedDocKey.split('/').some((part) => !part.trim() || part === '.' || part === '..')
      ) {
        setStatus(t('app.rename.invalidName'), 'error')
        return false
      }
      const parentRel = normalizedDocKey.includes('/')
        ? normalizedDocKey.slice(0, normalizedDocKey.lastIndexOf('/'))
        : ''
      const stem = normalizeNewNoteStemInput(
        normalizedDocKey.split('/').pop() ?? '',
        t('app.defaults.newNoteStem'),
      )
      const parentPath = parentRel ? joinRelativePath(rootDir, parentRel) : rootDir
      try {
        setStatus(`${t('knowledge.graph.legendUnresolved')} [[${normalizedDocKey}]]`, 'info')
        const content = await resolveNewNoteContent(rootDir, { stem, parentPath })
        const newPath = await createNote({
          root: rootDir,
          parentPath,
          stem,
          content,
        })
        await refreshFileTree()
        await refreshWorkspaceIndex(rootDir)
        setExpandedDirs((prev) => {
          const next = new Set(prev)
          for (const dir of ancestorDirPathsForFile(rootDir, newPath)) next.add(dir)
          return next
        })
        await dispatchOpenDocumentInTab(rootDir, newPath, 'wiki-link-create')
        setStatus(t('app.menu.noteCreated'), 'success')
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus(t('app.menu.noteCreateFailed', { message }), 'error')
        return false
      }
    },
    [dispatchOpenDocumentInTab, refreshFileTree, rootDir, setExpandedDirs, setStatus, t],
  )

  const appendWikiLinkBetweenNotes = useCallback(
    async (args: { sourceDocKey: string; targetDocKey: string; targetTitle?: string }) => {
      if (!rootDir) return false
      return appendWikiLinkToDocument({
        rootDir,
        getCurrentRootDir: () => rootDirRef.current,
        promptWorkspacePassword,
        sourceDocKey: args.sourceDocKey,
        targetDocKey: args.targetDocKey,
        targetTitle: args.targetTitle,
        activePath: activePathRef.current,
        contentRef,
        readDocument,
        flushActiveVisualMarkdown: () => {
          if (mainPaneModeRef.current !== 'visual') return null
          try {
            return visualEditorRef.current?.flushPendingMarkdownSync(true, false) ?? null
          } catch {
            return null
          }
        },
        t,
        onConflict: async (path, local) => {
          await openSaveConflictDialog({
            rootDir,
            path,
            local,
            sourceMode: 'manual',
            setSaveConflict,
            setStatus,
            t,
          })
        },
        onWriteError: (message) => {
          setStatus(t('app.status.saveFailed', { message }), 'error')
        },
      })
    },
    [promptWorkspacePassword, rootDir, rootDirRef, contentRef, setStatus, t, visualEditorRef, mainPaneModeRef],
  )

  const removeWikiLinkBetweenNotes = useCallback(
    async (args: {
      sourceDocKey: string
      targetDocKey: string
      heading?: string
      kind?: 'link' | 'embed'
      start?: number
      end?: number
    }) => {
      if (!rootDir) return false
      return removeWikiLinkFromDocument({
        rootDir,
        getCurrentRootDir: () => rootDirRef.current,
        promptWorkspacePassword,
        sourceDocKey: args.sourceDocKey,
        targetDocKey: args.targetDocKey,
        heading: args.heading,
        kind: args.kind,
        start: args.start,
        end: args.end,
        activePath: activePathRef.current,
        contentRef,
        readDocument,
        flushActiveVisualMarkdown: () => {
          if (mainPaneModeRef.current !== 'visual') return null
          try {
            return visualEditorRef.current?.flushPendingMarkdownSync(true, false) ?? null
          } catch {
            return null
          }
        },
        t,
        onConflict: async (path, local) => {
          await openSaveConflictDialog({
            rootDir,
            path,
            local,
            sourceMode: 'manual',
            setSaveConflict,
            setStatus,
            t,
          })
        },
        onWriteError: (message) => {
          setStatus(t('app.status.saveFailed', { message }), 'error')
        },
      })
    },
    [promptWorkspacePassword, rootDir, rootDirRef, contentRef, setStatus, t, visualEditorRef, mainPaneModeRef],
  )

  const knowledgeInteractionHost = useMemo(
    () => ({
      getRootDir: () => rootDir,
      openAbsolutePath: (absolutePath: string) => {
        if (!rootDir) return
        void dispatchOpenDocumentInTab(rootDir, absolutePath, 'knowledge-link-click')
      },
      clearEditorSelection: clearEditorSelectionForNavigation,
      focusEditor: focusActiveEditor,
      insertWikiLinkAtCursor,
      appendWikiLinkBetweenNotes,
      removeWikiLinkBetweenNotes,
      onHoverIdChange: syncWikiHoverId,
      openSearchModal: openKnowledgeSearchModal,
      revealNavigationAnchor,
      updateDocumentFrontmatter: async (
        docKey: string,
        updater: (current: Record<string, unknown>) => Record<string, unknown>,
      ) => {
        if (!rootDir) return false
        return applyDocumentFrontmatterUpdate({
          rootDir,
          getCurrentRootDir: () => rootDirRef.current,
          promptWorkspacePassword,
          docKey,
          activePath: activePathRef.current,
          contentRef,
          readDocument,
          updater,
          t,
          onConflict: async (path, local) => {
            await openSaveConflictDialog({
              rootDir,
              path,
              local,
              sourceMode: 'manual',
              setSaveConflict,
              setStatus,
              t,
            })
          },
          onWriteError: (message) => {
            setStatus(t('app.status.saveFailed', { message }), 'error')
          },
        })
      },
    }),
    [
      appendWikiLinkBetweenNotes,
      clearEditorSelectionForNavigation,
      dispatchOpenDocumentInTab,
      focusActiveEditor,
      insertWikiLinkAtCursor,
      openKnowledgeSearchModal,
      promptWorkspacePassword,
      removeWikiLinkBetweenNotes,
      revealNavigationAnchor,
      rootDir,
      rootDirRef,
      setStatus,
      syncWikiHoverId,
      t,
    ],
  )

  useKnowledgeShellController({
    rootDir,
    activePath,
    openedTabs,
    knowledgeRailVisible,
    workspaceSyncTick,
    workspaceRestoringRef,
    interactionHost: knowledgeInteractionHost,
  })

  useEffect(() => subscribeThemeRuntime(), [])
  useSyncWindowTitle(windowTitleDocument, windowTitleWorkspace, APP_DISPLAY_NAME)

  // Initialize EditorMutationBridge — must run before any command executes.
  // The bridge holds React refs (not values), so it always sees the latest editor
  // instance without needing to be re-called on every render.
  useEffect(() => {
    initEditorMutationBridge(visualEditorRef, editorViewRef, mainPaneModeRef)
  }, [visualEditorRef, editorViewRef, mainPaneModeRef])

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
    if (!activePath) return
    if (startupDocumentRuntimeLoggedRef.current === activePath) return
    startupDocumentRuntimeLoggedRef.current = activePath
    markBootPhase('startup_document_runtime_active', { activePath })
    logInfo('[PERF] startup_editor_stage', {
      stage: 'document_runtime_active',
      activePath,
      bootReadyToDocumentRuntimeMs: measureBootSince('theme_applied', 'startup_document_runtime_active'),
      restoreStartToDocumentRuntimeMs: measureBootSince(
        'workspace_restore_effect_start',
        'startup_document_runtime_active',
      ),
    })
  }, [activePath])

  useEffect(() => {
    if (!activePath || mainPaneMode !== 'visual') return
    if (startupVisualEditorReadyLoggedRef.current === activePath) return
    let cancelled = false
    const checkReady = () => {
      if (cancelled) return
      const handle = visualEditorRef.current
      const boundDocumentKey = handle?.getBoundDocumentKey() ?? null
      if (handle?.getEditor() && boundDocumentKey === activePath) {
        startupVisualEditorReadyLoggedRef.current = activePath
        markBootPhase('startup_visual_editor_ready', { activePath })
        logInfo('[PERF] startup_editor_stage', {
          stage: 'visual_editor_ready',
          activePath,
          bootReadyToVisualEditorReadyMs: measureBootSince('theme_applied', 'startup_visual_editor_ready'),
          restoreStartToVisualEditorReadyMs: measureBootSince(
            'workspace_restore_effect_start',
            'startup_visual_editor_ready',
          ),
          documentRuntimeToVisualEditorReadyMs: measureBootSince(
            'startup_document_runtime_active',
            'startup_visual_editor_ready',
          ),
        })
        return
      }
      requestAnimationFrame(checkReady)
    }
    checkReady()
    return () => {
      cancelled = true
    }
  }, [activePath, mainPaneMode, visualEditorRef])

  useEffect(() => {
    localStorage.setItem('sidebarVisible', sidebarVisible ? '1' : '0')
  }, [sidebarVisible])

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    persistSidebarPanelView(sidebarPanelView)
  }, [sidebarPanelView])

  useEffect(() => {
    localStorage.setItem('fileSortMode', fileSortMode)
  }, [fileSortMode])

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
    localStorage.setItem('knowledgeRailVisible', knowledgeRailVisible ? '1' : '0')
  }, [knowledgeRailVisible])

  useEffect(() => {
    localStorage.setItem('aiPanelVisible', aiPanelVisible ? '1' : '0')
  }, [aiPanelVisible])

  useEffect(() => {
    return subscribeAiPanelStore(() => {
      if (!consumeAiPanelOpenRequest()) return
      setAiPanelVisible(true)
      setEditorRightRailView('ai')
    })
  }, [setEditorRightRailView])








  const onWikiLinkNavigate = useCallback((target: unknown) => {
    const wikiTarget = target as WikiLinkTarget
    const resolved = resolveWikiTarget(wikiTarget)
    if (resolved.resolvedDocKey) {
      dispatchKnowledgeNavigate('editor', asMetadataResolvedTarget(wikiTarget, 'compiler'))
      return
    }
    void createNoteFromWikiTarget(wikiTarget)
  }, [createNoteFromWikiTarget])

  const onEmbeddedHtmlLinkNavigate = useCallback((target: EmbeddedHtmlWorkspaceNoteTarget) => {
    dispatchOpenNoteNavigation(target.absolutePath, 'editor', {
      docKey: target.docKey,
      interactionSource: 'editor',
      heading: target.fragment,
    })
  }, [])

  const onEmbeddedHtmlHashNavigate = useCallback((fragment: string) => {
    if (!fragment.trim()) return
    visualEditorRef.current?.scrollToHeading(fragment)
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

  const reloadDocumentFromDisk = useDocumentReloadFromDisk({
    rootDir,
    activePathRef,
    t,
    setStatus,
    setSaveConflict,
    setExternalDiskChangedPaths,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    refreshActiveEditorAfterPathReload,
    confirmAppDialog,
  })

  const handleTabContextPickWithReload = useCallback(
    (action: import('./workspace/contextMenuTypes').TabContextMenuPick, path: string, index: number) => {
      if (action === 'reloadFromDisk') {
        setTabContextMenu(null)
        void reloadDocumentFromDisk(path)
        return
      }
      handleTabContextPick(action, path, index)
    },
    [handleTabContextPick, reloadDocumentFromDisk],
  )
  const {
    closeDocumentHistoryDialog,
    saveConflictResolving,
    onSaveConflictCancel,
    onSaveConflictUseDisk,
    onSaveConflictKeepLocal,
    onDocumentHistoryRestore,
    onDocumentHistoryCreateSnapshot,
    onDocumentHistoryConfirmDelete,
    onDocumentHistoryDeleteAll,
  } = useDocumentOverlaysController({
    t,
    rootDir,
    rootDirRef,
    promptWorkspacePassword,
    saveConflict,
    setSaveConflict,
    setDocumentHistoryDialog,
    flushEditorToMemory: flushEditorToMemoryViaRef,
    refreshActiveEditorAfterPathReload,
    markWorkspaceRefreshSuppressed: () => {
      suppressWorkspaceRefreshUntilRef.current = Date.now() + 2500
    },
    setSavedAt,
    setStatus,
    setExternalDiskChangedPaths,
    confirmAppDialog,
  })
  const saveConflictOverlayState = useMemo(
    () => ({
      open: saveConflict != null,
      path: saveConflict?.path ?? '',
      base: saveConflict?.base ?? '',
      local: saveConflict?.local ?? '',
      disk: saveConflict?.disk ?? '',
      diskReadable: saveConflict?.diskReadable ?? true,
      sourceMode: (saveConflict?.sourceMode ?? 'manual') as 'manual' | 'autosave' | 'external',
      resolving: saveConflictResolving,
      onCancel: onSaveConflictCancel,
      onUseDisk: onSaveConflictUseDisk,
      onKeepLocal: onSaveConflictKeepLocal,
    }),
    [
      onSaveConflictCancel,
      onSaveConflictKeepLocal,
      onSaveConflictUseDisk,
      saveConflict,
      saveConflictResolving,
    ],
  )
  const documentHistoryOverlayState = useMemo(
    () => ({
      open: documentHistoryDialog != null,
      rootDir: documentHistoryDialog?.rootDir ?? '',
      path: documentHistoryDialog?.path ?? '',
      activePath,
      onClose: closeDocumentHistoryDialog,
      onRestore: onDocumentHistoryRestore,
      onCreateSnapshot: onDocumentHistoryCreateSnapshot,
      onConfirmDelete: onDocumentHistoryConfirmDelete,
      onDeleteAll: onDocumentHistoryDeleteAll,
      flushEditorToMemory: flushEditorToMemoryViaRef,
    }),
    [
      closeDocumentHistoryDialog,
      documentHistoryDialog,
      activePath,
      onDocumentHistoryConfirmDelete,
      onDocumentHistoryCreateSnapshot,
      onDocumentHistoryDeleteAll,
      onDocumentHistoryRestore,
    ],
  )
  return (
    <div
      className="app-shell workspace workspace-root"
      data-testid="app-shell"
      {...shellDragProps}
    >
      <WorkspaceExternalDropOverlay t={t} visible={externalDragActive} zone={dropZone} />
      {inAppMenuBar ? (
        <AppMenuBar
          recentWorkspaces={recentWorkspaces}
          recentFiles={recentFiles}
          onRunAction={onAppMenuBarAction}
          onOpenRecent={onAppMenuBarOpenRecent}
          onOpenRecentWorkspace={onAppMenuBarOpenRecentWorkspace}
        />
      ) : null}
    <div
      className={`layout workspace-split mod-root ${sidebarVisible && !focusMode ? 'with-sidebar' : 'without-sidebar'} ${focusMode ? 'focus-mode' : ''} ${editorRightRailOpen ? 'with-knowledge-rail' : ''}`}
      style={
        sidebarVisible && !focusMode
          ? ({
              '--sidebar-width': `${Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, sidebarWidth))}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {sidebarVisible && !focusMode && (
        <AppSidebarPanel
          t={t}
          locale={effectiveLocale}
          rootDir={rootDir}
          activePath={activePath}
            mainPaneMode={mainPaneMode}
            knowledgeRailVisible={knowledgeRailVisible}
            onOpenKnowledgePanel={() => {
              setKnowledgeRailVisible(true)
              setEditorRightRailView('knowledge')
            }}
            onToggleMainPaneMode={() => toggleMainPaneMode()}
          searchText={searchText}
          setSearchText={setSearchText}
          isSidebarFiltering={isSidebarFiltering}
          sidebarFilterMatchCount={sidebarFilterMatchCount}
          sidebarPanelView={sidebarPanelView}
          setSidebarPanelView={setSidebarPanelView}
          draggingWorkspaceFile={draggingWorkspaceFile}
          dragOverTarget={dragOverTarget}
          setDragOverTarget={setDragOverTarget}
          onSidebarBlankContextMenu={onSidebarBlankContextMenu}
          onSidebarFileContextMenu={onSidebarFileContextMenu}
          outlineHeadings={outlineHeadings}
          activeOutlineId={activeOutlineId}
          scrollPreviewToHeading={scrollPreviewToHeading}
          fileTree={fileTree}
          workspaceFolderNodes={workspaceFolderNodes}
          sortedFlatWorkspaceFiles={sortedFlatWorkspaceFiles}
          noteCalendarEdits={noteCalendarEdits}
          noteCalendarPreferPersistedOnly={noteCalendarPreferPersistedOnly}
          sortedFileTree={sortedFileTree}
          expandedDirs={expandedDirs}
          toggleWorkspaceDir={toggleWorkspaceDir}
          isFilePathSelected={isFilePathSelected}
          onWorkspaceFileClick={onWorkspaceFileClick}
          onWorkspaceFilePointerDown={onWorkspaceFilePointerDown}
          handleMoveFileToFolder={handleMoveFileToFolder}
          createNewNote={createNewNote}
          createNewNoteFromTemplate={createNewNoteFromTemplate}
          createNewFolder={createNewFolder}
          workspaceFolderName={workspaceFolderName}
          workspaceMenuRef={workspaceMenuRef}
          workspaceMenuPopRef={workspaceMenuPopRef}
          workspaceMenuOpen={workspaceMenuOpen}
          setWorkspaceMenuOpen={setWorkspaceMenuOpen}
          workspaceMenuPopStyle={workspaceMenuPopStyle}
          fileSortMode={fileSortMode}
          setFileSortMode={setFileSortMode}
          setStatus={setStatus}
          chooseFolder={chooseFolder}
          refreshFileTree={refreshFileTree}
          sidebarStatusLine={
            (isSidebarFiltering
              ? sidebarFilterMatchCount > 0
                ? t('app.sidebar.search.filterCount', { count: sidebarFilterMatchCount })
                : t('app.sidebar.search.filterEmpty')
              : status || t('app.status.pickFolder', { app: APP_DISPLAY_NAME })) +
            (savedAt ? ' ' + t('app.search.savedAt', { time: savedAt }) : '')
          }
          contextMenuFilePath={fileContextMenu?.path ?? null}
        />
      )}
      {sidebarVisible && !focusMode && (
        <div
          className="resize-handle resize-handle-sidebar"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('app.sidebar.resize')}
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onKeyDown={(e) => {
            handleVerticalResizeKeyDown(e, {
              value: sidebarWidth,
              min: SIDEBAR_WIDTH_MIN,
              max: SIDEBAR_WIDTH_MAX,
              step: SIDEBAR_WIDTH_STEP,
              onChange: setSidebarWidth,
            })
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.preventDefault()
            const handle = e.currentTarget
            const startX = e.clientX
            const startWidth = sidebarWidth
            beginVerticalSplitDrag({
              handle,
              pointerId: e.pointerId,
              onMove: (clientX) => {
                const next = startWidth + (clientX - startX)
                setSidebarWidth(Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, next)))
              },
            })
          }}
          title={t('app.sidebar.resize')}
        />
      )}
      <AppEditorMain
        t={t}
        mainWithRailRef={mainWithRailRef}
        knowledgeRailOpen={editorRightRailOpen}
        editorBodyFocused={editorBodyFocused}
        setEditorBodyFocused={setEditorBodyFocused}
        focusMode={focusMode}
        activePath={activePath}
        workspaceFolderName={workspaceFolderName}
        tabLabel={tabLabel}
        setFocusMode={setFocusMode}
        sidebarListMode={sidebarListMode}
        rootDir={rootDir}
        knowledgeRailVisible={knowledgeRailVisible}
        setKnowledgeRailVisible={setKnowledgeRailVisible}
        aiPanelVisible={aiPanelVisible}
        setAiPanelVisible={setAiPanelVisible}
        setEditorRightRailView={setEditorRightRailView}
        onReloadFromDisk={reloadDocumentFromDisk}
        openedTabs={openedTabs}
        externalDiskChangedPaths={externalDiskChangedPaths}
        activateTab={activateTab}
        closeTab={closeTab}
        onTabContextMenu={onTabContextMenu}
        onReorderOpenedTabs={(from, to) => void reorderOpenedTabs(from, to)}
        mainPaneMode={mainPaneMode}
        panesRef={panesRef}
        editorSurfaceStyle={editorSurfaceStyle}
        setFileContextMenu={setFileContextMenu}
        setEditorDocMenu={setEditorDocMenu}
        visualEditorRef={visualEditorRef}
        content={content}
        handleEditorContentChange={handleEditorContentChange}
        setActiveOutlineId={setActiveOutlineId}
        setStatus={setStatus}
        pasteImageIntoVisualEditor={pasteImageIntoVisualEditor}
        dropFilesIntoActiveNote={dropFilesIntoActiveNote}
        pickAndImportLunaAsset={pickAndImportLunaAsset}
        handleLunaAssetLinkClick={handleLunaAssetLinkClick}
        getLunaAssetTooltip={getLunaAssetTooltip}
        onWikiLinkNavigate={onWikiLinkNavigate}
        onEmbeddedHtmlLinkNavigate={onEmbeddedHtmlLinkNavigate}
        onEmbeddedHtmlHashNavigate={onEmbeddedHtmlHashNavigate}
        atomicVisualDocumentEnter={atomicVisualDocumentEnter}
        onAtomicVisualDocumentEnterConsumed={onAtomicVisualDocumentEnterConsumed}
        editorOpenReason={editorOpenReason}
        handleWikiHover={handleWikiHover}
        suppressMarkdownSerdeRef={suppressMarkdownSerdeRef}
        cmMountKey={cmMountKey}
        visualMountKey={visualMountKey}
        editorExtensions={editorExtensions}
        handleSourceViewReady={handleSourceViewReady}
        statusbarVisible={statusbarVisible}
        status={status}
        statusTone={statusTone}
        workspaceSessionState={workspaceSessionSnapshot.state}
        savedAt={savedAt}
        contentStats={contentStats}
        selectionStats={selectionStats}
        isLargeDoc={isLargeDoc}
        sourceCodeMirrorBootSelectionRef={sourceCodeMirrorBootSelectionRef}
        createNewNote={createNewNote}
        chooseFolder={chooseFolder}
        toolbarEditorFormat={toolbarEditorFormat}
        onFormatCommand={onFormatCommand}
        editorHasTextSelection={editorHasTextSelection}
        isFormatCommandActive={isFormatCommandActive}
        onEditorTextColorPick={applyEditorTextColor}
        onVisualSelectionActivity={bumpVisualSelection}
        visualSelectionTick={visualSelectionTick}
        onOutlineHeadingsChange={handleOutlineHeadingsChange}
        editorDocumentLoading={editorDocumentLoading}
        modeSwitchLoading={modeSwitchLoading}
        onOpenGlobalSearch={rootDir.trim() ? openGlobalSearchModal : undefined}
        onSaveActiveDocument={() => void saveCurrent()}
        knowledgeRailSlot={
          editorRightRailOpen ? (
            <>
              <KnowledgeSurfaceSplitHandle
                onPointerDown={surfaceSplit.onSplitterPointerDown}
                onRailWidthChange={surfaceSplit.adjustRailWidth}
              />
              <EditorRightRailContainer
                t={t}
                knowledgeOpen={knowledgeRailOpen}
                aiOpen={aiRailOpen}
                activeView={editorRightRailView}
                onActiveViewChange={setEditorRightRailView}
                knowledgePanel={
                  <KnowledgeRightRail
                    visible
                    activeDocKey={activeDocKey}
                    searchOpen={knowledgeSearchOpen}
                    searchQuery={knowledgeSearchQuery}
                    onSearchOpenChange={setKnowledgeSearchOpen}
                    onSearchQueryChange={setKnowledgeSearchQuery}
                    onClose={() => {
                      closeKnowledgeSearch()
                      setKnowledgeRailVisible(false)
                    }}
                  />
                }
                aiPanel={
                  <AiRightRail
                    visible
                    panelActive={!knowledgeRailOpen || editorRightRailView === 'ai'}
                    workspaceRoot={rootDir}
                    activeDocKey={activeDocKey}
                    activePath={activePath}
                    activeTabLabel={activePath ? tabLabel(activePath) : null}
                    content={content}
                    visualEditorRef={visualEditorRef}
                    selectionTick={visualSelectionTick}
                    onClose={() => setAiPanelVisible(false)}
                  />
                }
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
        onGlobalSearchClose={closeGlobalSearch}
        globalSearchInputRef={globalSearchInputRef}
        rootDir={rootDir}
        workspaceSearchIndex={sidebarSearchIndex}
        onGlobalSearchOpenDocument={openDocumentFromGlobalSearch}
        quickSwitcherOpen={quickSwitcherOpen}
        quickSwitcherQuery={quickSwitcherQuery}
        onQuickSwitcherQueryChange={setQuickSwitcherQuery}
        onQuickSwitcherClose={closeQuickSwitcher}
        quickSwitcherInputRef={quickSwitcherInputRef}
        recentFilePaths={recentFiles}
        onQuickSwitcherOpenDocument={dispatchOpenDocumentInTab}
        tabSwitcherOpen={tabSwitcherOpen}
        tabSwitcherQuery={tabSwitcherQuery}
        onTabSwitcherQueryChange={setTabSwitcherQuery}
        onTabSwitcherClose={closeTabSwitcher}
        tabSwitcherInputRef={tabSwitcherInputRef}
        openedTabPaths={openedTabs}
        tabMruPaths={tabMruRef.current}
        tabLabel={tabLabel}
        onTabSwitcherActivate={(path) => {
          closeTabSwitcher()
          void activateTab(path, 'tab-switcher')
        }}
        wikiHoverId={wikiHoverId}
        commandPaletteOpen={commandPaletteOpen}
        commandPaletteQuery={commandPaletteQuery}
        commandPaletteIndex={commandPaletteIndex}
        commandPaletteInputRef={commandPaletteInputRef}
        paletteFiltered={paletteFiltered}
        onCommandPaletteClose={closeCommandPalette}
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
        workspacePasswordDialog={workspacePasswordDialog}
        onWorkspacePasswordSubmit={(password, confirmPassword) =>
          closeWorkspacePasswordDialog({ password, confirmPassword })
        }
        onWorkspacePasswordCancel={() => closeWorkspacePasswordDialog(null)}
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
        onRenameTemplateChange={handleRenameTemplateChange}
        fileContextMenu={fileContextMenu}
        fileContextMenuRef={fileContextMenuRef}
        onFileContextPick={handleFileContextPick}
        editorDocMenu={editorDocMenu}
        editorDocMenuRef={editorDocMenuRef}
        editorDiskFileReady={editorDiskFileReady}
        editorCanRevealInOs={editorCanRevealInOs}
        onEditorDocMenuPick={handleEditorDocMenuPick}
        tabContextMenu={tabContextMenu}
        tabContextMenuRef={tabContextMenuRef}
        externalDiskChangedPaths={externalDiskChangedPaths}
        onTabContextPick={handleTabContextPickWithReload}
        saveConflictState={saveConflictOverlayState}
        documentHistoryState={documentHistoryOverlayState}
      />
      <AppToastHost />
    </div>
    </div>
  )
}

export default App
