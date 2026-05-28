import type {
  CSSProperties,
  Dispatch,
  MouseEvent,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react'
import { Icon } from '../../design-system/icons'
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
  toggleSidebarListOutline: () => void
  rootDir: string
  knowledgeRailVisible: boolean
  setKnowledgeRailVisible: Dispatch<SetStateAction<boolean>>
  openedTabs: string[]
  externalDiskChangedPaths: Set<string>
  activateTab: (path: string) => void | Promise<void>
  closeTab: (path: string) => void
  onTabContextMenu: (e: MouseEvent, path: string, index: number) => void
  mainPaneMode: 'visual' | 'source'
  toggleMainPaneMode: () => void
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
  editorViewRef: RefObject<import('@codemirror/view').EditorView | null>
  content: string
  handleEditorContentChange: (value: string) => void
  setActiveOutlineId: Dispatch<SetStateAction<string>>
  setStatus: (msg: string) => void
  pasteImageIntoVisualEditor: (file: File, mimeHint: string) => Promise<string | null>
  importDroppedAssets: (files: File[]) => Promise<AssetMeta[]>
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
  importDroppedAssetLinks: (files: File[]) => Promise<string[]>
  statusbarVisible: boolean
  status: string
  savedAt: string
  contentStats: { lines: number; chars: number; headings: number }
  performanceMode: boolean
  knowledgeRailSlot: React.ReactNode
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
    toggleSidebarListOutline,
    rootDir,
    knowledgeRailVisible,
    setKnowledgeRailVisible,
    openedTabs,
    externalDiskChangedPaths,
    activateTab,
    closeTab,
    onTabContextMenu,
    mainPaneMode,
    toggleMainPaneMode,
    panesRef,
    editorSurfaceStyle,
    setFileContextMenu,
    setEditorDocMenu,
    sourceCodeMirrorBootSelectionRef,
    visualEditorRef,
    editorViewRef,
    content,
    handleEditorContentChange,
    setActiveOutlineId,
    setStatus,
    pasteImageIntoVisualEditor,
    importDroppedAssets,
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
    importDroppedAssetLinks,
    statusbarVisible,
    status,
    savedAt,
    contentStats,
    performanceMode,
    knowledgeRailSlot,
  } = props

  return (
      <main
        ref={mainWithRailRef}
        className={`main main-with-rail workspace-leaf mod-active${knowledgeRailOpen ? ' has-kos-rail' : ''}${editorBodyFocused ? ' editor-body-focused' : ''}`}
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
                title={t('app.focusMode.title')}
              >
                <Icon name="focus" size="md" />
              </button>
              <button
                type="button"
                className={`icon-btn ghost-btn${sidebarListMode === 'outline' ? ' icon-btn-active' : ''}`}
                onClick={toggleSidebarListOutline}
                title={sidebarListMode === 'outline' ? t('app.sidebar.toggleOutlineFiles') : t('app.sidebar.toggleOutline')}
                aria-pressed={sidebarListMode === 'outline'}
                aria-label={t('app.sidebar.toggleOutlineAria')}
              >
                <Icon name="outline" size="md" stroke="strong" />
              </button>
              {rootDir && (
                <button
                  type="button"
                  className={`icon-btn ghost-btn${knowledgeRailVisible ? ' icon-btn-active' : ''}`}
                  onClick={() => setKnowledgeRailVisible((v) => !v)}
                  title={knowledgeRailVisible ? 'Hide knowledge panel' : 'Show backlinks and graph'}
                  aria-pressed={knowledgeRailVisible}
                >
                  <Icon name="preview" size="md" stroke="strong" />
                </button>
              )}
            </div>
          </header>
        )}
        {!focusMode && openedTabs.length > 0 && (
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={externalDiskChangedPaths}
            tabLabel={tabLabel}
            onActivate={(path) => void activateTab(path)}
            onClose={closeTab}
            onContextMenu={onTabContextMenu}
          />
        )}
        {focusMode && (
          <div className="focus-mode-actions">
            <button
              type="button"
              className="focus-exit-btn"
              onClick={() => {
                setFocusMode(false)
              }}
              title={t('app.focus.exit')}
            >
              {t('app.focus.exitLabel')}
            </button>
            <button
              type="button"
              className={`focus-preview-toggle icon-btn ghost-btn${mainPaneMode === 'source' ? ' icon-btn-active' : ''}`}
              onClick={() => toggleMainPaneMode()}
              title={
                mainPaneMode === 'source'
                  ? t('app.toolbar.modeToVisual')
                  : t('app.toolbar.modeToSource')
              }
              aria-pressed={mainPaneMode === 'source'}
              aria-label={
                mainPaneMode === 'source' ? t('app.toolbar.modeToVisualShort') : t('app.toolbar.modeToSourceShort')
              }
            >
              {mainPaneMode === 'source' ? <Icon name="preview" size="md" /> : <Icon name="source" size="md" />}
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
            className={
              mainPaneMode === 'source'
                ? 'editor-pane markdown-source-view mod-cm6 is-live-preview'
                : 'preview-pane markdown-visual-editor markdown-preview-view markdown-reading-view'
            }
            onContextMenu={(e) => {
              e.preventDefault()
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
              let hasTextSelection = false
              if (mainPaneMode === 'visual') {
                hasTextSelection = (visualEditorRef.current?.getSelectedText() ?? '').length > 0
              } else {
                const v = editorViewRef.current
                if (v) {
                  const { from, to } = v.state.selection.main
                  hasTextSelection = from !== to
                }
              }
              setEditorDocMenu({ x, y, hasTextSelection })
            }}
          >
            {mainPaneMode === 'visual' ? (
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
                onStatus={(msg) => setStatus(msg)}
                onPasteImage={pasteImageIntoVisualEditor}
                onAssetFilesDrop={importDroppedAssets}
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
                onFilesDrop={importDroppedAssetLinks}
                className="source-cm-pane markdown-source-view mod-cm6"
                style={{ height: '100%' }}
              />
            )}
          </div>
          </div>
        </section>
        {statusbarVisible ? (
          <footer className="editor-footer">
            <span className="editor-footer-message" aria-live="polite">
              {status || (savedAt ? t('app.search.savedAt', { time: savedAt }) : '')}
            </span>
            <span className="editor-footer-stats">
              <span>{t('app.statusbar.lines', { n: contentStats.lines })}</span>
              <span>{t('app.statusbar.chars', { n: contentStats.chars })}</span>
              <span>{t('app.statusbar.headings', { n: contentStats.headings })}</span>
              {performanceMode && <span>{t('app.statusbar.perf')}</span>}
            </span>
          </footer>
        ) : null}
        </div>
        {knowledgeRailSlot}
      </main>
  )
}
