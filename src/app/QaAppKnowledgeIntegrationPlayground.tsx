import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import {
  absolutePathToDocKeyOs,
  initKnowledgeOS,
  onKnowledgeOSWorkspaceOpened,
  openNoteInWorkspace,
  refreshBacklinkPanel,
  setBacklinkPanelDocKey,
  syncNoteGraphTopologyFromRoute,
  getNoteGraphTopology,
} from '../editor/knowledgeOS/index'
import { getGraphViewport } from '../editor/knowledgeOS/graphViewportRuntime'
import { requestOsRevision } from '../editor/knowledgeOS/knowledgeUIBridge'
import { setPendingGraphCenter } from '../editor/knowledgeOS/graphNavigationRuntime'
import { KnowledgeRightRail } from '../editor/knowledgeOS/ui/KnowledgeRightRail'
import { handleVerticalResizeKeyDown } from '../lib/verticalResizeKeyboard'
import { beginVerticalSplitDrag } from '../lib/verticalSplitDrag'
import { KnowledgeSurfaceSplitHandle } from '../editor/knowledgeOS/ui/KnowledgeSurfaceSplitHandle'
import { useSurfaceSplitLayout } from '../editor/knowledgeOS/ui/useSurfaceSplitLayout'
import { registerKnowledgeInteractionHost } from '../editor/knowledgeOS/ui/knowledgeInteractionHost'
import {
  dispatchKnowledgeNavigateBack,
  dispatchKnowledgeNavigateForward,
} from '../editor/knowledgeOS/ui/interactionTransaction'
import { AiRightRail } from '../editor/ai/ui/AiRightRail'
import { initEditorMutationBridge } from '../editor/editorMutationBridge'
import '../editor/ai/ui/aiPanel.css'
import '../editor/knowledgeOS/ui/knowledgePanels.css'
import {
  bootstrapWorkspaceLinkGraphIndex,
  openVault,
  resetKnowledgeRuntime,
  waitForLinkIndexReady,
} from '../editor/knowledgeRuntime'
import type { AbsoluteDocPath } from '../editor/knowledgeRuntime/types'
import {
  dispatchDocumentCommand,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import { EditorOpenReason } from '../editor/editorOpenReason'
import { syncDocumentFrontmatterFromMarkdown } from '../editor/documentFrontmatterStore'
import { setSourceModeIdentity } from '../editor/sourceModeIdentity'
import { projectDocumentMemorySurfaces } from '../lib/editorContentSync'
import { TiptapMarkdownEditor, type TiptapMarkdownEditorHandle } from '../editor/TiptapMarkdownEditor'
import { installNavigationRuntimeFirewall } from '../navigation/navigationRuntimeFirewall'
import { pathsEqual } from '../lib/workspacePathUtils'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { AppSidebarPanel } from './components/AppSidebarPanel'
import type { TocHeading } from './components/DocumentOutlineBlock'
import { EditorRightRailContainer, type EditorRightRailView } from './components/EditorRightRailContainer'
import { EditorTabBar } from './components/EditorTabBar'
import { Icon } from '../design-system/icons'
import { installTabBodiesKernelSync, setTabBody } from './document/tabBodiesStore'
import { useSidebarOutlineHeadings } from './hooks/useSidebarOutlineHeadings'
import { useWorkspaceSidebar } from './hooks/useWorkspaceSidebar'
import { createQaKnowledgeFrontmatterUpdater } from './qa/createQaKnowledgeFrontmatterUpdater'
import {
  cloneQaKnowledgeFixtures,
  QA_KNOWLEDGE_FIXTURES,
  QA_KNOWLEDGE_ROOT,
  qaKnowledgeFixtureRelPath,
  qaKnowledgeNotePath,
} from './qa/qaKnowledgeFixtures'
import type { EditorDocMenuState, FileContextMenuState } from './workspace/contextMenuTypes'
import type { WorkspaceDragTarget } from './workspace/workspaceDrag'
import type { FileSortMode, FsTreeNode } from './workspace/types'
import type { SidebarPanelView } from './workspace/sidebarPanelView'
import {
  sidebarFileViewFromPanelView,
  sidebarListModeFromPanelView,
} from './workspace/sidebarPanelView'

const QA_TREE: FsTreeNode[] = Object.keys(QA_KNOWLEDGE_FIXTURES).map((name) => ({
  name,
  path: `${QA_KNOWLEDGE_ROOT}/${name}`,
  kind: 'file' as const,
  children: [],
}))

const SIDEBAR_WIDTH_MIN = 240
const SIDEBAR_WIDTH_MAX = 520
const SIDEBAR_WIDTH_STEP = 16

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const QA_AI_SETTINGS = {
  ...DEFAULT_APP_SETTINGS,
  ai: {
    provider: 'local' as const,
    baseUrl: 'http://127.0.0.1:9999',
    model: 'qa-mock-model',
    includeWorkspaceSearch: false,
    includeGraphNeighbors: false,
    conversationScope: 'per-note' as const,
  },
}

declare global {
  interface Window {
    __QA_APP_KNOWLEDGE__?: {
      workspaceRoot: () => string
      activePath: () => string | null
      activeDocKey: () => string | null
      openedTabPaths: () => string[]
      backlinkSourceTitles: () => string[]
      graphTopologyCenterDocKey: () => string | null
      graphViewportZoom: () => number
      graphViewport: () => { x: number; y: number; zoom: number }
      writeDocumentCalls: () => string[]
      getFixtureMarkdown: (note: 'note-a' | 'note-b' | 'note-c') => string
      getEditorPlainText: () => string
      getOutlineTitles: () => string[]
      editActiveMarkdown: (markdown: string) => Promise<void>
      saveActiveToFixture: () => Promise<void>
      navigateBack: () => boolean
      navigateForward: () => boolean
      isKnowledgeRailOpen: () => boolean
      isAiRailOpen: () => boolean
      getAiRailScrollTop: () => number
      setActiveRightRailView: (view: EditorRightRailView) => void
      getActiveRightRailView: () => EditorRightRailView
    }
  }
}

function QaAppKnowledgeIntegrationInner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('booting')
  const [rootDir] = useState(QA_KNOWLEDGE_ROOT)
  const [fileTree] = useState(QA_TREE)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set())
  const [openedTabs, setOpenedTabs] = useState<string[]>([])
  const [activePath, setActivePath] = useState('')
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [sidebarPanelView, setSidebarPanelView] = useState<SidebarPanelView>('files-tree')
  const sidebarListMode = sidebarListModeFromPanelView(sidebarPanelView)
  const sidebarFileView = sidebarFileViewFromPanelView(sidebarPanelView)
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>('group')
  const [draggingWorkspaceFile, setDraggingWorkspaceFile] = useState<string[] | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<WorkspaceDragTarget | null>(null)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [, setEditorDocMenu] = useState<EditorDocMenuState | null>(null)
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null)
  const [knowledgeRailVisible, setKnowledgeRailVisible] = useState(true)
  const [aiRailVisible, setAiRailVisible] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(310)
  const [editorRightRailView, setEditorRightRailView] = useState<EditorRightRailView>('knowledge')
  const [visualSelectionTick, setVisualSelectionTick] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [content, setContent] = useState('')
  const [coldOpenGeneration, setColdOpenGeneration] = useState(0)
  const [editorOpenReason] = useState(EditorOpenReason.ColdOpen)

  const fixturesRef = useRef(cloneQaKnowledgeFixtures())
  const writeDocumentCallsRef = useRef<string[]>([])
  const rootDirRef = useRef(rootDir)
  const activePathRef = useRef(activePath)
  const activeDocKeyRef = useRef<string | null>(null)
  const openedTabsRef = useRef<string[]>([])
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)
  const fileContextMenuRef = useRef<FileContextMenuState | null>(null)
  const contentRef = useRef('')
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const mainWithRailRef = useRef<HTMLElement | null>(null)
  const editorViewRef = useRef<import('@codemirror/view').EditorView | null>(null)
  const mainPaneModeRef = useRef<'visual' | 'source'>('visual')
  const knowledgeRailVisibleRef = useRef(knowledgeRailVisible)
  const aiRailVisibleRef = useRef(aiRailVisible)
  const editorRightRailViewRef = useRef(editorRightRailView)
  const suppressMarkdownSerdeRef = useRef(false)
  const liveOutlineByPathRef = useRef(new Map<string, TocHeading[]>())
  const outlineHeadingsRef = useRef<TocHeading[]>([])
  const [liveOutlineTick, setLiveOutlineTick] = useState(0)
  const [activeOutlineId, setActiveOutlineId] = useState('')

  const markdownOutlineHeadings = useSidebarOutlineHeadings(activePath, content)
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

  const handleOutlineHeadingsChange = useCallback((headings: TocHeading[]) => {
    const path = activePathRef.current
    if (!path) return
    if (headings.length === 0) {
      liveOutlineByPathRef.current.delete(path)
    } else {
      liveOutlineByPathRef.current.set(path, headings)
    }
    setLiveOutlineTick((tick) => tick + 1)
  }, [])

  rootDirRef.current = rootDir
  activePathRef.current = activePath
  activeDocKeyRef.current = activeDocKey
  openedTabsRef.current = openedTabs
  fileContextMenuRef.current = fileContextMenu
  knowledgeRailVisibleRef.current = knowledgeRailVisible
  aiRailVisibleRef.current = aiRailVisible
  editorRightRailViewRef.current = editorRightRailView

  const editorRightRailOpen = knowledgeRailVisible || aiRailVisible
  const surfaceSplit = useSurfaceSplitLayout(mainWithRailRef, editorRightRailOpen)

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const knowledgeRailPanel = (
    <KnowledgeRightRail
      activeDocKey={activeDocKey}
      visible
      searchOpen={searchOpen}
      searchQuery={searchQuery}
      onSearchOpenChange={setSearchOpen}
      onSearchQueryChange={setSearchQuery}
      onClose={() => {
        setSearchOpen(false)
        setSearchQuery('')
        setKnowledgeRailVisible(false)
      }}
    />
  )

  const aiRailPanel = (
    <AiRightRail
      visible
      panelActive={!knowledgeRailVisible || editorRightRailView === 'ai'}
      activeDocKey={activeDocKey ?? activePath}
      activePath={activePath}
      activeTabLabel={activePath ? tabLabel(activePath) : null}
      content={content}
      visualEditorRef={visualEditorRef}
      selectionTick={visualSelectionTick}
      onClose={() => {
        setAiRailVisible(false)
        setEditorRightRailView('knowledge')
      }}
    />
  )

  const bumpColdOpenGeneration = useCallback(() => {
    setColdOpenGeneration((value) => value + 1)
  }, [])

  const readFixture = useCallback((path: string) => {
    const rel = qaKnowledgeFixtureRelPath(path)
    const body = fixturesRef.current[rel]
    if (!body) throw new Error(`missing:${path}`)
    return body
  }, [])

  const openSearch = useCallback(() => {
    setSearchQuery('')
    setSearchOpen(true)
  }, [])

  const syncKnowledgeRoute = useCallback((docKey: string | null) => {
    setBacklinkPanelDocKey(docKey)
    if (docKey) {
      refreshBacklinkPanel(docKey)
      setPendingGraphCenter(docKey, `page:${docKey}`)
    }
    syncNoteGraphTopologyFromRoute(docKey)
    requestOsRevision()
  }, [])

  const openPathInTab = useCallback(async (path: AbsoluteDocPath, source: string) => {
    await dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT_IN_TAB',
      root: QA_KNOWLEDGE_ROOT,
      path,
      source,
    })
  }, [])

  const dispatchOpenDocumentInTab = useCallback(
    async (root: string, path: string) => {
      if (root !== QA_KNOWLEDGE_ROOT) return
      await openPathInTab(path, 'qa-app-knowledge-sidebar')
    },
    [openPathInTab],
  )

  const activateTab = useCallback(async (path: string) => {
    if (!path) return
    await dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT',
      root: QA_KNOWLEDGE_ROOT,
      path,
      source: 'qa-app-knowledge-tab',
    })
  }, [])

  const persistFixture = useCallback(async (path: string, content: string) => {
    const rel = qaKnowledgeFixtureRelPath(path)
    fixturesRef.current[rel] = content
    writeDocumentCallsRef.current.push(path)
  }, [])

  const updateDocumentFrontmatter = useMemo(
    () =>
      createQaKnowledgeFrontmatterUpdater(QA_KNOWLEDGE_ROOT, fixturesRef, {
        onPersist: async (_root, absolutePath, full) => {
          await persistFixture(absolutePath, full)
        },
      }),
    [persistFixture],
  )

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const {
    sortedFlatWorkspaceFiles,
    sortedFileTree,
    workspaceFolderNodes,
    sidebarFilterMatchCount,
    isSidebarFiltering,
    toggleWorkspaceDir,
    onWorkspaceFilePointerDown,
    onSidebarFileContextMenu,
    onSidebarBlankContextMenu,
    isFilePathSelected,
    handleWorkspaceFileClick,
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
    dispatchOpenDocumentInTab,
    handleMoveFileToFolder: async () => undefined,
    toggleDir,
    setExpandedDirs,
    tabLabel,
    setStatus,
  })

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

  const workspaceMenuPopStyle = useMemo(
    () =>
      workspaceMenuOpen
        ? ({
            position: 'fixed',
            left: 180,
            top: 48,
            visibility: 'visible',
          } as const)
        : null,
    [workspaceMenuOpen],
  )

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    window.__QA_APP_KNOWLEDGE__ = {
      workspaceRoot: () => rootDirRef.current,
      activePath: () => activePathRef.current || null,
      activeDocKey: () => activeDocKeyRef.current,
      openedTabPaths: () => [...openedTabsRef.current],
      backlinkSourceTitles: () =>
        Array.from(document.querySelectorAll('.qa-app-knowledge-rail .kos-backlink-source')).map(
          (el) => el.textContent?.trim() ?? '',
        ),
      graphTopologyCenterDocKey: () => getNoteGraphTopology().centerDocKey,
      graphViewportZoom: () => getGraphViewport().zoom,
      graphViewport: () => getGraphViewport(),
      writeDocumentCalls: () => [...writeDocumentCallsRef.current],
      getFixtureMarkdown: (note) => fixturesRef.current[`${note}.md`] ?? '',
      getEditorPlainText: () => {
        const editor = visualEditorRef.current?.getEditor()
        if (!editor) return ''
        return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n')
      },
      getOutlineTitles: () => outlineHeadingsRef.current.map((heading) => heading.title),
      editActiveMarkdown: async (markdown: string) => {
        const path = activePathRef.current
        if (!path) return
        contentRef.current = markdown
        setContent(markdown)
        setTabBody(path, markdown)
        await dispatchDocumentCommand({
          type: 'DOCUMENT_CONTENT_CHANGED',
          path,
          content: markdown,
          source: 'qa-app-knowledge-edit',
        })
      },
      saveActiveToFixture: async () => {
        const path = activePathRef.current
        if (!path) return
        await persistFixture(path, contentRef.current)
      },
      navigateBack: () => dispatchKnowledgeNavigateBack('command'),
      navigateForward: () => dispatchKnowledgeNavigateForward('command'),
      isKnowledgeRailOpen: () => knowledgeRailVisibleRef.current,
      isAiRailOpen: () => aiRailVisibleRef.current,
      getAiRailScrollTop: () => document.querySelector('.ai-rail-scroll')?.scrollTop ?? 0,
      setActiveRightRailView: (view) => {
        setEditorRightRailView(view)
      },
      getActiveRightRailView: () => editorRightRailViewRef.current,
    }
    return () => {
      delete window.__QA_APP_KNOWLEDGE__
    }
  }, [persistFixture])

  useEffect(() => {
    initEditorMutationBridge(visualEditorRef, editorViewRef, mainPaneModeRef)
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...QA_AI_SETTINGS, ai: { ...QA_AI_SETTINGS.ai } })
  }, [])

  useEffect(() => {
    let cancelled = false
    installNavigationRuntimeFirewall()
    resetDocumentRuntimeKernel()

    const unsubTabBodies = installTabBodiesKernelSync()

    registerDocumentRuntimeCapabilities({
      readDocument: async (_root, path) => readFixture(path),
      readDocumentForVerify: async (_root, path) => readFixture(path),
      writeDocument: async (_root, path, content) => {
        await persistFixture(path, content)
      },
      setActiveDocument: (path) => {
        const docKey = absolutePathToDocKeyOs(path, QA_KNOWLEDGE_ROOT)
        const markdown = readFixture(path)
        const projected = projectDocumentMemorySurfaces(path, markdown)
        activePathRef.current = path
        setActivePath(path)
        activeDocKeyRef.current = docKey
        setActiveDocKey(docKey)
        contentRef.current = projected.editorSurface
        setContent(projected.editorSurface)
        setSourceModeIdentity(path, projected.sourceIdentity)
        syncDocumentFrontmatterFromMarkdown(path, projected.sourceIdentity)
        bumpColdOpenGeneration()
        openNoteInWorkspace(path, docKey)
        syncKnowledgeRoute(docKey)
      },
      renderContent: (markdown) => {
        const path = activePathRef.current
        if (!path) return
        const projected = projectDocumentMemorySurfaces(path, markdown)
        contentRef.current = projected.editorSurface
        setContent(projected.editorSurface)
        setSourceModeIdentity(path, projected.sourceIdentity)
      },
      setTabs: (tabs) => {
        setOpenedTabs(Array.isArray(tabs) ? [...tabs] : tabs(openedTabsRef.current))
      },
      onDocumentOpened: () => {},
      onDocumentSaved: () => {},
      onOpenTabLimitReached: () => {},
    })

    void (async () => {
      resetKnowledgeRuntime()
      openVault(QA_KNOWLEDGE_ROOT)
      initKnowledgeOS({
        fileAdapter: {
          read: async (path) => {
            const rel = qaKnowledgeFixtureRelPath(path)
            return fixturesRef.current[rel] ?? ''
          },
          write: async () => {},
          create: async () => {},
          delete: async () => {},
          rename: async () => {},
        },
      })
      onKnowledgeOSWorkspaceOpened(QA_KNOWLEDGE_ROOT)

      registerKnowledgeInteractionHost({
        getRootDir: () => QA_KNOWLEDGE_ROOT,
        openAbsolutePath: (absolutePath) => {
          void openPathInTab(absolutePath, 'qa-app-knowledge-host')
        },
        clearEditorSelection: () => {},
        focusEditor: () => {},
        insertWikiLinkAtCursor: () => false,
        onHoverIdChange: () => {},
        openSearchModal: openSearch,
        revealNavigationAnchor: () => {},
        updateDocumentFrontmatter,
      })

      const paths = Object.keys(fixturesRef.current).map(
        (file) => `${QA_KNOWLEDGE_ROOT}/${file}` as AbsoluteDocPath,
      )
      await bootstrapWorkspaceLinkGraphIndex(QA_KNOWLEDGE_ROOT, paths, async (path) => {
        const rel = qaKnowledgeFixtureRelPath(path)
        return fixturesRef.current[rel] ?? ''
      })

      const indexReady = await waitForLinkIndexReady(15_000)
      if (cancelled) return
      if (!indexReady) {
        setStatus('error:index-timeout')
        return
      }

      await dispatchDocumentCommand({
        type: 'RESTORE_WORKSPACE',
        root: QA_KNOWLEDGE_ROOT,
        activePath: qaKnowledgeNotePath('note-b'),
        openTabs: [qaKnowledgeNotePath('note-b')],
        source: 'qa-app-knowledge-boot',
      })
      setStatus('ready')
    })()

    return () => {
      cancelled = true
      unsubTabBodies()
      registerKnowledgeInteractionHost(null)
      registerDocumentRuntimeCapabilities(null)
      resetDocumentRuntimeKernel()
    }
  }, [openPathInTab, openSearch, readFixture, syncKnowledgeRoute, updateDocumentFrontmatter, persistFixture, bumpColdOpenGeneration])

  useEffect(() => {
    if (!fileContextMenu) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
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

  const visualDocumentKey = `visual:${activePath || 'scratch'}:${coldOpenGeneration}`

  return (
    <div className="qa-app-knowledge-root">
      <div className="qa-app-knowledge-diagnostics">
        <p data-testid="qa-ready">App knowledge integration QA</p>
        <p data-testid="qa-status">{status}</p>
        <p data-testid="qa-workspace-root">{rootDir}</p>
        <p data-testid="qa-active-path">{activePath}</p>
      </div>

      <div
        className="layout workspace-split mod-root with-sidebar with-knowledge-rail qa-app-knowledge-layout"
        style={
          {
            '--sidebar-width': `${Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, sidebarWidth))}px`,
          } as CSSProperties
        }
      >
        <AppSidebarPanel
          t={t}
          rootDir={rootDir}
          activePath={activePath}
          mainPaneMode="visual"
          knowledgeRailVisible={knowledgeRailVisible}
          onOpenKnowledgePanel={() => undefined}
          onToggleMainPaneMode={() => undefined}
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
          scrollPreviewToHeading={(id) => {
            setActiveOutlineId(id)
            visualEditorRef.current?.scrollToHeading(id)
          }}
          fileTree={fileTree}
          workspaceFolderNodes={workspaceFolderNodes}
          sortedFlatWorkspaceFiles={sortedFlatWorkspaceFiles}
          sortedFileTree={sortedFileTree}
          expandedDirs={expandedDirs}
          toggleWorkspaceDir={toggleWorkspaceDir}
          isFilePathSelected={isFilePathSelected}
          onWorkspaceFileClick={onWorkspaceFileClick}
          onWorkspaceFilePointerDown={onWorkspaceFilePointerDown}
          handleMoveFileToFolder={async () => undefined}
          createNewNote={() => undefined}
          createNewNoteFromTemplate={() => undefined}
          createNewFolder={() => undefined}
          workspaceFolderName="qa-vault"
          workspaceMenuRef={workspaceMenuRef}
          workspaceMenuPopRef={workspaceMenuPopRef}
          workspaceMenuOpen={workspaceMenuOpen}
          setWorkspaceMenuOpen={setWorkspaceMenuOpen}
          workspaceMenuPopStyle={workspaceMenuPopStyle}
          fileSortMode={fileSortMode}
          setFileSortMode={setFileSortMode}
          setStatus={setStatus}
          chooseFolder={() => undefined}
          refreshFileTree={async () => undefined}
          sidebarStatusLine=""
          contextMenuFilePath={fileContextMenu?.path ?? null}
        />

        <div
          className="resize-handle resize-handle-sidebar"
          data-testid="qa-workspace-sidebar-split-handle"
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
        />

        <main
          ref={mainWithRailRef}
          className={`main main-with-rail workspace-leaf mod-active${editorRightRailOpen ? ' has-kos-rail' : ''}`}
          data-testid="qa-app-knowledge-main"
        >
          <div className="main-editor-stack workspace-leaf-content">
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={new Set()}
            tabLabel={tabLabel}
            onActivate={(path) => {
              void activateTab(path)
            }}
            onClose={(path) => {
              setOpenedTabs((tabs) => tabs.filter((item) => !pathsEqual(item, path)))
              if (pathsEqual(activePath, path)) {
                const next = openedTabs.find((item) => !pathsEqual(item, path)) ?? ''
                void activateTab(next)
              }
            }}
            onReorder={() => undefined}
            onContextMenu={() => undefined}
            trailingActions={
              <>
                <button
                  type="button"
                  className={`luna-chrome-icon-btn editor-chrome-action-btn${knowledgeRailVisible ? ' luna-chrome-icon-btn--active' : ''}`}
                  data-testid="editor-knowledge-toggle"
                  aria-pressed={knowledgeRailVisible}
                  aria-label={knowledgeRailVisible ? t('app.knowledge.hidePanel') : t('app.knowledge.showPanel')}
                  onClick={() =>
                    setKnowledgeRailVisible((visible) => {
                      const next = !visible
                      if (next) {
                        setEditorRightRailView('knowledge')
                      } else if (aiRailVisible) {
                        setEditorRightRailView('ai')
                      }
                      return next
                    })
                  }
                >
                  <Icon name="graph" size="sm" stroke="strong" />
                </button>
                <button
                  type="button"
                  className={`luna-chrome-icon-btn editor-chrome-action-btn${aiRailVisible ? ' luna-chrome-icon-btn--active' : ''}`}
                  data-testid="editor-ai-toggle"
                  aria-pressed={aiRailVisible}
                  aria-label={aiRailVisible ? t('app.ai.hidePanel') : t('app.ai.showPanel')}
                  onClick={() =>
                    setAiRailVisible((visible) => {
                      const next = !visible
                      if (next) {
                        setEditorRightRailView('ai')
                      } else if (knowledgeRailVisible) {
                        setEditorRightRailView('knowledge')
                      }
                      return next
                    })
                  }
                >
                  <Icon name="ai" size="sm" stroke="strong" />
                </button>
              </>
            }
          />

          <div className="editor-body-surface view-content" data-testid="qa-editor-surface">
            <div
              className="preview-pane markdown-visual-editor"
              data-testid="qa-app-knowledge-editor-pane"
            >
              {activePath ? (
                <TiptapMarkdownEditor
                  ref={visualEditorRef}
                  documentKey={visualDocumentKey}
                  markdown={content}
                  activePath={activePath}
                  rootDir={QA_KNOWLEDGE_ROOT}
                  sidebarListMode={sidebarListMode}
                  suppressMarkdownSyncRef={suppressMarkdownSerdeRef}
                  onMarkdownChange={(next) => {
                    contentRef.current = next
                    setContent(next)
                    const path = activePathRef.current
                    if (!path) return
                    setTabBody(path, next)
                    void dispatchDocumentCommand({
                      type: 'DOCUMENT_CONTENT_CHANGED',
                      path,
                      content: next,
                      source: 'qa-app-knowledge-editor',
                    })
                  }}
                  onActiveHeadingChange={(id) => setActiveOutlineId((prev) => (prev === id ? prev : id))}
                  onSelectionActivity={() => setVisualSelectionTick((tick) => tick + 1)}
                  onStatus={() => {}}
                  onOutlineHeadingsChange={handleOutlineHeadingsChange}
                  onPasteImage={async () => null}
                  openReason={editorOpenReason}
                />
              ) : (
                <p className="qa-app-knowledge-editor-stub">No active document</p>
              )}
            </div>
          </div>
          </div>

          {editorRightRailOpen ? (
            <>
              <KnowledgeSurfaceSplitHandle
                onPointerDown={surfaceSplit.onSplitterPointerDown}
                onRailWidthChange={surfaceSplit.adjustRailWidth}
              />
              {knowledgeRailVisible && aiRailVisible ? (
                <EditorRightRailContainer
                  t={t}
                  knowledgeOpen={knowledgeRailVisible}
                  aiOpen={aiRailVisible}
                  activeView={editorRightRailView}
                  onActiveViewChange={setEditorRightRailView}
                  knowledgePanel={
                    <div className="qa-app-knowledge-rail">{knowledgeRailPanel}</div>
                  }
                  aiPanel={aiRailPanel}
                />
              ) : (
                <div className="editor-right-rail-container" data-testid="editor-right-rail-container">
                  <div className="qa-app-knowledge-rail">
                    {knowledgeRailVisible ? knowledgeRailPanel : aiRailPanel}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}

export function QaAppKnowledgeIntegrationPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaAppKnowledgeIntegrationInner />
    </I18nProvider>
  )
}
