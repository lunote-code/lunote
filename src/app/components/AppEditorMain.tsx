import type {
  CSSProperties,
  Dispatch,
  MouseEvent,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Icon } from '../../design-system/icons'
import { EmptyState } from '../../design-system/EmptyState'
import { formatCommandShortcutDisplay } from '../../menu'
import { EditorTabBar } from './EditorTabBar'
import {
  TiptapMarkdownEditor,
  type AtomicVisualDocumentEnter,
  type TiptapMarkdownEditorHandle,
} from '../../editor/TiptapMarkdownEditor'
import { getSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { SourceCodeMirrorPane } from '../../editor/SourceCodeMirrorPane'
import type { EditorOpenReason } from '../../editor/editorOpenReason'
import type { Extension } from '@codemirror/state'
import type { WikiLinkTarget } from '../../editor/knowledgeRuntime/types'
import type { AssetMeta } from '../../assets/workspaceAssetStore'
import type { EditorDocMenuState, FileContextMenuState } from '../workspace/contextMenuTypes'
import type { TranslateFn } from '../../i18n'
import { isPathDirty } from '../../lib/documentDirty'
import type { AppStatusTone } from '../hooks/useAppStatus'
import type { EditorRightRailView } from './EditorRightRailContainer'
import type { TocHeading } from './DocumentOutlineBlock'
import {
  getHistoryRestoreRevision,
  getHistoryRestoreState,
  subscribeHistoryRestoreState,
} from '../../documentHistory/historyRestoreState'
import type { ToolbarItemDef } from '../../menu/menu.types'
import type { WorkspaceSessionState } from '../../documentRuntime/workspaceSessionRuntime'
import { EditorFormatToolbar } from './EditorFormatToolbar'
import { EditorAiSelectionToolbar } from './EditorAiSelectionToolbar'
import { EditorBlockAiHandle } from './EditorBlockAiHandle'
import { EditorAiInsertUndoChip } from './EditorAiInsertUndoChip'
import { EditorBlockAiStatusChip } from './EditorBlockAiStatusChip'
import { EditorDocumentLoadingOverlay } from './EditorDocumentLoadingOverlay'
import { KnowledgeGraphToolbarHint } from './KnowledgeGraphToolbarHint'
import {
  dismissKnowledgeGraphToolbarHint,
  isKnowledgeGraphToolbarHintDismissed,
} from '../knowledgeGraphToolbarHintStorage'
import { bridgeCaptureEditorSelection } from '../../editor/editorMutationBridge'
import { useEditorUiChromeSettings } from '../hooks/useEditorUiChromeSettings'
import { pushAppToast } from '../toast/appToastStore'
import { isCodeBlockCmFocused } from '../../editor/codeBlock/cm/codeBlockCmFocus'
import { isEditorFormatMenuPortalNode } from './editorFormatMenuPortal'

import { hasExternalDiskDriftInState } from '../../lib/externalDiskDriftState'
import {
  resolveEditorOverlayChrome,
  resolveEditorPersistentStatusMessage,
  shouldMountDocumentEditor,
  shouldShowDocumentLoadingOverlay,
} from '../../lib/editorRestoreExternalChrome'
import type { SidebarListMode } from '../workspace/sidebarPanelView'

export type AppEditorMainProps = {
  t: TranslateFn
  mainWithRailRef: RefObject<HTMLElement | null>
  knowledgeRailOpen: boolean
  editorBodyFocused: boolean
  setEditorBodyFocused: Dispatch<SetStateAction<boolean>>
  focusMode: boolean
  activePath: string
  workspaceFolderName: string
  tabLabel: (path: string) => string
  setFocusMode: Dispatch<SetStateAction<boolean>>
  sidebarListMode: SidebarListMode
  rootDir: string
  knowledgeRailVisible: boolean
  setKnowledgeRailVisible: Dispatch<SetStateAction<boolean>>
  aiPanelVisible: boolean
  setAiPanelVisible: Dispatch<SetStateAction<boolean>>
  setEditorRightRailView: (view: EditorRightRailView) => void
  onReloadFromDisk: (path: string) => void | Promise<void | boolean>
  openedTabs: string[]
  externalDiskChangedPaths: Set<string>
  activateTab: (path: string) => void | Promise<void>
  closeTab: (path: string) => void
  onTabContextMenu: (e: MouseEvent, path: string, index: number) => void
  onReorderOpenedTabs: (fromIndex: number, toIndex: number) => void
  mainPaneMode: 'visual' | 'source'
  panesRef: RefObject<HTMLElement | null>
  editorSurfaceStyle: CSSProperties | undefined
  setFileContextMenu: Dispatch<SetStateAction<FileContextMenuState | null>>
  setEditorDocMenu: Dispatch<SetStateAction<EditorDocMenuState | null>>
  sourceCodeMirrorBootSelectionRef: MutableRefObject<{
    from: number
    to: number
    scrollTop?: number
    scrollRatio?: number
  } | null>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  content: string
  handleEditorContentChange: (value: string) => void
  setActiveOutlineId: Dispatch<SetStateAction<string>>
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  pasteImageIntoVisualEditor: (file: File, mimeHint: string) => Promise<string | null>
  dropFilesIntoActiveNote: (files: File[]) => Promise<void>
  pickAndImportLunaAsset: () => Promise<AssetMeta | null>
  handleLunaAssetLinkClick: (href: string, event: globalThis.MouseEvent) => void
  getLunaAssetTooltip: (href: string) => string | null
  onWikiLinkNavigate: (target: unknown) => void
  onEmbeddedHtmlLinkNavigate?: (target: import('../../editor/resolveWorkspaceMarkdownHref').EmbeddedHtmlWorkspaceNoteTarget) => void
  onEmbeddedHtmlHashNavigate?: (fragment: string) => void
  atomicVisualDocumentEnter: AtomicVisualDocumentEnter | null
  onAtomicVisualDocumentEnterConsumed: () => void
  editorOpenReason: EditorOpenReason
  handleWikiHover: (target: WikiLinkTarget | null, pos: { x: number; y: number }) => void
  suppressMarkdownSerdeRef: React.MutableRefObject<boolean>
  cmMountKey: string
  visualMountKey: string
  editorExtensions: Extension[]
  handleSourceViewReady: (view: import('@codemirror/view').EditorView) => void
  statusbarVisible: boolean
  status: string
  statusTone: AppStatusTone
  workspaceSessionState: WorkspaceSessionState
  savedAt: string
  contentStats: { lines: number; chars: number; headings: number }
  selectionStats: { chars: number; words: number }
  isLargeDoc: boolean
  knowledgeRailSlot: React.ReactNode
  createNewNote: () => void | Promise<void>
  chooseFolder: () => void | Promise<void>
  onOutlineHeadingsChange?: (headings: TocHeading[]) => void
  toolbarEditorFormat: ToolbarItemDef[]
  onFormatCommand: (commandId: string) => void
  editorHasTextSelection: boolean
  isFormatCommandActive?: (commandId: string) => boolean
  onEditorTextColorPick: (color: string | null) => void
  onVisualSelectionActivity?: () => void
  visualSelectionTick?: number
  editorDocumentLoading: boolean
  modeSwitchLoading?: boolean
  onOpenGlobalSearch?: () => void
  onSaveActiveDocument?: () => void | Promise<void>
}

export function AppEditorMain(props: AppEditorMainProps) {
  const {
    t,
    mainWithRailRef,
    knowledgeRailOpen,
    editorBodyFocused,
    setEditorBodyFocused,
    focusMode,
    activePath,
    tabLabel,
    setFocusMode,
    sidebarListMode,
    rootDir,
    knowledgeRailVisible,
    setKnowledgeRailVisible,
    aiPanelVisible,
    setAiPanelVisible,
    setEditorRightRailView,
    onReloadFromDisk,
    openedTabs,
    externalDiskChangedPaths,
    activateTab,
    closeTab,
    onTabContextMenu,
    onReorderOpenedTabs,
    mainPaneMode,
    panesRef,
    editorSurfaceStyle,
    setFileContextMenu,
    setEditorDocMenu,
    sourceCodeMirrorBootSelectionRef,
    visualEditorRef,
    content,
    handleEditorContentChange,
    setActiveOutlineId,
    setStatus,
    pasteImageIntoVisualEditor,
    dropFilesIntoActiveNote,
    pickAndImportLunaAsset,
    handleLunaAssetLinkClick,
    getLunaAssetTooltip,
    atomicVisualDocumentEnter,
    onAtomicVisualDocumentEnterConsumed,
    editorOpenReason,
    onWikiLinkNavigate,
    onEmbeddedHtmlLinkNavigate,
    onEmbeddedHtmlHashNavigate,
    handleWikiHover,
    suppressMarkdownSerdeRef,
    cmMountKey,
    visualMountKey,
    editorExtensions,
    handleSourceViewReady,
    statusbarVisible,
    status,
    statusTone,
    workspaceSessionState,
    savedAt,
    contentStats,
    selectionStats,
    isLargeDoc,
    knowledgeRailSlot,
    createNewNote,
    chooseFolder,
    onOutlineHeadingsChange,
    toolbarEditorFormat,
    onFormatCommand,
    editorHasTextSelection,
    isFormatCommandActive,
    onEditorTextColorPick,
    onVisualSelectionActivity,
    visualSelectionTick = 0,
    editorDocumentLoading,
    modeSwitchLoading = false,
    onOpenGlobalSearch,
    onSaveActiveDocument,
  } = props

  const activeDocumentDirty = isPathDirty(activePath)
  const activeDocumentExternal = hasExternalDiskDriftInState(activePath, externalDiskChangedPaths)
  const historyRestoreRevision = useSyncExternalStore(
    subscribeHistoryRestoreState,
    getHistoryRestoreRevision,
    getHistoryRestoreRevision,
  )
  const activeDocumentHistoryRestore =
    historyRestoreRevision >= 0 && activePath ? getHistoryRestoreState(activePath) : null
  const workspaceLoadingLabelKey =
    workspaceSessionState === 'restoring'
      ? 'app.editor.workspaceRestoring'
      : workspaceSessionState === 'indexing'
        ? 'app.editor.workspaceIndexing'
        : workspaceSessionState === 'openingInitialDocument'
          ? 'app.editor.loading'
          : null
  const showWorkspaceLoadingOverlay = workspaceLoadingLabelKey != null
  const activeDocumentHistoryRestorePending = Boolean(activeDocumentHistoryRestore)
  const {
    showBothRestoreAndExternal,
    showHistoryRestoreBanner,
    showExternalChangedBanner,
    showHistorySaveCta,
    showExternalReloadCta,
  } = resolveEditorOverlayChrome({
    statusbarVisible,
    historyRestorePending: activeDocumentHistoryRestorePending,
    externalDrift: activeDocumentExternal,
  })
  const persistentStatusMessage = resolveEditorPersistentStatusMessage({
    t,
    statusbarVisible,
    historyRestorePending: activeDocumentHistoryRestorePending,
    externalDrift: activeDocumentExternal,
    dirty: activeDocumentDirty,
    workspaceLoadingLabelKey,
    savedAt,
  })
  const showEmptyState = !activePath && openedTabs.length === 0
  const graphButtonRef = useRef<HTMLButtonElement>(null)
  const editorPanelRef = useRef<HTMLDivElement | null>(null)
  const [graphToolbarHintOpen, setGraphToolbarHintOpen] = useState(
    () => !isKnowledgeGraphToolbarHintDismissed(),
  )
  const [codeBlockCmFocused, setCodeBlockCmFocused] = useState(false)
  const [formatMenuOpen, setFormatMenuOpen] = useState(false)
  const showEditorBodyFocusChrome = editorBodyFocused || formatMenuOpen

  const dismissGraphToolbarHint = useCallback(() => {
    dismissKnowledgeGraphToolbarHint()
    setGraphToolbarHintOpen(false)
  }, [])

  const {
    focusButtonEnabled,
    graphButtonEnabled,
    aiButtonEnabled,
    globalSearchButtonEnabled,
    aiConfigured,
    focusExitButtonEnabled,
  } = useEditorUiChromeSettings()

  useEffect(() => {
    if (knowledgeRailVisible && graphToolbarHintOpen) {
      dismissGraphToolbarHint()
    }
  }, [knowledgeRailVisible, graphToolbarHintOpen, dismissGraphToolbarHint])

  useEffect(() => {
    let frame = 0
    const sync = () => {
      const next = isCodeBlockCmFocused()
      setCodeBlockCmFocused((prev) => (prev === next ? prev : next))
    }
    const scheduleSync = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        sync()
      })
    }
    sync()
    document.addEventListener('focusin', scheduleSync, true)
    document.addEventListener('focusout', scheduleSync, true)
    document.addEventListener('pointerup', scheduleSync, true)
    document.addEventListener('selectionchange', scheduleSync)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      document.removeEventListener('focusin', scheduleSync, true)
      document.removeEventListener('focusout', scheduleSync, true)
      document.removeEventListener('pointerup', scheduleSync, true)
      document.removeEventListener('selectionchange', scheduleSync)
    }
  }, [])

  const showGraphToolbarHint =
    Boolean(rootDir) &&
    !focusMode &&
    graphToolbarHintOpen &&
    graphButtonEnabled

  const showAiSelectionToolbar =
    aiButtonEnabled &&
    aiConfigured &&
    Boolean(rootDir) &&
    !focusMode &&
    !showEmptyState &&
    mainPaneMode === 'visual' &&
    !codeBlockCmFocused &&
    editorHasTextSelection

  const showBlockAiHandle =
    aiButtonEnabled &&
    aiConfigured &&
    Boolean(rootDir) &&
    !focusMode &&
    !showEmptyState &&
    mainPaneMode === 'visual' &&
    !codeBlockCmFocused &&
    !editorHasTextSelection

  const prevMainPaneModeRef = useRef(mainPaneMode)
  const sourceModeBlockAiHintShownRef = useRef(false)
  const showDocumentLoadingOverlay = editorDocumentLoading || modeSwitchLoading
  const showLoadingOverlay = shouldShowDocumentLoadingOverlay({
    workspaceLoading: showWorkspaceLoadingOverlay,
    documentLoading: showDocumentLoadingOverlay,
    showEmptyState,
  })
  const mountDocumentEditor = shouldMountDocumentEditor({
    workspaceLoading: showWorkspaceLoadingOverlay,
    showEmptyState,
  })
  useEffect(() => {
    const prev = prevMainPaneModeRef.current
    prevMainPaneModeRef.current = mainPaneMode
    if (prev !== 'visual' || mainPaneMode !== 'source') return
    if (sourceModeBlockAiHintShownRef.current) return
    if (!aiButtonEnabled || !aiConfigured || !rootDir || focusMode || showEmptyState) return
    sourceModeBlockAiHintShownRef.current = true
    pushAppToast(t('editor.sourceMode.blockAiUnavailable'), 'info')
  }, [aiButtonEnabled, aiConfigured, focusMode, mainPaneMode, rootDir, showEmptyState, t])

  const knowledgePanelToggleTitle = knowledgeRailVisible
    ? t('app.knowledge.hidePanel')
    : `${t('app.knowledge.showPanel')} · ${t('knowledge.rail.tab.backlinks')} / ${t('knowledge.rail.tab.graph')} / ${t('knowledge.rail.tab.tags')}`

  return (
      <main
        ref={mainWithRailRef}
        className={`main main-with-rail workspace-leaf mod-active${knowledgeRailOpen ? ' has-kos-rail' : ''}${showEditorBodyFocusChrome ? ' editor-body-focused' : ''}`}
        data-drop-zone="editor"
      >
        <div
          className="main-editor-stack workspace-leaf-content"
          data-type="markdown"
          data-mode={mainPaneMode === 'source' ? 'source' : 'preview'}
          onFocusCapture={() => {
            setEditorBodyFocused(true)
          }}
          onBlurCapture={(e) => {
            const next = e.relatedTarget as Node | null
            if (isEditorFormatMenuPortalNode(next)) return
            if (!e.currentTarget.contains(next)) setEditorBodyFocused(false)
          }}
        >
        {!focusMode && (
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={externalDiskChangedPaths}
            tabLabel={tabLabel}
            onActivate={(path) => void activateTab(path)}
            onClose={closeTab}
            onReorder={onReorderOpenedTabs}
            onContextMenu={onTabContextMenu}
            onExternalBadgeClick={(path) => void onReloadFromDisk(path)}
            onOpenGlobalSearch={globalSearchButtonEnabled ? onOpenGlobalSearch : undefined}
            trailingActions={
              focusButtonEnabled || (graphButtonEnabled && rootDir) || (aiButtonEnabled && rootDir) ? (
                <>
                  {focusButtonEnabled ? (
                    <button
                      type="button"
                      className="luna-chrome-icon-btn editor-chrome-action-btn"
                      onClick={() => {
                        setFocusMode(true)
                      }}
                      title={`${t('app.focusMode.title')} (${formatCommandShortcutDisplay('toggle-focus')})`}
                      aria-label={t('app.focusMode.title')}
                      data-testid="editor-focus-toggle"
                    >
                      <Icon name="focus" size="sm" stroke="strong" />
                    </button>
                  ) : null}
                  {graphButtonEnabled && rootDir ? (
                    <button
                      ref={graphButtonRef}
                      type="button"
                      className={`luna-chrome-icon-btn editor-chrome-action-btn${knowledgeRailVisible ? ' luna-chrome-icon-btn--active' : ''}`}
                      onClick={() => {
                        dismissGraphToolbarHint()
                        setKnowledgeRailVisible((visible) => {
                          const next = !visible
                          if (next) setEditorRightRailView('knowledge')
                          return next
                        })
                      }}
                      title={knowledgePanelToggleTitle}
                      aria-pressed={knowledgeRailVisible}
                      aria-label={knowledgePanelToggleTitle}
                      data-testid="editor-knowledge-toggle"
                    >
                      <Icon name="graph" size="sm" stroke="strong" />
                    </button>
                  ) : null}
                  {aiButtonEnabled && rootDir ? (
                    <button
                      type="button"
                      className={`luna-chrome-icon-btn editor-chrome-action-btn${aiPanelVisible ? ' luna-chrome-icon-btn--active' : ''}`}
                      onClick={() => {
                        setAiPanelVisible((visible) => {
                          const next = !visible
                          if (next) {
                            dismissGraphToolbarHint()
                            setEditorRightRailView('ai')
                          }
                          return next
                        })
                      }}
                      title={aiPanelVisible ? t('app.ai.hidePanel') : t('app.ai.showPanel')}
                      aria-pressed={aiPanelVisible}
                      aria-label={aiPanelVisible ? t('app.ai.hidePanel') : t('app.ai.showPanel')}
                      data-testid="editor-ai-toggle"
                    >
                      <Icon name="ai" size="sm" stroke="strong" />
                    </button>
                  ) : null}
                </>
              ) : null
            }
          />
        )}
        <KnowledgeGraphToolbarHint
          t={t}
          anchorRef={graphButtonRef}
          open={showGraphToolbarHint}
          onDismiss={dismissGraphToolbarHint}
        />
        {!focusMode && !showEmptyState && mainPaneMode === 'visual' && openedTabs.length > 0 ? (
          <EditorFormatToolbar
            t={t}
            commands={toolbarEditorFormat}
            onCommand={onFormatCommand}
            hasTextSelection={editorHasTextSelection}
            isCommandActive={isFormatCommandActive}
            onTextColorPick={onEditorTextColorPick}
            onMenuOpenChange={setFormatMenuOpen}
          />
        ) : null}
        {showHistoryRestoreBanner ? (
          <div
            className={`editor-history-restore-banner${focusMode ? ' editor-history-restore-banner--focus' : ''}`}
            role="status"
            aria-live="polite"
          >
            <Icon name="history" size="sm" />
            <span>{showBothRestoreAndExternal ? `${t('app.history.banner')} · ${t('app.tabs.externalAria')}` : t('app.history.banner')}</span>
            {onSaveActiveDocument ? (
              <button
                type="button"
                className="editor-history-restore-banner-action"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void onSaveActiveDocument()}
                data-testid="editor-history-restore-save"
              >
                {t('menu.file.save')}
              </button>
            ) : null}
          </div>
        ) : null}
        {showExternalChangedBanner ? (
          <div
            className={`editor-history-restore-banner editor-history-restore-banner--external${focusMode ? ' editor-history-restore-banner--focus' : ''}`}
            role="status"
            aria-live="polite"
          >
            <Icon name="refresh" size="sm" />
            <span>{t('app.statusbar.externalChanged')}</span>
            <button
              type="button"
              className="editor-history-restore-banner-action"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void onReloadFromDisk(activePath)}
            >
              {t('app.statusbar.reloadFromDisk')}
            </button>
          </div>
        ) : null}
        {focusMode && focusExitButtonEnabled ? (
          <div className="focus-mode-actions">
            <button
              type="button"
              className="focus-exit-btn"
              onClick={() => {
                setFocusMode(false)
              }}
              title={`${t('app.focus.exit')} (${formatCommandShortcutDisplay('toggle-focus')})`}
            >
              {t('app.focus.exitLabel')}
            </button>
          </div>
        ) : null}
        <section ref={panesRef} className="panes editor-only">
          <div
            className={`editor-body-surface view-content${!statusbarVisible ? ' editor-body-surface--floating-chips' : ''}`}
            style={editorSurfaceStyle}
          >
          <div
            ref={editorPanelRef}
            data-testid="editor-main"
            id="editor-main-panel"
            role="tabpanel"
            className={
              mainPaneMode === 'source'
                ? `editor-pane markdown-source-view mod-cm6 is-live-preview${showDocumentLoadingOverlay ? ' editor-pane--document-loading' : ''}`
                : `preview-pane markdown-visual-editor markdown-preview-view markdown-reading-view${showDocumentLoadingOverlay ? ' editor-pane--document-loading' : ''}`
            }
            style={{ position: 'relative' }}
            onMouseDownCapture={(e) => {
              if (e.button !== 2) return
              e.preventDefault()
              bridgeCaptureEditorSelection()
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              bridgeCaptureEditorSelection()
              const pad = 8
              const mw = 240
              const mh = 400
              let x = e.clientX
              let y = e.clientY
              if (x + mw > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - pad - mw)
              if (y + mh > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - pad - mh)
              if (x < pad) x = pad
              if (y < pad) y = pad
              setFileContextMenu(null)
              setEditorDocMenu({
                x,
                y,
                clientX: e.clientX,
                clientY: e.clientY,
              })
            }}
          >
            <EditorDocumentLoadingOverlay
              t={t}
              visible={showLoadingOverlay}
              labelKey={
                modeSwitchLoading
                  ? 'app.editor.modeSwitchLoading'
                  : workspaceLoadingLabelKey ?? 'app.editor.loading'
              }
              showProgress={showDocumentLoadingOverlay || showWorkspaceLoadingOverlay}
              prominent={editorDocumentLoading && !modeSwitchLoading && !showWorkspaceLoadingOverlay}
            />
            {showEmptyState && !showWorkspaceLoadingOverlay ? (
              <EmptyState
                variant="page"
                icon={rootDir ? 'note' : 'workspace-open'}
                title={rootDir ? t('app.editor.empty.noNoteTitle') : t('app.sidebar.empty.title')}
                description={
                  rootDir ? t('app.editor.empty.noNoteDesc') : t('app.sidebar.empty.scratchDesc')
                }
                hint={rootDir ? undefined : t('app.sidebar.empty.scratchHint')}
                actions={
                  rootDir ? (
                    <button type="button" className="focus-exit-btn" onClick={() => void createNewNote()}>
                      {t('app.sidebar.newNoteWithRoot')}
                    </button>
                  ) : (
                    <>
                      <button type="button" className="focus-exit-btn" onClick={() => void chooseFolder()}>
                        {t('app.sidebar.empty.openFolderCta')}
                      </button>
                      <button type="button" className="luna-empty-state-btn-secondary" onClick={() => void createNewNote()}>
                        {t('app.sidebar.empty.scratchCta')}
                      </button>
                    </>
                  )
                }
              />
            ) : mountDocumentEditor && mainPaneMode === 'visual' ? (
              <TiptapMarkdownEditor
                key={visualMountKey}
                ref={visualEditorRef}
                markdown={content}
                documentKey={activePath || 'scratch'}
                activePath={activePath}
                rootDir={rootDir}
                sidebarListMode={sidebarListMode}
                onMarkdownChange={handleEditorContentChange}
                onActiveHeadingChange={(id) => setActiveOutlineId((prev) => (prev === id ? prev : id))}
                onSelectionActivity={onVisualSelectionActivity}
                onOutlineHeadingsChange={onOutlineHeadingsChange}
                onStatus={(msg, tone) => setStatus(msg, tone)}
                onPasteImage={pasteImageIntoVisualEditor}
                onAssetFilesDrop={dropFilesIntoActiveNote}
                onPickLunaAsset={pickAndImportLunaAsset}
                onLunaAssetLinkClick={handleLunaAssetLinkClick}
                getLunaAssetTooltip={getLunaAssetTooltip}
                atomicVisualDocumentEnter={atomicVisualDocumentEnter}
                onAtomicVisualDocumentEnterConsumed={onAtomicVisualDocumentEnterConsumed}
                openReason={editorOpenReason}
                onWikiLinkNavigate={onWikiLinkNavigate}
                onEmbeddedHtmlLinkNavigate={onEmbeddedHtmlLinkNavigate}
                onEmbeddedHtmlHashNavigate={onEmbeddedHtmlHashNavigate}
                onWikiLinkHover={handleWikiHover}
                suppressMarkdownSyncRef={suppressMarkdownSerdeRef}
              />
            ) : mountDocumentEditor ? (
              <SourceCodeMirrorPane
                mountKey={cmMountKey}
                doc={getSourceModeIdentity(activePath || 'scratch') ?? content}
                openReason={editorOpenReason}
                restoreSelection={
                  sourceCodeMirrorBootSelectionRef.current
                    ? {
                        from: sourceCodeMirrorBootSelectionRef.current.from,
                        to: sourceCodeMirrorBootSelectionRef.current.to,
                        scrollTop: sourceCodeMirrorBootSelectionRef.current.scrollTop,
                        scrollRatio: sourceCodeMirrorBootSelectionRef.current.scrollRatio,
                      }
                    : undefined
                }
                extensions={editorExtensions}
                onChange={handleEditorContentChange}
                onViewReady={handleSourceViewReady}
                onFilesDrop={dropFilesIntoActiveNote}
                className="source-cm-pane markdown-source-view mod-cm6"
                style={{ height: '100%' }}
              />
            ) : null}
            <EditorAiSelectionToolbar
              t={t}
              visualEditorRef={visualEditorRef}
              shellRef={editorPanelRef}
              visible={showAiSelectionToolbar}
              selectionTick={visualSelectionTick}
            />
            <EditorBlockAiHandle
              t={t}
              visualEditorRef={visualEditorRef}
              shellRef={editorPanelRef}
              visible={showBlockAiHandle}
              selectionTick={visualSelectionTick}
            />
            {!statusbarVisible ? (
              <div className="editor-ai-insert-undo-host">
                <div className="editor-footer-ai-chips">
                  <EditorBlockAiStatusChip t={t} />
                  <EditorAiInsertUndoChip t={t} activePath={activePath} />
                </div>
              </div>
            ) : null}
          </div>
          </div>
        </section>
        {statusbarVisible ? (
          <footer
            className={`editor-footer editor-footer--stats-enabled${status ? ' has-transient' : ''}${status && statusTone !== 'neutral' ? ` editor-footer--${statusTone}` : ''}${focusMode ? ' editor-footer--focus-minimal' : ''}`}
          >
            <span className="editor-footer-message editor-footer-persistent" aria-live="polite">
              {persistentStatusMessage}
              {showHistorySaveCta && onSaveActiveDocument ? (
                <button
                  type="button"
                  className="editor-footer-reload-cta"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void onSaveActiveDocument()}
                  data-testid="editor-history-restore-save"
                >
                  {t('menu.file.save')}
                </button>
              ) : null}
              {showExternalReloadCta ? (
                <button
                  type="button"
                  className="editor-footer-reload-cta"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void onReloadFromDisk(activePath)}
                  data-testid="editor-reload-from-disk"
                >
                  {t('app.statusbar.reloadFromDisk')}
                </button>
              ) : null}
              <span className="editor-footer-ai-chips">
                <EditorBlockAiStatusChip t={t} />
                <EditorAiInsertUndoChip t={t} activePath={activePath} />
              </span>
            </span>
            {status ? (
              <span className="editor-footer-transient" role="status" aria-live="polite">
                {status}
              </span>
            ) : null}
            <span className="editor-footer-stats">
              <span>{t('app.statusbar.lines', { n: contentStats.lines })}</span>
              <span>{t('app.statusbar.chars', { n: contentStats.chars })}</span>
              <span>{t('app.statusbar.headings', { n: contentStats.headings })}</span>
              {selectionStats.chars > 0 ? (
                <span>
                  {t('app.statusbar.selection', {
                    chars: selectionStats.chars,
                    words: selectionStats.words,
                  })}
                </span>
              ) : null}
              {isLargeDoc ? (
                <button
                  type="button"
                  className="editor-footer-perf editor-footer-perf--large editor-footer-perf-btn"
                  title={t('app.statusbar.perfLargeDocHint')}
                  aria-label={t('app.statusbar.perfLargeDocHint')}
                  onClick={() => setStatus(t('app.status.perfLargeDocEnabled'), 'info')}
                >
                  {t('app.statusbar.perfLargeDoc')}
                </button>
              ) : null}
              {focusMode ? (
                <span className="editor-footer-perf editor-footer-perf--focus" title={t('app.statusbar.perfFocusHint')}>
                  {t('app.statusbar.perfFocus')}
                </span>
              ) : null}
            </span>
          </footer>
        ) : null}
        </div>
        {knowledgeRailOpen ? (
          <button
            type="button"
            className="editor-right-rail-backdrop"
            aria-label={t('app.rightRail.dismissOverlay')}
            onClick={() => {
              setKnowledgeRailVisible(false)
              setAiPanelVisible(false)
            }}
            data-testid="editor-right-rail-backdrop"
          />
        ) : null}
        {knowledgeRailSlot}
      </main>
  )
}
