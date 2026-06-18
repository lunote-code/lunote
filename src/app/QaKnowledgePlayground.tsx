import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import {
  absolutePathToDocKeyOs,
  deleteNote,
  initKnowledgeOS,
  onKnowledgeOSWorkspaceOpened,
  openNoteInWorkspace,
  setBacklinkPanelDocKey,
  syncNoteGraphTopologyFromRoute,
  getNoteGraphTopology,
} from '../editor/knowledgeOS/index'
import { requestOsRevision } from '../editor/knowledgeOS/knowledgeUIBridge'
import { setPendingGraphCenter } from '../editor/knowledgeOS/graphNavigationRuntime'
import { getGraphViewport, setGraphViewportIntent, fitGraphViewToNodes, resetGraphViewToDefault } from '../editor/knowledgeOS/graphViewportRuntime'
import { KnowledgeRightRail } from '../editor/knowledgeOS/ui/KnowledgeRightRail'
import { registerKnowledgeInteractionHost } from '../editor/knowledgeOS/ui/knowledgeInteractionHost'
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
import { installNavigationRuntimeFirewall } from '../navigation/navigationRuntimeFirewall'
import { pathsEqual } from '../lib/workspacePathUtils'
import { createQaKnowledgeFrontmatterUpdater } from './qa/createQaKnowledgeFrontmatterUpdater'
import {
  cloneQaKnowledgeFixtures,
  QA_KNOWLEDGE_FIXTURES,
  QA_KNOWLEDGE_ROOT,
  qaKnowledgeFixtureRelPath,
  qaKnowledgeNotePath,
  type QaKnowledgeNoteId,
} from './qa/qaKnowledgeFixtures'

export { QA_KNOWLEDGE_FIXTURES, QA_KNOWLEDGE_ROOT }
export type { QaKnowledgeNoteId }

declare global {
  interface Window {
    __QA_KNOWLEDGE__?: {
      activeDocKey: () => string | null
      activePath: () => string | null
      openedTabPaths: () => string[]
      setActiveNote: (note: QaKnowledgeNoteId) => Promise<void>
      openSearch: () => void
      closeSearch: () => void
      countInRail: (selector: string) => number
      backlinkSourceTitles: () => string[]
      graphTopologyCenterDocKey: () => string | null
      graphCenterLabel: () => string | null
      graphNodeLabels: () => string[]
      getFixtureMarkdown: (note: QaKnowledgeNoteId) => string
      writeDocumentCalls: () => string[]
      graphViewport: () => { x: number; y: number; zoom: number }
      panGraph: (dx: number, dy: number) => void
      zoomGraph: (factor: number) => void
      fitGraphViewport: () => void
      resetGraphViewport: () => void
      deleteVaultNote: (docKey: string) => Promise<void>
      findGraphNode: (label: string) => {
        id: string
        docKey: string
        label: string
        status: 'resolved' | 'unresolved'
        navigable: boolean
      } | null
      graphTopologyEdgePairs: () => string[]
    }
  }
}

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

function QaKnowledgeInner() {
  const [status, setStatus] = useState('booting')
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [openedTabs, setOpenedTabs] = useState<string[]>([])
  const [railVisible, setRailVisible] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editorContent, setEditorContent] = useState('Draft: ')
  const fixturesRef = useRef(cloneQaKnowledgeFixtures())
  const writeDocumentCallsRef = useRef<string[]>([])
  const activeDocKeyRef = useRef<string | null>(null)
  const activePathRef = useRef<string | null>(null)
  const openedTabsRef = useRef<string[]>([])

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
    syncNoteGraphTopologyFromRoute(docKey)
    if (docKey) {
      setPendingGraphCenter(docKey, `page:${docKey}`)
    }
  }, [])

  const openPathInTab = useCallback(async (path: AbsoluteDocPath, source: string) => {
    await dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT_IN_TAB',
      root: QA_KNOWLEDGE_ROOT,
      path,
      source,
    })
  }, [])

  const activateNote = useCallback(
    async (note: QaKnowledgeNoteId) => {
      await openPathInTab(qaKnowledgeNotePath(note), 'qa-knowledge-set-active')
    },
    [openPathInTab],
  )

  const persistFixture = useCallback(async (path: string, content: string) => {
    const rel = qaKnowledgeFixtureRelPath(path)
    fixturesRef.current[rel] = content
    writeDocumentCallsRef.current.push(path)
  }, [])

  const deleteVaultNote = useCallback(async (docKey: string) => {
    await deleteNote(docKey)
    syncKnowledgeRoute(activeDocKeyRef.current)
    requestOsRevision()
  }, [syncKnowledgeRoute])

  const updateDocumentFrontmatter = useMemo(
    () =>
      createQaKnowledgeFrontmatterUpdater(QA_KNOWLEDGE_ROOT, fixturesRef, {
        onPersist: async (_root, absolutePath, full) => {
          await persistFixture(absolutePath, full)
        },
      }),
    [persistFixture],
  )

  useEffect(() => {
    openedTabsRef.current = openedTabs
  }, [openedTabs])

  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath])

  useEffect(() => {
    window.__QA_KNOWLEDGE__ = {
      activeDocKey: () => activeDocKeyRef.current,
      activePath: () => activePathRef.current,
      openedTabPaths: () => [...openedTabsRef.current],
      setActiveNote: activateNote,
      openSearch,
      closeSearch: () => setSearchOpen(false),
      countInRail: (selector) => document.querySelectorAll(`.qa-knowledge-rail ${selector}`).length,
      backlinkSourceTitles: () =>
        Array.from(document.querySelectorAll('.qa-knowledge-rail .kos-backlink-source')).map(
          (el) => el.textContent?.trim() ?? '',
        ),
      graphTopologyCenterDocKey: () => getNoteGraphTopology().centerDocKey,
      graphCenterLabel: () =>
        document
          .querySelector('.qa-knowledge-rail .kos-graph-node--center .kos-graph-node-label')
          ?.textContent?.trim() ?? null,
      graphNodeLabels: () =>
        Array.from(document.querySelectorAll('.qa-knowledge-rail .kos-graph-node-label')).map(
          (el) => el.textContent?.trim() ?? '',
        ),
      getFixtureMarkdown: (note) => fixturesRef.current[`${note}.md`] ?? '',
      writeDocumentCalls: () => [...writeDocumentCallsRef.current],
      graphViewport: () => getGraphViewport(),
      panGraph: (dx, dy) => {
        setGraphViewportIntent({ kind: 'pan', dx, dy })
      },
      zoomGraph: (factor) => {
        setGraphViewportIntent({ kind: 'zoom', factor })
      },
      fitGraphViewport: () => {
        const topo = getNoteGraphTopology()
        const svg = document.querySelector('.qa-knowledge-rail .kos-graph-svg')
        const w = svg?.clientWidth ?? 400
        const h = svg?.clientHeight ?? 300
        fitGraphViewToNodes(topo.nodes, w, h)
      },
      resetGraphViewport: () => {
        resetGraphViewToDefault()
      },
      deleteVaultNote,
      findGraphNode: (label) => {
        const needle = label.toLowerCase()
        const node = getNoteGraphTopology().nodes.find(
          (n) =>
            n.label.toLowerCase().includes(needle) ||
            n.docKey.toLowerCase().includes(needle),
        )
        return node
          ? {
              id: node.id,
              docKey: node.docKey,
              label: node.label,
              status: node.status,
              navigable: node.navigable,
            }
          : null
      },
      graphTopologyEdgePairs: () =>
        getNoteGraphTopology().edges.map((edge) => `${edge.from}\0${edge.to}`),
    }
    return () => {
      delete window.__QA_KNOWLEDGE__
    }
  }, [activateNote, openSearch, deleteVaultNote])

  useEffect(() => {
    let cancelled = false
    installNavigationRuntimeFirewall()
    resetDocumentRuntimeKernel()

    registerDocumentRuntimeCapabilities({
      readDocument: async (_root, path) => readFixture(path),
      readDocumentForVerify: async (_root, path) => readFixture(path),
      writeDocument: async (_root, path, content) => {
        await persistFixture(path, content)
      },
      setActiveDocument: (path) => {
        const docKey = absolutePathToDocKeyOs(path, QA_KNOWLEDGE_ROOT)
        activePathRef.current = path
        setActivePath(path)
        activeDocKeyRef.current = docKey
        setActiveDocKey(docKey)
        openNoteInWorkspace(path, docKey)
        syncKnowledgeRoute(docKey)
      },
      renderContent: () => {},
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
          delete: async (path) => {
            const rel = qaKnowledgeFixtureRelPath(path)
            delete fixturesRef.current[rel]
          },
          rename: async () => {},
        },
      })
      onKnowledgeOSWorkspaceOpened(QA_KNOWLEDGE_ROOT)

      registerKnowledgeInteractionHost({
        getRootDir: () => QA_KNOWLEDGE_ROOT,
        openAbsolutePath: (absolutePath) => {
          void openPathInTab(absolutePath, 'qa-knowledge-host')
        },
        clearEditorSelection: () => {},
        focusEditor: () => {},
        insertWikiLinkAtCursor: ({ docKey, title }) => {
          setEditorContent((prev) =>
            prev + (title && title !== docKey ? `[[${docKey}|${title}]]` : `[[${docKey}]]`),
          )
          return true
        },
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
        source: 'qa-knowledge-boot',
      })
      setStatus('ready')
    })()

    return () => {
      cancelled = true
      registerKnowledgeInteractionHost(null)
      registerDocumentRuntimeCapabilities(null)
      resetDocumentRuntimeKernel()
    }
  }, [openPathInTab, openSearch, readFixture, syncKnowledgeRoute, updateDocumentFrontmatter, persistFixture])

  const shellClass = useMemo(
    () => ['preview-pane', 'markdown-visual-editor', 'qa-knowledge-shell'].filter(Boolean).join(' '),
    [],
  )

  return (
    <div className="qa-knowledge-root layout workspace-split mod-root with-knowledge-rail" style={{ minHeight: '100vh' }}>
      <div className="qa-knowledge-diagnostics" style={{ padding: '12px 24px' }}>
        <h1 data-testid="qa-ready">Knowledge QA</h1>
        <p data-testid="qa-status">{status}</p>
        <p data-testid="qa-active-doc" style={{ color: 'var(--text-secondary)' }}>
          active={activeDocKey ?? 'none'}
        </p>
        <div data-testid="qa-knowledge-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {openedTabs.map((path) => {
            const fileName = path.split('/').pop() ?? path
            return (
              <button
                key={path}
                type="button"
                data-testid={`qa-knowledge-tab:${fileName}`}
                data-active={activePath && pathsEqual(path, activePath) ? 'true' : 'false'}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: activePath && pathsEqual(path, activePath) ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                {fileName}
              </button>
            )
          })}
        </div>
      </div>
      <main className="main main-with-rail workspace-leaf mod-active" style={{ display: 'flex', maxWidth: 980, minHeight: 520, margin: '0 24px 24px' }}>
        <div className="editor-body-surface view-content" style={{ flex: 1, minWidth: 0 }}>
          <div
            className={shellClass}
            data-testid="qa-editor-stub"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ width: '100%', maxWidth: 560, padding: 24 }}>
              <p style={{ marginTop: 0 }}>Knowledge rail QA — editor chrome uses production classes.</p>
              <textarea
                data-testid="qa-editor-content"
                readOnly
                value={editorContent}
                style={{ width: '100%', minHeight: 180, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>
        <div className="qa-knowledge-rail kos-right-rail" style={{ width: 360, minWidth: 280 }}>
          <KnowledgeRightRail
            activeDocKey={activeDocKey}
            visible={railVisible}
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            onSearchOpenChange={setSearchOpen}
            onSearchQueryChange={setSearchQuery}
            onClose={() => {
              setSearchOpen(false)
              setSearchQuery('')
              setRailVisible(false)
            }}
          />
        </div>
      </main>
    </div>
  )
}

export function QaKnowledgePlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaKnowledgeInner />
    </I18nProvider>
  )
}
