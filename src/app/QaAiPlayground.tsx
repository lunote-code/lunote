import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import { getEnMessagesSnapshot } from '../i18n/localeRegistry'
import { AppToastHost } from './components/AppToastHost'
import {
  dispatchDocumentCommand,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import { isBufferTabId } from './workspace/constants'
import { EditorRightRailContainer, type EditorRightRailView } from './components/EditorRightRailContainer'
import { AiRightRail } from '../editor/ai/ui/AiRightRail'
import {
  captureAiRailScrollSnapshotForRestore,
  preserveAiRailScrollDuring,
  scheduleAiRailScrollRestoreAfterSideEffects,
  syncAiRailScrollSnapshot,
} from '../editor/ai/ui/aiRailScrollPreserve'
import '../editor/ai/ui/aiPanel.css'
import { requestEditorAiSelectionAction } from '../editor/ai/editorAiActions'
import { EditorOpenReason } from '../editor/editorOpenReason'
import { initEditorMutationBridge } from '../editor/editorMutationBridge'
import { hasAiEditorSelection } from '../editor/ai/context/readAiEditorSelection'
import { resolveBlockAiTarget } from '../editor/ai/editorBlockAi'
import { useEditorAiCursorInsert } from '../editor/ai/hooks/useEditorAiCursorInsert'
import { useEditorBlockAi } from '../editor/ai/hooks/useEditorBlockAi'
import { TiptapMarkdownEditor, type TiptapMarkdownEditorHandle } from '../editor/TiptapMarkdownEditor'
import { EditorBlockAiHandle } from './components/EditorBlockAiHandle'
import { EditorAiSelectionToolbar } from './components/EditorAiSelectionToolbar'
import { EditorAiInsertUndoChip } from './components/EditorAiInsertUndoChip'
import { EditorBlockAiStatusChip } from './components/EditorBlockAiStatusChip'
import { Icon } from '../design-system/icons'
import { useSidebarOutlineHeadings } from './hooks/useSidebarOutlineHeadings'
import type { TocHeading } from './components/DocumentOutlineBlock'
import { bootstrapWorkspaceLinkGraphIndex, waitForLinkIndexReady } from '../editor/knowledgeRuntime'
import { setActiveTransactionDoc } from '../menu/commandTransaction'
import {
  getAppSettingsSnapshot,
  markAppSettingsHydratedForTests,
} from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { resolveAiConversationDocKey } from '../settings-runtime/aiSettings'
import { resetAiConversationStoreForTests } from '../editor/ai/persistence/aiConversationStore'
import {
  clearStoredAiConnectionTest,
  writeStoredAiConnectionTest,
} from '../settings-runtime/aiConnectionTestStorage'
import { registerKnowledgeInteractionHost } from '../editor/knowledgeOS/ui/knowledgeInteractionHost'
import { isCodeBlockCmFocused } from '../editor/codeBlock/cm/codeBlockCmFocus'

const QA_ROOT = '/qa-vault'
const QA_DOC_A = `${QA_ROOT}/ai-note-a.md`
const QA_DOC_B = `${QA_ROOT}/ai-note-b.md`
const QA_MARKDOWN = `# AI QA

Selectable paragraph for context chips.

Second paragraph for insert tests.
`

const QA_FIXTURES: Record<string, string> = {
  'ai-note-a.md': QA_MARKDOWN,
  'ai-note-b.md': '# Note B\n\nMention target body for merge outline tests.\n',
  'tags-测试.md': '# Tags 测试\n\nTagged note body for wiki link navigation.\n',
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

const QA_BOOTSTRAP = {
  mergedMessages: getEnMessagesSnapshot(),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getEnMessagesSnapshot(),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_AI__?: {
      resetState: () => void
      openPanel: () => void
      closePanel: () => void
      isPanelOpen: () => boolean
      getDraft: () => string
      getMessageTexts: () => Array<{ role: string; content: string }>
      getRailScrollTop: () => number
      setRailScrollTop: (top: number) => void
      selectPlainText: (needle: string) => boolean
      getEditorMarkdown: () => string
      setEditorMarkdown: (markdown: string) => void
      getActiveBlockAiBlockType: () => string | null
      getContextChipTexts: () => string[]
      switchDocKey: (docKey: string) => void
      setConversationScope: (scope: 'per-note' | 'global') => void
      requestAskSelectionDraft: () => void
      isStreaming: () => boolean
      getConversationDocKey: () => string | null
      getActiveDocKey: () => string
      getOpenedTabs: () => string[]
      getFrontmatterFields: (docKey: string) => Record<string, unknown> | null
      getToastMessages: () => string[]
      getOutlineTitles: () => string[]
      clearDocNavigationLog: () => void
      getDocNavigationLog: () => Array<{ to: string; source: string; at: number }>
      simulateDocumentSave: () => void | Promise<void>
      clearConnectionTest: () => Promise<void>
      getConnectionStatusTestId: () => 'ai-rail-connection-verified' | 'ai-rail-connection-unverified' | null
    }
  }
}

function clearWebAiConversationStorage(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('Lunote:aiConversation:v1:')) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function QaAiInner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('booting')
  const [activeDocKey, setActiveDocKey] = useState(QA_DOC_A)
  const [content, setContent] = useState(QA_MARKDOWN)
  const [aiPanelVisible, setAiPanelVisible] = useState(false)
  const [knowledgePanelVisible, setKnowledgePanelVisible] = useState(false)
  const [rightRailView, setRightRailView] = useState<EditorRightRailView>('ai')
  const [visualSelectionTick, setVisualSelectionTick] = useState(0)
  const [openedTabs, setOpenedTabs] = useState<string[]>([QA_DOC_A])

  const activeDocKeyRef = useRef(activeDocKey)
  const contentRef = useRef(content)
  const aiPanelVisibleRef = useRef(aiPanelVisible)
  const draftRef = useRef('')
  const openedTabsRef = useRef(openedTabs)
  const frontmatterByDocKeyRef = useRef<Record<string, Record<string, unknown>>>({})
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const editorPanelRef = useRef<HTMLDivElement | null>(null)
  const editorViewRef = useRef<import('@codemirror/view').EditorView | null>(null)
  const mainPaneModeRef = useRef<'visual' | 'source'>('visual')
  const liveOutlineByPathRef = useRef(new Map<string, TocHeading[]>())
  const outlineHeadingsRef = useRef<TocHeading[]>([])
  const docNavigationLogRef = useRef<Array<{ to: string; source: string; at: number }>>([])
  const [liveOutlineTick, setLiveOutlineTick] = useState(0)

  const recordDocNavigation = useCallback((to: string, source: string) => {
    docNavigationLogRef.current.push({ to, source, at: Date.now() })
  }, [])

  const openQaDocument = useCallback((docKey: string, source: string) => {
    recordDocNavigation(docKey, source)
    setOpenedTabs((tabs) => (tabs.includes(docKey) ? tabs : [...tabs, docKey]))
    void dispatchDocumentCommand({
      type: 'REPLACE_ACTIVE_DOCUMENT',
      path: docKey,
      content: docKey === activeDocKeyRef.current ? contentRef.current : QA_FIXTURES[docKey.slice(QA_ROOT.length + 1)] ?? '',
      source,
    })
    setActiveDocKey(docKey)
    setVisualSelectionTick((tick) => tick + 1)
  }, [recordDocNavigation])

  const markdownOutlineHeadings = useSidebarOutlineHeadings(activeDocKey, content)
  const outlineHeadings = useMemo(() => {
    void liveOutlineTick
    const live = liveOutlineByPathRef.current.get(activeDocKey)
    if (live && live.length > 0) {
      return live
    }
    return markdownOutlineHeadings
  }, [activeDocKey, markdownOutlineHeadings, liveOutlineTick])
  outlineHeadingsRef.current = outlineHeadings

  const handleOutlineHeadingsChange = useCallback((headings: TocHeading[]) => {
    const docKey = activeDocKeyRef.current
    if (headings.length === 0) {
      liveOutlineByPathRef.current.delete(docKey)
    } else {
      liveOutlineByPathRef.current.set(docKey, headings)
    }
    setLiveOutlineTick((tick) => tick + 1)
  }, [])

  activeDocKeyRef.current = activeDocKey
  contentRef.current = content
  aiPanelVisibleRef.current = aiPanelVisible
  openedTabsRef.current = openedTabs

  const tabLabel = useCallback((path: string) => {
    if (isBufferTabId(path)) return 'Scratch note'
    return path.split('/').pop() ?? path
  }, [])

  useEditorAiCursorInsert({
    docKey: activeDocKey,
    activePath: activeDocKey,
    activeTabLabel: tabLabel(activeDocKey),
    content,
    visualEditorRef,
  })

  useEditorBlockAi({
    docKey: activeDocKey,
    activePath: activeDocKey,
    activeTabLabel: tabLabel(activeDocKey),
    content,
    visualEditorRef,
  })

  const [codeBlockCmFocused, setCodeBlockCmFocused] = useState(false)

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

  const showBlockAiHandle = !codeBlockCmFocused && !hasAiEditorSelection(visualEditorRef)
  const showAiSelectionToolbar = !codeBlockCmFocused && hasAiEditorSelection(visualEditorRef)

  const resetState = useCallback(() => {
    resetAiConversationStoreForTests()
    clearWebAiConversationStorage()
    markAppSettingsHydratedForTests({ ...QA_AI_SETTINGS, ai: { ...QA_AI_SETTINGS.ai } })
    void writeStoredAiConnectionTest({
      ok: true,
      at: Date.now(),
      provider: QA_AI_SETTINGS.ai.provider,
    })
    setActiveDocKey(QA_DOC_A)
    setContent(QA_MARKDOWN)
    setAiPanelVisible(false)
    setKnowledgePanelVisible(false)
    setRightRailView('ai')
    draftRef.current = ''
    frontmatterByDocKeyRef.current = {}
    docNavigationLogRef.current = []
    setOpenedTabs([QA_DOC_A])
    setVisualSelectionTick((tick) => tick + 1)
    setStatus('ready')
    void dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT',
      root: QA_ROOT,
      path: QA_DOC_A,
      source: 'qa-ai-reset',
    })
  }, [])

  useEffect(() => {
    void (async () => {
      const paths = Object.keys(QA_FIXTURES).map((file) => `${QA_ROOT}/${file}`)
      await bootstrapWorkspaceLinkGraphIndex(QA_ROOT, paths, async (path) => {
        const rel = path.slice(QA_ROOT.length + 1)
        return QA_FIXTURES[rel] ?? ''
      })
      await waitForLinkIndexReady(15_000)
    })()
  }, [])

  useEffect(() => {
    resetDocumentRuntimeKernel()
    registerDocumentRuntimeCapabilities({
      readDocument: async (_root, path) => {
        const rel = path.startsWith(`${QA_ROOT}/`) ? path.slice(QA_ROOT.length + 1) : path.split('/').pop() ?? ''
        if (path === activeDocKeyRef.current) return contentRef.current
        return QA_FIXTURES[rel] ?? ''
      },
      readDocumentForVerify: async (_root, path) => {
        const rel = path.startsWith(`${QA_ROOT}/`) ? path.slice(QA_ROOT.length + 1) : path.split('/').pop() ?? ''
        if (path === activeDocKeyRef.current) return contentRef.current
        return QA_FIXTURES[rel] ?? ''
      },
      writeDocument: async () => {},
      setActiveDocument: (path, markdown) => {
        recordDocNavigation(path, 'document-runtime:setActiveDocument')
        activeDocKeyRef.current = path
        setActiveDocKey(path)
        setContent(markdown)
      },
      renderContent: () => {},
      setTabs: (tabs) => {
        setOpenedTabs(Array.isArray(tabs) ? [...tabs] : tabs(openedTabsRef.current))
      },
      onDocumentOpened: () => undefined,
      onDocumentSaved: () => undefined,
      onOpenTabLimitReached: () => undefined,
    })
    registerKnowledgeInteractionHost({
      getRootDir: () => QA_ROOT,
      openAbsolutePath: () => {},
      clearEditorSelection: () => {},
      focusEditor: () => {},
      onHoverIdChange: () => {},
      openSearchModal: () => {},
      updateDocumentFrontmatter: async (docKey, updater) => {
        const current = frontmatterByDocKeyRef.current[docKey] ?? {}
        frontmatterByDocKeyRef.current[docKey] = updater({ ...current })
        return true
      },
    })
    return () => {
      registerKnowledgeInteractionHost(null)
      resetDocumentRuntimeKernel()
    }
  }, [recordDocNavigation])

  useEffect(() => {
    initEditorMutationBridge(visualEditorRef, editorViewRef, mainPaneModeRef)
  }, [])

  useEffect(() => {
    setActiveTransactionDoc(activeDocKey)
  }, [activeDocKey])

  useEffect(() => {
    resetState()
  }, [resetState])

  const readMessageTexts = useCallback(() => {
    return Array.from(
      document.querySelectorAll(
        '[data-testid="ai-chat-message-user"], [data-testid="ai-chat-message-assistant"]',
      ),
    ).map((node) => {
      const testId = node.getAttribute('data-testid') ?? ''
      const role = testId.replace('ai-chat-message-', '')
      const contentNode = node.querySelector('.ai-rail-message-content')
      return {
        role,
        content: (contentNode?.textContent ?? node.textContent ?? '').trim(),
      }
    })
  }, [])

  const selectPlainText = useCallback((needle: string) => {
    const editor = visualEditorRef.current?.getEditor()
    if (!editor) return false
    let from: number | null = null
    let to: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (!node.isTextblock || from !== null) return
      const text = node.textContent
      const index = text.indexOf(needle)
      if (index < 0) return
      from = pos + 1 + index
      to = from + needle.length
    })
    if (from === null || to === null) return false
    editor.chain().focus().setTextSelection({ from, to }).run()
    setVisualSelectionTick((tick) => tick + 1)
    return true
  }, [])

  useEffect(() => {
    window.__QA_AI__ = {
      resetState,
      openPanel: () => setAiPanelVisible(true),
      closePanel: () => setAiPanelVisible(false),
      isPanelOpen: () => aiPanelVisibleRef.current,
      getDraft: () => draftRef.current || (document.querySelector<HTMLTextAreaElement>('[data-testid="ai-chat-input"]')?.value ?? ''),
      getMessageTexts: readMessageTexts,
      getRailScrollTop: () => document.querySelector('.ai-rail-scroll')?.scrollTop ?? 0,
      setRailScrollTop: (top) => {
        const el = document.querySelector('.ai-rail-scroll')
        if (el instanceof HTMLElement) {
          el.scrollTop = top
          syncAiRailScrollSnapshot()
        }
      },
      selectPlainText,
      getEditorMarkdown: () => visualEditorRef.current?.getMarkdown(true) ?? contentRef.current,
      setEditorMarkdown: (markdown) => {
        contentRef.current = markdown
        setContent(markdown)
        setVisualSelectionTick((tick) => tick + 1)
      },
      getActiveBlockAiBlockType: () => {
        const editor = visualEditorRef.current?.getEditor()
        if (!editor) return null
        return resolveBlockAiTarget(editor)?.blockType ?? null
      },
      getContextChipTexts: () =>
        Array.from(document.querySelectorAll('.ai-rail-context-meta-part')).map(
          (chip) => chip.textContent?.trim() ?? '',
        ),
      switchDocKey: (docKey) => {
        openQaDocument(docKey, 'qa:switchDocKey')
      },
      setConversationScope: (scope) => {
        markAppSettingsHydratedForTests({
          ...getAppSettingsSnapshot(),
          ai: {
            ...getAppSettingsSnapshot().ai,
            conversationScope: scope,
          },
        })
        setVisualSelectionTick((tick) => tick + 1)
      },
      requestAskSelectionDraft: () => {
        requestEditorAiSelectionAction('ask-selection', t)
      },
      isStreaming: () => Boolean(document.querySelector('[data-testid="ai-chat-stop-button"]')),
      getConversationDocKey: () =>
        resolveAiConversationDocKey(getAppSettingsSnapshot(), activeDocKeyRef.current, activeDocKeyRef.current),
      getActiveDocKey: () => activeDocKeyRef.current,
      getOpenedTabs: () => [...openedTabsRef.current],
      getFrontmatterFields: (docKey) => frontmatterByDocKeyRef.current[docKey] ?? null,
      getToastMessages: () =>
        [...document.querySelectorAll('.app-toast-message')].map((node) => node.textContent?.trim() ?? ''),
      getOutlineTitles: () => outlineHeadingsRef.current.map((heading) => heading.title),
      clearDocNavigationLog: () => {
        docNavigationLogRef.current = []
      },
      getDocNavigationLog: () => [...docNavigationLogRef.current],
      simulateDocumentSave: async () => {
        captureAiRailScrollSnapshotForRestore()
        const path = activeDocKeyRef.current
        const body = contentRef.current
        const normalized = body.endsWith('\n') ? body.slice(0, -1) : `${body}\n`
        preserveAiRailScrollDuring(() => {
          contentRef.current = normalized
          setContent(normalized)
          setVisualSelectionTick((tick) => tick + 1)
        })
        await dispatchDocumentCommand({
          type: 'SAVE_DOCUMENT',
          root: QA_ROOT,
          path,
          content: normalized,
          source: 'qa-save',
        })
        scheduleAiRailScrollRestoreAfterSideEffects()
      },
      clearConnectionTest: async () => {
        await clearStoredAiConnectionTest()
      },
      getConnectionStatusTestId: () => {
        if (document.querySelector('[data-testid="ai-rail-connection-verified"]')) {
          return 'ai-rail-connection-verified'
        }
        if (document.querySelector('[data-testid="ai-rail-connection-unverified"]')) {
          return 'ai-rail-connection-unverified'
        }
        return null
      },
    }
    return () => {
      delete window.__QA_AI__
    }
  }, [openQaDocument, readMessageTexts, recordDocNavigation, resetState, selectPlainText, t])

  const docLabel = useMemo(() => activeDocKey.split('/').pop() ?? activeDocKey, [activeDocKey])

  return (
    <div className="qa-ai-shell" style={{ padding: 24, minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">AI QA</h1>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-ai-doc-key">{activeDocKey}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" data-testid="qa-switch-doc-a" onClick={() => openQaDocument(QA_DOC_A, 'qa:ui-switch-doc-a')}>
          Open note A
        </button>
        <button type="button" data-testid="qa-switch-doc-b" onClick={() => openQaDocument(QA_DOC_B, 'qa:ui-switch-doc-b')}>
          Open note B
        </button>
      </div>

      <div
        className="main main-with-rail workspace-leaf mod-active"
        style={{ display: 'flex', minHeight: 420, gap: 0 }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            className="editor-tab-bar"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}
          >
            {openedTabs.map((tabPath) => (
              <button
                key={tabPath}
                type="button"
                data-testid={`qa-editor-tab-${tabPath}`}
                aria-current={tabPath === activeDocKey ? 'page' : undefined}
                onClick={() => openQaDocument(tabPath, 'qa:editor-tab')}
              >
                {tabLabel(tabPath)}
              </button>
            ))}
            <span data-testid="qa-active-tab">{docLabel}</span>
            <button
              type="button"
              className={`luna-chrome-icon-btn editor-chrome-action-btn${knowledgePanelVisible ? ' luna-chrome-icon-btn--active' : ''}`}
              data-testid="editor-knowledge-toggle"
              aria-label="Knowledge panel"
              aria-pressed={knowledgePanelVisible}
              onClick={() =>
                setKnowledgePanelVisible((visible) => {
                  const next = !visible
                  if (next) setRightRailView('knowledge')
                  return next
                })
              }
            >
              <Icon name="graph" size="sm" stroke="strong" />
            </button>
            <button
              type="button"
              className={`luna-chrome-icon-btn editor-chrome-action-btn${aiPanelVisible ? ' luna-chrome-icon-btn--active' : ''}`}
              data-testid="editor-ai-toggle"
              aria-label="AI panel"
              aria-pressed={aiPanelVisible}
              onClick={() =>
                setAiPanelVisible((visible) => {
                  const next = !visible
                  if (next) setRightRailView('ai')
                  return next
                })
              }
            >
              <Icon name="ai" size="sm" stroke="strong" />
            </button>
          </div>
          <div
            ref={editorPanelRef}
            id="editor-main-panel"
            className="preview-pane markdown-visual-editor"
            data-testid="qa-editor-panel"
            style={{ flex: 1, minHeight: 280, overflow: 'auto', position: 'relative' }}
          >
            <TiptapMarkdownEditor
              ref={visualEditorRef}
              documentKey={activeDocKey}
              markdown={content}
              activePath={activeDocKey}
              rootDir={QA_ROOT}
              sidebarListMode="outline"
              onMarkdownChange={setContent}
              onActiveHeadingChange={() => {}}
              onSelectionActivity={() => setVisualSelectionTick((tick) => tick + 1)}
              onOutlineHeadingsChange={handleOutlineHeadingsChange}
              onStatus={() => {}}
              onPasteImage={async () => null}
              openReason={EditorOpenReason.ColdOpen}
            />
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
            <div className="editor-ai-insert-undo-host">
              <EditorBlockAiStatusChip t={t} />
              <EditorAiInsertUndoChip t={t} activePath={activeDocKey} />
            </div>
          </div>
        </div>

        {knowledgePanelVisible || aiPanelVisible ? (
          <aside className="editor-right-rail" style={{ width: 360, minWidth: 360 }}>
            {knowledgePanelVisible && aiPanelVisible ? (
              <EditorRightRailContainer
                t={t}
                knowledgeOpen={knowledgePanelVisible}
                aiOpen={aiPanelVisible}
                activeView={rightRailView}
                onActiveViewChange={setRightRailView}
                knowledgePanel={
                  <div data-testid="qa-knowledge-rail-panel" className="qa-knowledge-rail-panel">
                    Knowledge panel
                  </div>
                }
                aiPanel={
                  <AiRightRail
                    visible
                    panelActive={rightRailView === 'ai'}
                    activeDocKey={activeDocKey}
                    activePath={activeDocKey}
                    content={content}
                    visualEditorRef={visualEditorRef}
                    selectionTick={visualSelectionTick}
                    onClose={() => setAiPanelVisible(false)}
                  />
                }
              />
            ) : aiPanelVisible ? (
              <AiRightRail
                visible
                activeDocKey={activeDocKey}
                activePath={activeDocKey}
                content={content}
                visualEditorRef={visualEditorRef}
                selectionTick={visualSelectionTick}
                onClose={() => setAiPanelVisible(false)}
              />
            ) : (
              <div data-testid="qa-knowledge-rail-panel" className="qa-knowledge-rail-panel">
                Knowledge panel
              </div>
            )}
          </aside>
        ) : null}
      </div>
      <AppToastHost />
    </div>
  )
}

export function QaAiPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaAiInner />
    </I18nProvider>
  )
}
