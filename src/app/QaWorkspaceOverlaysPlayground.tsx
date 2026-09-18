import { useCallback, useEffect, useRef, useState } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { pathsEqual } from '../lib/workspacePathUtils'
import { createRegistryShortcutHandler } from '../menu/shortcutRuntime'
import { executeManifestCommand } from '../menu'
import { buildNullEditorContext } from '../menu/commandContext'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { EditorTabBar } from './components/EditorTabBar'
import { WorkspaceGlobalSearchModal } from './components/WorkspaceGlobalSearchModal'
import { WorkspaceQuickSwitcherModal } from './components/WorkspaceQuickSwitcherModal'
import type { WorkspaceSearchIndexEntry } from './search/workspaceSearch'
import {
  QA_MULTI_TAB_DOC_A,
  QA_MULTI_TAB_DOC_B,
  QA_MULTI_TAB_MARKERS,
  QA_MULTI_TAB_ROOT,
} from './qaMultiTabFixtures'

const QA_DOC_C = `${QA_MULTI_TAB_ROOT}/notes/doc-c.md`
const QA_DOC_PROMO = `${QA_MULTI_TAB_ROOT}/notes/promo-sites.md`

const QA_SEARCH_INDEX: WorkspaceSearchIndexEntry[] = [
  {
    path: QA_MULTI_TAB_DOC_A,
    title: 'Doc A',
    sublabel: QA_MULTI_TAB_MARKERS[QA_MULTI_TAB_DOC_A],
    relativePath: 'doc-a.md',
  },
  {
    path: QA_MULTI_TAB_DOC_B,
    title: 'Doc B',
    sublabel: QA_MULTI_TAB_MARKERS[QA_MULTI_TAB_DOC_B],
    relativePath: 'doc-b.md',
  },
  {
    path: QA_DOC_C,
    title: 'Doc C',
    sublabel: 'MARKER-C-ORIGINAL',
    relativePath: 'notes/doc-c.md',
  },
  {
    path: QA_DOC_PROMO,
    title: 'promo-sites.md',
    displayTitle: '推广网站',
    matchText: '推广网站',
    sublabel: 'notes',
    relativePath: 'notes/promo-sites.md',
  },
]

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_WORKSPACE_OVERLAYS__?: {
      getActivePath: () => string
      getOpenedTabPaths: () => string[]
      isGlobalSearchOpen: () => boolean
      isQuickSwitcherOpen: () => boolean
      getLastGlobalSearchOpenRequest: () => { path: string; searchQuery: string; searchSnippetHtml?: string } | null
    }
  }
}

function QaWorkspaceOverlaysInner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('ready')
  const [openedTabs, setOpenedTabs] = useState<string[]>([QA_MULTI_TAB_DOC_A])
  const [activePath, setActivePath] = useState(QA_MULTI_TAB_DOC_A)
  const [recentFiles, setRecentFiles] = useState<string[]>([QA_MULTI_TAB_DOC_A, QA_MULTI_TAB_DOC_B])
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [quickSwitcherQuery, setQuickSwitcherQuery] = useState('')

  const activePathRef = useRef(activePath)
  const openedTabsRef = useRef(openedTabs)
  const globalSearchOpenRef = useRef(globalSearchOpen)
  const quickSwitcherOpenRef = useRef(quickSwitcherOpen)
  const lastGlobalSearchOpenRequestRef = useRef<{
    path: string
    searchQuery: string
    searchSnippetHtml?: string
  } | null>(null)
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null)
  const quickSwitcherInputRef = useRef<HTMLInputElement | null>(null)
  const appMenuCtxRef = useRef({
    rootDir: QA_MULTI_TAB_ROOT,
    setStatus,
    t,
    getEditorContext: () => buildNullEditorContext('visual'),
  })
  const paletteUiDepsRef = useRef({
    openGlobalSearchModal: () => {},
    openQuickSwitcherModal: () => {},
  })

  activePathRef.current = activePath
  openedTabsRef.current = openedTabs
  globalSearchOpenRef.current = globalSearchOpen
  quickSwitcherOpenRef.current = quickSwitcherOpen

  const openGlobalSearchModal = useCallback(() => {
    setQuickSwitcherOpen(false)
    setGlobalSearchQuery('')
    setGlobalSearchOpen(true)
  }, [])

  const openQuickSwitcherModal = useCallback(() => {
    setGlobalSearchOpen(false)
    setQuickSwitcherQuery('')
    setQuickSwitcherOpen(true)
  }, [])

  useEffect(() => {
    paletteUiDepsRef.current = {
      openGlobalSearchModal,
      openQuickSwitcherModal,
    }
  }, [openGlobalSearchModal, openQuickSwitcherModal])

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const dispatchOpenDocumentInTab = useCallback(
    async (root: string, path: string, options?: { searchQuery?: string; searchSnippetHtml?: string }) => {
      if (root !== QA_MULTI_TAB_ROOT) return
      lastGlobalSearchOpenRequestRef.current =
        options?.searchQuery?.trim()
          ? {
              path,
              searchQuery: options.searchQuery.trim(),
              searchSnippetHtml: options.searchSnippetHtml,
            }
          : null
      setOpenedTabs((tabs) => (tabs.some((item) => pathsEqual(item, path)) ? tabs : [...tabs, path]))
      setActivePath(path)
      setRecentFiles((prev) => [path, ...prev.filter((item) => !pathsEqual(item, path))].slice(0, 8))
      setStatus(`opened:${tabLabel(path)}`)
    },
    [tabLabel],
  )

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    appMenuCtxRef.current = {
      rootDir: QA_MULTI_TAB_ROOT,
      setStatus,
      t,
      getEditorContext: () => buildNullEditorContext('visual'),
    }
  }, [setStatus, t])

  useEffect(() => {
    const handler = createRegistryShortcutHandler({
      executeManifestCommand: (commandId) =>
        executeManifestCommand(commandId, appMenuCtxRef.current as never, paletteUiDepsRef.current as never),
      dispatchMenuAction: () => undefined,
      onSave: () => undefined,
      onCloseWindow: () => undefined,
      onPreferences: () => undefined,
      onFocusMode: () => undefined,
      onModeToggle: () => undefined,
      isBlocked: () => globalSearchOpenRef.current || quickSwitcherOpenRef.current,
    })
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    window.__QA_WORKSPACE_OVERLAYS__ = {
      getActivePath: () => activePathRef.current,
      getOpenedTabPaths: () => [...openedTabsRef.current],
      isGlobalSearchOpen: () => globalSearchOpenRef.current,
      isQuickSwitcherOpen: () => quickSwitcherOpenRef.current,
      getLastGlobalSearchOpenRequest: () => lastGlobalSearchOpenRequestRef.current,
    }
    return () => {
      delete window.__QA_WORKSPACE_OVERLAYS__
    }
  }, [])

  return (
    <div className="qa-workspace-overlays-shell app-shell" data-testid="qa-workspace-overlays-shell">
      <header className="qa-workspace-overlays-header">
        <h1 data-testid="qa-ready">Workspace overlays QA</h1>
        <p data-testid="qa-status">{status}</p>
        <div className="qa-workspace-overlays-actions">
          <button type="button" data-testid="qa-open-global-search" onClick={openGlobalSearchModal}>
            Open global search
          </button>
          <button type="button" data-testid="qa-open-quick-switcher" onClick={openQuickSwitcherModal}>
            Open quick switcher
          </button>
        </div>
      </header>
      <EditorTabBar
        t={t}
        openedTabs={openedTabs}
        activePath={activePath}
        externalDiskChangedPaths={new Set()}
        tabLabel={tabLabel}
        onActivate={setActivePath}
        onClose={(path) => {
          setOpenedTabs((tabs) => tabs.filter((item) => !pathsEqual(item, path)))
          setActivePath((current) => (pathsEqual(current, path) ? openedTabsRef.current[0] ?? '' : current))
        }}
        onReorder={() => undefined}
        onContextMenu={() => undefined}
        onOpenGlobalSearch={openGlobalSearchModal}
      />
      <WorkspaceGlobalSearchModal
        open={globalSearchOpen}
        query={globalSearchQuery}
        rootDir={QA_MULTI_TAB_ROOT}
        searchIndex={QA_SEARCH_INDEX}
        onQueryChange={setGlobalSearchQuery}
        onClose={() => setGlobalSearchOpen(false)}
        inputRef={globalSearchInputRef}
        onOpenDocument={dispatchOpenDocumentInTab}
        t={t}
      />
      <WorkspaceQuickSwitcherModal
        open={quickSwitcherOpen}
        query={quickSwitcherQuery}
        rootDir={QA_MULTI_TAB_ROOT}
        searchIndex={QA_SEARCH_INDEX}
        recentPaths={recentFiles}
        onQueryChange={setQuickSwitcherQuery}
        onClose={() => setQuickSwitcherOpen(false)}
        inputRef={quickSwitcherInputRef}
        onOpenDocument={dispatchOpenDocumentInTab}
        t={t}
      />
    </div>
  )
}

export function QaWorkspaceOverlaysPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaWorkspaceOverlaysInner />
    </I18nProvider>
  )
}

export default QaWorkspaceOverlaysPlayground
