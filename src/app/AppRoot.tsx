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
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react'
import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
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
import { isModeSwitchFreezeError } from '../editor/modeSwitchFreezeFailure'
import { VIEWPORT_DOCUMENT_NODE_ID, viewportAnchorEngine } from '../editor/viewportAnchorEngine'
import { useSidebarOutlineHeadings } from './hooks/useSidebarOutlineHeadings'
import type { TocHeading } from './components/DocumentOutlineBlock'
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
  clearRecentFilesStorage,
  mergeRecentFilePath,
  readRecentFilesFromStorage,
} from '../lib/recentFilesStorage'
import { isValidRecentFilePath, pathsEqual, relativePathUnderRoot } from '../lib/workspacePathUtils'
import { useAppStatus } from './hooks/useAppStatus'
import { useLargeDocPerformanceHint } from './hooks/useLargeDocPerformanceHint'
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
import {
  useHistoryAndConflictOverlays,
  type HistoryDialogState,
} from './hooks/useHistoryAndConflictOverlays'
import { useWorkspaceSidebar } from './hooks/useWorkspaceSidebar'
import { useSourceEditorExtensions } from './hooks/useSourceEditorExtensions'
import { useAssetHandlers } from './hooks/useAssetHandlers'
import { useWorkspaceExternalFileDrop } from './hooks/useWorkspaceExternalFileDrop'
import { WorkspaceExternalDropOverlay } from './components/WorkspaceExternalDropOverlay'
import { useEditorCommands } from './hooks/useEditorCommands'
import { useEditorDocMenu } from './hooks/useEditorDocMenu'
import { useEditorHasTextSelection, useEditorFormatToolbarActive, useEditorTextColor } from './hooks/useEditorTextColor'
import {
  createInitialAppMenuContext,
  createInitialAppMenuUiDeps,
  useAppCommandHosts,
} from './hooks/useAppCommandHosts'
import { useAppMenuAndShortcuts } from './hooks/useAppMenuAndShortcuts'
import { useMacNativeAppMenu } from './hooks/useMacNativeAppMenu'
import { useMacNativeFullscreenSync } from './components/MacNativeMenuEarlyUpgrade'
import { useAppBootstrap } from './hooks/useAppBootstrap'
import {
  resolveOrCreateDailyNotePath,
  shouldOpenDailyNoteOnStartup,
} from '../templates/dailyNoteService'
import { useQuickCapture } from './hooks/useQuickCapture'
import { ensureDefaultTemplateFiles } from '../templates/templateService'
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
import { handleVerticalResizeKeyDown } from '../lib/verticalResizeKeyboard'
import { useI18n } from '../i18n'
import '../editor/knowledgeOS/ui/knowledgePanels.css'
import { absolutePathToDocKeyOs } from '../editor/knowledgeOS'
import { KnowledgeRightRail } from '../editor/knowledgeOS/ui/KnowledgeRightRail'
import { KnowledgeSurfaceSplitHandle } from '../editor/knowledgeOS/ui/KnowledgeSurfaceSplitHandle'
import { useSurfaceSplitLayout } from '../editor/knowledgeOS/ui/useSurfaceSplitLayout'
import { AppMenuBar } from './AppMenuBar'
import { usesInAppMenuBar, usesNativeMacAppMenu } from './shellPlatform'
import { resolveWikiLinkTargetAtCmPos } from '../editor/compiler/wikiInteractionMetadata'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigate,
  dispatchWikiHover,
} from '../editor/knowledgeOS/ui/interactionTransaction'
import { beginNavigationReveal } from '../editor/knowledgeOS/editorNavigationReadiness'
import { applyDocumentFrontmatterUpdate } from './document/applyDocumentFrontmatter'
import { setTabBody } from './document/tabBodiesStore'
import { readDocument } from '../io/documentIO'
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
import { normalizeEditorColumnWidth } from '../settings-runtime/editorColumnWidth'
import {
  getDocumentRuntimeSnapshot,
  subscribeDocumentRuntime,
} from '../documentRuntime/documentKernel'
import { subscribeThemeRuntime } from '../theme-runtime/themeRuntime'
import { useSyncWindowTitle } from './hooks/useSyncWindowTitle'
import {
  APP_DISPLAY_NAME,
  LARGE_DOC_THRESHOLD,
  isBufferTabId,
} from './workspace/constants'
import type {
  FileSortMode,
  RenameDialogState,
} from './workspace/types'
import type { WorkspaceDragTarget } from './workspace/workspaceDrag'
import type { EditorDocMenuState, FileContextMenuState } from './workspace/contextMenuTypes'
import type { SaveConflictState } from './document/saveConflictState'
const SIDEBAR_WIDTH_MIN = 240
const SIDEBAR_WIDTH_MAX = 520
const SIDEBAR_WIDTH_STEP = 16

function App() {
  const {
    t,
    effectiveLocale,
    paletteCommands: compiledPaletteCommands,
    toolbarEditorFormat,
  } = useI18n()
  const inAppMenuBar = useMemo(() => usesInAppMenuBar(), [])
  const nativeMacAppMenu = useMemo(() => usesNativeMacAppMenu(), [])

  const onFormatCommand = useCallback((commandId: string) => {
    void executeManifestCommand(commandId, appMenuCtxRef.current, paletteUiDepsRef.current)
  }, [])

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
  const { status, statusTone, setStatus } = useAppStatus()
  const [searchText, setSearchText] = useState('')
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
      ? 'Mode switch restore failed'
      : error instanceof Error
        ? error.message
        : String(error)
    setStatus(tRef.current('app.status.operationFailed', { message }))
    dispatchModeSwitchFsm({ type: 'ENHANCEMENT_FAILED', error })
  }, [setStatus])
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
  const closeGlobalSearch = useCallback(() => setGlobalSearchOpen(false), [])
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
  const openGlobalSearchModal = useCallback(() => {
    if (!rootDirRef.current.trim()) {
      setStatus(tRef.current('app.menu.openWorkspaceFirst'))
      return
    }
    setKnowledgeSearchOpen(false)
    setGlobalSearchQuery('')
    setGlobalSearchOpen(true)
  }, [setStatus])
  const openKnowledgeSearchModal = useCallback(() => {
    setGlobalSearchOpen(false)
    setKnowledgeSearchQuery('')
    setFocusMode(false)
    setKnowledgeRailVisible(true)
    setKnowledgeSearchOpen(true)
  }, [setFocusMode, setKnowledgeRailVisible])
  const [wikiHoverId, setWikiHoverId] = useState<string | null>(null)
  const wikiHoverIdRef = useRef<string | null>(null)
  const wikiHandlersRef = useRef<WikiLinkEditorHandlers | null>(null)
  const wikiTargetResolverRef = useRef<((pos: number) => WikiLinkTarget | null) | null>(null)
  const paletteCommandDefs = useMemo((): PaletteCommandDef[] => compiledPaletteCommands, [compiledPaletteCommands])
  const setActiveOutlineIdRef = useRef<(id: string) => void>(() => {})
  const [activeOutlineId, setActiveOutlineId] = useState('')
  const outlineActiveByPathRef = useRef(new Map<string, string>())
  const openedTabs = documentSnapshot.openedTabs
  const [bufferTabLabels, setBufferTabLabels] = useState<Record<string, string>>({})
  const [recentFiles, setRecentFiles] = useState<string[]>(readRecentFilesFromStorage)

  const updateRecent = useCallback((path: string) => {
    setRecentFiles((prev) => mergeRecentFilePath(prev, path))
  }, [])

  const clearRecentFiles = useCallback(async () => {
    if (!recentFiles.some(isValidRecentFilePath)) return
    const confirmed = await confirmAppDialog({
      title: t('app.confirm.clearRecent.title'),
      message: t('app.confirm.clearRecent.message'),
      variant: 'warning',
    })
    if (!confirmed) return
    setRecentFiles(clearRecentFilesStorage())
    setStatus(t('app.status.recentCleared'))
  }, [confirmAppDialog, recentFiles, setStatus, t])

  useEffect(() => {
    registerLunaSurfaceDispatch(dispatchEditorSurface)
    return unregisterLunaSurfaceDispatch
  }, [dispatchEditorSurface])

  useEffect(() => {
    initKnowledgeOS()
  }, [])

  const mainWithRailRef = useRef<HTMLElement | null>(null)

  const isLargeDoc = content.length >= LARGE_DOC_THRESHOLD

  useLargeDocPerformanceHint({ isLargeDoc, activePath, setStatus, t })

  const markdownOutlineHeadings = useSidebarOutlineHeadings(activePath, content)
  const liveOutlineByPathRef = useRef(new Map<string, TocHeading[]>())
  const [liveOutlineTick, setLiveOutlineTick] = useState(0)
  const handleOutlineHeadingsChange = useCallback((headings: TocHeading[]) => {
    const path = activePathRef.current
    if (!path || path === 'scratch') return
    liveOutlineByPathRef.current.set(path, headings)
    setLiveOutlineTick((tick) => tick + 1)
  }, [])
  const outlineHeadings = useMemo(() => {
    void liveOutlineTick
    if (mainPaneMode === 'visual' && activePath && liveOutlineByPathRef.current.has(activePath)) {
      return liveOutlineByPathRef.current.get(activePath)!
    }
    return markdownOutlineHeadings
  }, [mainPaneMode, activePath, markdownOutlineHeadings, liveOutlineTick])

  useLayoutEffect(() => {
    setActiveOutlineId(outlineActiveByPathRef.current.get(activePath) ?? '')
  }, [activePath, mainPaneMode])

  useEffect(() => {
    if (!activePath || !activeOutlineId) return
    outlineActiveByPathRef.current.set(activePath, activeOutlineId)
  }, [activePath, activeOutlineId])

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
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null)
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
  const [documentHistoryDialog, setDocumentHistoryDialog] = useState<HistoryDialogState | null>(null)
  const openDocumentHistoryDialog = useCallback((dialogRoot: string, dialogPath: string) => {
    setDocumentHistoryDialog({ rootDir: dialogRoot, path: dialogPath })
  }, [])
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
    flushEditorToMemoryRef,
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

  const {
    pasteImageHandlerRef,
    pasteImageIntoVisualEditor,
    pickAndImportLunaAsset,
    dropFilesIntoActiveNote,
    handleLunaAssetLinkClick,
    getLunaAssetTooltip,
  } = useAssetHandlers({
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
  })

  const { editorExtensions } = useSourceEditorExtensions({
    isLargeDoc,
    sidebarListMode,
    outlineSpyCtxRef,
    setActiveOutlineIdRef,
    setActiveOutlineId,
    wikiHandlersRef,
    wikiTargetResolverRef,
    pasteImageHandlerRef,
    editorViewRef,
  })
  const documentNavigationInProgressRef = useRef(false)
  const [editorDocumentLoading, setEditorDocumentLoading] = useState(false)

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
    documentNavigationInProgressRef,
    visualEditorRef,
    editorViewRef,
    kernelContentDebounceRef,
    pasteImageIntoVisualEditor,
    setStatus,
  })

  const { saveCurrent, saveAsCurrent, runAppExportFormat, runAppPrint } = useDocumentSave({
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
    cancelPendingKernelContentDebounce,
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
    showAppAlert,
    t,
  })

  const clearWorkspaceFileSelectionRef = useRef<(() => void) | null>(null)
  const dispatchOpenDocumentRef = useRef<(root: string, path: string, reason?: string) => Promise<void>>(async () => {})
  const dispatchOpenDocument = useCallback(async (root: string, path: string, reason?: string) => {
    await dispatchOpenDocumentRef.current(root, path, reason)
  }, [])

  const {
    openRenameDialog,
    openNewNoteDialog,
    openNewNoteFromTemplateDialog,
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
    clearWorkspaceFileSelectionRef,
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
    handleWorkspaceFileClick,
    clearWorkspaceFileSelection,
  } = useWorkspaceSidebar({
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
    dispatchOpenDocument,
    handleMoveFileToFolder,
    toggleDir,
    setExpandedDirs,
    tabLabel,
    setStatus,
  })

  clearWorkspaceFileSelectionRef.current = clearWorkspaceFileSelection

  const onWorkspaceFileClick = useCallback(
    (e: ReactMouseEvent, path: string) => {
      handleWorkspaceFileClick(path, {
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
      })
    },
    [handleWorkspaceFileClick],
  )

  const { externalDragActive, dropZone, shellDragProps } = useWorkspaceExternalFileDrop({
    t,
    rootDir,
    draggingWorkspaceFile,
    setStatus,
    setDragOverTarget,
    setExpandedDirs,
    refreshFileTree,
    handleMoveFileToFolder,
    dispatchOpenDocument,
    dropFilesIntoActiveNote,
  })

  const {
    saveAllOpenTabs,
    scratchNewDocument,
    scratchNewTab,
    dispatchOpenDocument: dispatchOpenDocumentImpl,
    dispatchOpenDocumentInTab,
    closeTab,
    onTabContextMenu,
    handleTabContextPick,
    reorderOpenedTabs,
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
    documentNavigationInProgressRef,
    setEditorDocumentLoading,
    tabNavGenerationRef,
    suppressWorkspaceRefreshUntilRef,
    saveAllDirtyDocumentsRef,
    leaveCurrentTabRef,
    flushEditorToMemoryRef,
    saveCurrent,
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
    cancelPendingKernelContentDebounce,
    documentHistoryOpen: documentHistoryDialog != null,
  })
  dispatchOpenDocumentRef.current = dispatchOpenDocumentImpl

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

  const handleRenameTemplateChange = useCallback((templatePath: string) => {
    setRenameDialog((prev) =>
      prev && prev.mode === 'newNoteFromTemplate' ? { ...prev, templatePath } : prev,
    )
  }, [])

  const openDailyNoteWithOffset = useCallback(
    async (dayOffset = 0) => {
      if (!rootDir.trim()) return 'no-workspace'
      const when = new Date()
      when.setDate(when.getDate() + dayOffset)
      const path = await resolveOrCreateDailyNotePath(rootDir, { date: when })
      if (!path) return 'disabled'
      await dispatchOpenDocumentInTab(rootDir, path, 'daily-note')
      return 'opened'
    },
    [rootDir, dispatchOpenDocumentInTab],
  )

  const dailyStartupRootRef = useRef('')
  useEffect(() => {
    if (!rootDir.trim()) return
    if (dailyStartupRootRef.current === rootDir) return
    dailyStartupRootRef.current = rootDir
    void (async () => {
      try {
        await ensureDefaultTemplateFiles(rootDir)
        if (await shouldOpenDailyNoteOnStartup(rootDir)) {
          await openDailyNoteWithOffset(0)
        }
      } catch {
        /* non-fatal */
      }
    })()
  }, [rootDir, openDailyNoteWithOffset])

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

  const [visualSelectionTick, setVisualSelectionTick] = useState(0)
  const bumpVisualSelection = useCallback(() => {
    setVisualSelectionTick((tick) => tick + 1)
  }, [])

  const editorTextColorDeps = useMemo(
    () => ({ mainPaneMode, visualEditorRef, editorViewRef, visualSelectionTick }),
    [mainPaneMode, visualSelectionTick],
  )
  const editorHasTextSelection = useEditorHasTextSelection(editorTextColorDeps)
  const isFormatCommandActive = useEditorFormatToolbarActive(editorTextColorDeps)
  const { applyEditorTextColor } = useEditorTextColor(editorTextColorDeps)

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
    flushEditorToMemory: () => flushEditorToMemoryRef.current(),
    refreshFileTree,
    setFileTree,
    setExpandedDirs,
    setStatus,
    updateRecent,
    setRecentFiles,
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
    sidebarVisible,
    sidebarListMode,
    openGlobalSearchModal,
    setStatusbarVisible,
    setAboutOpen,
    setCommandPaletteOpen,
    setCommandPaletteQuery,
    setCommandPaletteIndex,
    openDocumentHistoryDialog,
    pendingSourceModeAnchorRef,
    resetModeSwitchEditorBootstrap,
    closeTab,
  })

  useQuickCapture({
    onOpenTodayDailyNote: () =>
      void executeManifestCommand('daily-note-open', appMenuCtxRef.current, paletteUiDepsRef.current),
  })

  const { paletteFiltered, runPaletteCommand } = useAppMenuAndShortcuts({
    recentFiles,
    saveCurrent,
    saveAsCurrent,
    toggleMainPaneMode,
    pastePlainFromClipboard,
    setFocusMode,
    globalSearchOpen,
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
    paletteCommandDefs,
    activePathRef,
    documentHistoryOpen: documentHistoryDialog != null,
    appMenuCtxRef,
    paletteUiDepsRef,
  })

  useMacNativeAppMenu({
    enabled: nativeMacAppMenu,
    t,
    recentFiles,
    locale: effectiveLocale,
  })

  useMacNativeFullscreenSync(nativeMacAppMenu)

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
        void dispatchOpenDocumentInTab(rootDir, absolutePath, 'knowledge-link-click')
      },
      clearEditorSelection: clearEditorSelectionForNavigation,
      focusEditor: focusActiveEditor,
      onHoverIdChange: syncWikiHoverId,
      openSearchModal: openKnowledgeSearchModal,
      revealNavigationAnchor,
      updateDocumentFrontmatter: async (docKey, updater) => {
        if (!rootDir) return false
        return applyDocumentFrontmatterUpdate({
          rootDir,
          docKey,
          activePath: activePathRef.current,
          contentRef,
          setTabBody,
          readDocument,
          updater,
        })
      },
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
    if (!searchText.trim() || sidebarListMode !== 'outline') return
    setSidebarListMode('files')
    setStatus(t('app.sidebar.search.switchedToFilesForFilter'))
  }, [searchText, sidebarListMode, setSidebarListMode, setStatus, t])

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
  }, [rootDir, openedTabs, activePath, knowledgeRailVisible, workspaceRestoringRef])

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
  } = useHistoryAndConflictOverlays({
    t,
    rootDir,
    saveConflict,
    setSaveConflict,
    setDocumentHistoryDialog,
    flushEditorToMemory: () => flushEditorToMemoryRef.current(),
    refreshActiveEditorAfterPathReload,
    markWorkspaceRefreshSuppressed: () => {
      suppressWorkspaceRefreshUntilRef.current = Date.now() + 2500
    },
    setSavedAt,
    setStatus,
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
      sourceMode: (saveConflict?.sourceMode ?? 'manual') as 'manual' | 'autosave',
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
      onClose: closeDocumentHistoryDialog,
      onRestore: onDocumentHistoryRestore,
      onCreateSnapshot: onDocumentHistoryCreateSnapshot,
      onConfirmDelete: onDocumentHistoryConfirmDelete,
      onDeleteAll: onDocumentHistoryDeleteAll,
    }),
    [
      closeDocumentHistoryDialog,
      documentHistoryDialog,
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
              '--sidebar-width': `${Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, sidebarWidth))}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {sidebarVisible && !focusMode && (
        <AppSidebarPanel
          t={t}
          rootDir={rootDir}
          activePath={activePath}
          searchText={searchText}
          setSearchText={setSearchText}
          isSidebarFiltering={isSidebarFiltering}
          sidebarFilterMatchCount={sidebarFilterMatchCount}
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
          setSidebarFileView={setSidebarFileView}
          workspaceFolderNodes={workspaceFolderNodes}
          sortedFlatWorkspaceFiles={sortedFlatWorkspaceFiles}
          sortedFileTree={sortedFileTree}
          expandedDirs={expandedDirs}
          toggleWorkspaceDir={toggleWorkspaceDir}
          isFilePathSelected={isFilePathSelected}
          onWorkspaceFileClick={onWorkspaceFileClick}
          onWorkspaceFilePointerDown={onWorkspaceFilePointerDown}
          handleMoveFileToFolder={handleMoveFileToFolder}
          createNewNote={createNewNote}
          createNewNoteFromTemplate={createNewNoteFromTemplate}
          workspaceFolderName={workspaceFolderName}
          workspaceMenuRef={workspaceMenuRef}
          workspaceMenuPopRef={workspaceMenuPopRef}
          workspaceMenuOpen={workspaceMenuOpen}
          setWorkspaceMenuOpen={setWorkspaceMenuOpen}
          workspaceMenuPopStyle={workspaceMenuPopStyle}
          fileSortMode={fileSortMode}
          setFileSortMode={setFileSortMode}
          setSidebarListMode={setSidebarListMode}
          setStatus={setStatus}
          chooseFolder={chooseFolder}
          refreshFileTree={refreshFileTree}
          recentFiles={recentFiles}
          onOpenRecent={onAppMenuBarOpenRecent}
          onClearRecent={clearRecentFiles}
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
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = sidebarWidth
            const onMove = (moveEvent: MouseEvent) => {
              const next = startWidth + (moveEvent.clientX - startX)
              setSidebarWidth(Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, next)))
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
        activePath={activePath}
        workspaceFolderName={workspaceFolderName}
        tabLabel={tabLabel}
        setFocusMode={setFocusMode}
        sidebarListMode={sidebarListMode}
        rootDir={rootDir}
        knowledgeRailVisible={knowledgeRailVisible}
        setKnowledgeRailVisible={setKnowledgeRailVisible}
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
        savedAt={savedAt}
        contentStats={contentStats}
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
        onOutlineHeadingsChange={handleOutlineHeadingsChange}
        editorDocumentLoading={editorDocumentLoading}
        knowledgeRailSlot={
          knowledgeRailOpen ? (
            <>
              <KnowledgeSurfaceSplitHandle
                onPointerDown={surfaceSplit.onSplitterPointerDown}
                onRailWidthChange={surfaceSplit.adjustRailWidth}
              />
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
        onGlobalSearchOpenDocument={dispatchOpenDocumentInTab}
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
        onTabContextPick={handleTabContextPick}
        saveConflictState={saveConflictOverlayState}
        documentHistoryState={documentHistoryOverlayState}
      />
    </div>
    </div>
  )
}

export default App
