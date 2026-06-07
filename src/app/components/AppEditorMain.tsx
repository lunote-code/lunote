import type {
  CSSProperties,
  Dispatch,
  MouseEvent,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { AppStatusTone } from '../hooks/useAppStatus'
import type { TocHeading } from './DocumentOutlineBlock'
import { getHistoryRestoreState } from '../../documentHistory/historyRestoreState'
import type { ToolbarItemDef } from '../../menu/menu.types'
import { EditorFormatToolbar } from './EditorFormatToolbar'
import { EditorDocumentLoadingOverlay } from './EditorDocumentLoadingOverlay'
import { KnowledgeGraphToolbarHint } from './KnowledgeGraphToolbarHint'
import {
  dismissKnowledgeGraphToolbarHint,
  isKnowledgeGraphToolbarHintDismissed,
} from '../knowledgeGraphToolbarHintStorage'
import { bridgeCaptureEditorSelection } from '../../editor/editorMutationBridge'

function hasExternalDiskDrift(path: string, externalDiskChangedPaths: ReadonlySet<string>): boolean {
  if (!path) return false
  return [...externalDiskChangedPaths].some((candidate) => pathsEqual(candidate, path))
}

export type AppEditorMainProps = {
  t: TranslateFn
  mainWithRailRef: RefObject<HTMLElement | null>
  knowledgeRailOpen: boolean
  editorBodyFocused: boolean
  setEditorBodyFocused: Dispatch<SetStateAction<boolean>>
  focusMode: boolean
  sidebarVisible: boolean
  setSidebarVisible: Dispatch<SetStateAction<boolean>>
  activePath: string
  workspaceFolderName: string
  tabLabel: (path: string) => string
  activeDocumentTitle: string
  activeDocumentSubtitle: string
  setFocusMode: Dispatch<SetStateAction<boolean>>
  sidebarListMode: 'files' | 'outline'
  rootDir: string
  knowledgeRailVisible: boolean
  setKnowledgeRailVisible: Dispatch<SetStateAction<boolean>>
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
  savedAt: string
  contentStats: { lines: number; chars: number; headings: number }
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
  editorDocumentLoading: boolean
}

export function AppEditorMain(props: AppEditorMainProps) {
  const {
    t,
    mainWithRailRef,
    knowledgeRailOpen,
    editorBodyFocused,
    setEditorBodyFocused,
    focusMode,
    sidebarVisible,
    setSidebarVisible,
    activePath,
    workspaceFolderName,
    tabLabel,
    activeDocumentTitle,
    activeDocumentSubtitle,
    setFocusMode,
    sidebarListMode,
    rootDir,
    knowledgeRailVisible,
    setKnowledgeRailVisible,
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
    handleWikiHover,
    suppressMarkdownSerdeRef,
    cmMountKey,
    visualMountKey,
    editorExtensions,
    handleSourceViewReady,
    statusbarVisible,
    status,
    statusTone,
    savedAt,
    contentStats,
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
    editorDocumentLoading,
  } = props

  const activeDocumentDirty = isPathDirty(activePath)
  const activeDocumentExternal = hasExternalDiskDrift(activePath, externalDiskChangedPaths)
  const activeDocumentHistoryRestore = activePath ? getHistoryRestoreState(activePath) : null
  const showEmptyState = !activePath && openedTabs.length === 0
  const graphButtonRef = useRef<HTMLButtonElement>(null)
  const [graphToolbarHintOpen, setGraphToolbarHintOpen] = useState(
    () => !isKnowledgeGraphToolbarHintDismissed(),
  )

  const dismissGraphToolbarHint = useCallback(() => {
    dismissKnowledgeGraphToolbarHint()
    setGraphToolbarHintOpen(false)
  }, [])

  useEffect(() => {
    if (knowledgeRailVisible && graphToolbarHintOpen) {
      dismissGraphToolbarHint()
    }
  }, [knowledgeRailVisible, graphToolbarHintOpen, dismissGraphToolbarHint])

  const showGraphToolbarHint = Boolean(rootDir) && !focusMode && graphToolbarHintOpen

  return (
      <main
        ref={mainWithRailRef}
        className={`main main-with-rail workspace-leaf mod-active${knowledgeRailOpen ? ' has-kos-rail' : ''}${editorBodyFocused ? ' editor-body-focused' : ''}`}
        data-drop-zone="editor"
      >
        <div
          className="main-editor-stack workspace-leaf-content"
          data-type="markdown"
          data-mode={mainPaneMode === 'source' ? 'source' : 'preview'}
        >
        {!focusMode && (
          <header className="editor-header view-header">
            <div className="editor-header-left">
              {!sidebarVisible && (
              <button
                className="icon-btn ghost-btn"
                onClick={() => setSidebarVisible(true)}
                title={t('app.sidebar.show')}
                aria-label={t('app.sidebar.show')}
              >
                  <Icon name="sidebar-open" size="md" />
                </button>
              )}
              <div className="editor-document-heading" title={activePath ? tabLabel(activePath) : workspaceFolderName}>
                <span className="editor-document-title">{activeDocumentTitle}</span>
                <span className="editor-document-subtitle">{activeDocumentSubtitle}</span>
              </div>
            </div>
            <div className="editor-header-right">
              <button
                className="icon-btn ghost-btn"
                onClick={() => {
                  setFocusMode(true)
                }}
                title={`${t('app.focusMode.title')} (${formatCommandShortcutDisplay('toggle-focus')})`}
                aria-label={t('app.focusMode.title')}
              >
                <Icon name="focus" size="md" />
              </button>
              {rootDir && (
                <button
                  ref={graphButtonRef}
                  type="button"
                  className={`icon-btn ghost-btn${knowledgeRailVisible ? ' icon-btn-active' : ''}`}
                  onClick={() => {
                    dismissGraphToolbarHint()
                    setKnowledgeRailVisible((v) => !v)
                  }}
                  title={
                    knowledgeRailVisible ? t('app.knowledge.hidePanel') : t('app.knowledge.showPanel')
                  }
                  aria-pressed={knowledgeRailVisible}
                  aria-label={
                    knowledgeRailVisible ? t('app.knowledge.hidePanel') : t('app.knowledge.showPanel')
                  }
                >
                  <Icon name="graph" size="md" stroke="strong" />
                </button>
              )}
            </div>
          </header>
        )}
        <KnowledgeGraphToolbarHint
          t={t}
          anchorRef={graphButtonRef}
          open={showGraphToolbarHint}
          onDismiss={dismissGraphToolbarHint}
        />
        {!focusMode && openedTabs.length > 0 && (
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
          />
        )}
        {!focusMode && !showEmptyState && mainPaneMode === 'visual' && openedTabs.length > 0 ? (
          <EditorFormatToolbar
            t={t}
            commands={toolbarEditorFormat}
            onCommand={onFormatCommand}
            hasTextSelection={editorHasTextSelection}
            isCommandActive={isFormatCommandActive}
            onTextColorPick={onEditorTextColorPick}
          />
        ) : null}
        {activeDocumentHistoryRestore ? (
          <div
            className={`editor-history-restore-banner${focusMode ? ' editor-history-restore-banner--focus' : ''}`}
            role="status"
            aria-live="polite"
          >
            <Icon name="history" size="sm" />
            <span>{t('app.history.banner')}</span>
          </div>
        ) : null}
        {focusMode && (
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
        )}
        <section ref={panesRef} className="panes editor-only">
          <div
            className="editor-body-surface view-content"
            style={editorSurfaceStyle}
            onFocusCapture={() => setEditorBodyFocused(true)}
            onBlurCapture={(e) => {
              const next = e.relatedTarget as Node | null
              if (!e.currentTarget.contains(next)) setEditorBodyFocused(false)
            }}
          >
          <div
            data-testid="editor-main"
            id="editor-main-panel"
            role="tabpanel"
            className={
              mainPaneMode === 'source'
                ? 'editor-pane markdown-source-view mod-cm6 is-live-preview'
                : 'preview-pane markdown-visual-editor markdown-preview-view markdown-reading-view'
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
            <EditorDocumentLoadingOverlay t={t} visible={editorDocumentLoading && !showEmptyState} />
            {showEmptyState ? (
              <EmptyState
                variant="page"
                icon={rootDir ? 'note' : 'workspace-open'}
                title={rootDir ? t('app.editor.empty.noNoteTitle') : t('app.sidebar.empty.title')}
                description={rootDir ? t('app.editor.empty.noNoteDesc') : undefined}
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
            ) : mainPaneMode === 'visual' ? (
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
                onWikiLinkHover={handleWikiHover}
                suppressMarkdownSyncRef={suppressMarkdownSerdeRef}
              />
            ) : (
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
            )}
          </div>
          </div>
        </section>
        {statusbarVisible ? (
          <footer
            className={`editor-footer${status ? ' has-status' : ''}${statusTone !== 'neutral' ? ` editor-footer--${statusTone}` : ''}${focusMode ? ' editor-footer--focus-minimal' : ''}`}
          >
            <span className="editor-footer-message" aria-live="polite">
              {status ||
                (activeDocumentHistoryRestore
                  ? t('app.history.banner')
                  : activeDocumentExternal
                  ? t('app.statusbar.externalChanged')
                  : activeDocumentDirty
                    ? t('app.statusbar.unsaved')
                    : savedAt
                      ? t('app.search.savedAt', { time: savedAt })
                      : t('app.statusbar.ready'))}
            </span>
            <span className="editor-footer-stats">
              <span>{t('app.statusbar.lines', { n: contentStats.lines })}</span>
              <span>{t('app.statusbar.chars', { n: contentStats.chars })}</span>
              <span>{t('app.statusbar.headings', { n: contentStats.headings })}</span>
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
        {knowledgeRailSlot}
      </main>
  )
}
