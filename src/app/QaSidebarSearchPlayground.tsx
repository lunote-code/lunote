import { useCallback, useEffect, useRef, useState } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { createRegistryShortcutHandler } from '../menu/shortcutRuntime'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { SidebarHeaderToolbar } from './components/SidebarHeaderChrome'
import { SidebarHeaderSearchBar, SidebarSearchToggleButton } from './components/SidebarSearchChrome'
import { SidebarWorkspaceMenu } from './components/SidebarWorkspaceMenu'
import { SidebarRecentFiles } from './components/SidebarRecentFiles'
import type { FileSortMode } from './workspace/types'
import type { SidebarListMode, SidebarPanelView } from './workspace/sidebarPanelView'
import {
  sidebarFileViewFromPanelView,
  sidebarListModeFromPanelView,
} from './workspace/sidebarPanelView'

const QA_ROOT = '/qa-vault'
const QA_RECENT_FILES = [`${QA_ROOT}/notes.md`, `${QA_ROOT}/welcome.md`] as const

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_SIDEBAR_CHROME__?: {
      getPanelView: () => SidebarPanelView
      setPanelView: (view: SidebarPanelView) => void
      getListMode: () => SidebarListMode
      setListMode: (mode: SidebarListMode) => void
      isSearchOpen: () => boolean
      isSidebarVisible: () => boolean
      isWorkspaceMenuOpen: () => boolean
      getSearchText: () => string
      setSearchText: (value: string) => void
      setWorkspaceReady: (ready: boolean) => void
      getFileView: () => 'tree' | 'list'
    }
  }
}

function QaSidebarChromeInner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('ready')
  const [searchText, setSearchText] = useState('')
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false)
  const [sidebarPanelView, setSidebarPanelView] = useState<SidebarPanelView>('files-tree')
  const sidebarListMode = sidebarListModeFromPanelView(sidebarPanelView)
  const sidebarFileView = sidebarFileViewFromPanelView(sidebarPanelView)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [rootDir, setRootDir] = useState(QA_ROOT)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>('group')
  const [lastOpenedRecent, setLastOpenedRecent] = useState('')
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)
  const lastFilesPanelViewRef = useRef<'files-list' | 'files-tree'>('files-tree')

  const searchTextRef = useRef(searchText)
  const openRef = useRef(sidebarSearchOpen)
  const panelViewRef = useRef(sidebarPanelView)
  const visibleRef = useRef(sidebarVisible)
  const rootDirRef = useRef(rootDir)
  const workspaceMenuOpenRef = useRef(workspaceMenuOpen)
  searchTextRef.current = searchText
  openRef.current = sidebarSearchOpen
  panelViewRef.current = sidebarPanelView
  visibleRef.current = sidebarVisible
  rootDirRef.current = rootDir
  workspaceMenuOpenRef.current = workspaceMenuOpen

  const isFiltering = Boolean(searchText.trim())
  const workspaceFolderName = rootDir ? 'qa-vault' : t('app.titleBar.noFolder')

  useEffect(() => {
    if (sidebarPanelView === 'files-list' || sidebarPanelView === 'files-tree') {
      lastFilesPanelViewRef.current = sidebarPanelView
    }
  }, [sidebarPanelView])

  useEffect(() => {
    if (searchText.trim()) setSidebarSearchOpen(true)
  }, [searchText])

  const closeSidebarSearch = useCallback(() => {
    setSearchText('')
    setSidebarSearchOpen(false)
  }, [])

  const toggleSidebarSearch = useCallback(() => {
    if (!rootDirRef.current.trim()) return
    if (openRef.current) {
      closeSidebarSearch()
      return
    }
    setSidebarSearchOpen(true)
  }, [closeSidebarSearch])

  const workspaceMenuPopStyle = workspaceMenuOpen
    ? ({
        position: 'fixed',
        left: 180,
        top: 48,
        visibility: 'visible',
      } as const)
    : null

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    const handler = createRegistryShortcutHandler({
      executeManifestCommand: (commandId) => {
        if (commandId === 'toggle-sidebar') {
          setSidebarVisible((visible) => !visible)
          setStatus('toggle-sidebar')
        }
      },
      dispatchMenuAction: () => undefined,
      onSave: () => undefined,
      onCloseWindow: () => undefined,
      onPreferences: () => undefined,
      onFocusMode: () => undefined,
      onModeToggle: () => undefined,
    })
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    window.__QA_SIDEBAR_CHROME__ = {
      getPanelView: () => panelViewRef.current,
      setPanelView: (view) => setSidebarPanelView(view),
      getListMode: () => sidebarListModeFromPanelView(panelViewRef.current),
      setListMode: (mode) => {
        if (mode === 'outline') {
          setSidebarPanelView('outline')
          return
        }
        setSidebarPanelView(lastFilesPanelViewRef.current)
      },
      isSearchOpen: () => openRef.current,
      isSidebarVisible: () => visibleRef.current,
      isWorkspaceMenuOpen: () => workspaceMenuOpenRef.current,
      getFileView: () => sidebarFileViewFromPanelView(panelViewRef.current),
      getSearchText: () => searchTextRef.current,
      setSearchText: (value) => setSearchText(value),
      setWorkspaceReady: (ready) => setRootDir(ready ? QA_ROOT : ''),
    }
    return () => {
      delete window.__QA_SIDEBAR_CHROME__
    }
  }, [])

  return (
    <div className="qa-sidebar-chrome-root">
      {sidebarVisible ? (
        <aside className="sidebar workspace-split mod-left-split qa-sidebar-chrome-shell" data-workspace-sidebar>
          <div className="sidebar-pane-top">
            <div className={`sidebar-header${sidebarSearchOpen ? ' sidebar-header--search' : ''}`}>
              {sidebarSearchOpen ? (
                <SidebarHeaderSearchBar
                  t={t}
                  rootDir={rootDir}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  onRequestClose={() => setSidebarSearchOpen(false)}
                />
              ) : (
                <SidebarHeaderToolbar
                  t={t}
                  view={sidebarPanelView}
                  filesDisabled={!rootDir}
                  onSelectView={setSidebarPanelView}
                  showSearchToggle
                  searchToggle={
                    <SidebarSearchToggleButton
                      t={t}
                      rootDir={rootDir}
                      open={sidebarSearchOpen}
                      isFiltering={isFiltering}
                      onToggle={toggleSidebarSearch}
                    />
                  }
                  workspaceMenu={
                    <SidebarWorkspaceMenu
                      t={t}
                      rootDir={rootDir}
                      workspaceFolderName={workspaceFolderName}
                      workspaceMenuRef={workspaceMenuRef}
                      workspaceMenuPopRef={workspaceMenuPopRef}
                      workspaceMenuOpen={workspaceMenuOpen}
                      setWorkspaceMenuOpen={setWorkspaceMenuOpen}
                      workspaceMenuPopStyle={workspaceMenuPopStyle}
                      fileSortMode={fileSortMode}
                      setFileSortMode={setFileSortMode}
                      createNewNote={async () => setStatus('new-note')}
                      createNewNoteFromTemplate={async () => setStatus('new-template')}
                      createNewFolder={async () => setStatus('new-folder')}
                      chooseFolder={async () => setStatus('choose-folder')}
                      refreshFileTree={async () => setStatus('refresh')}
                      setStatus={setStatus}
                    />
                  }
                />
              )}
            </div>
          </div>
          {rootDir ? (
            <SidebarRecentFiles
              t={t}
              collapsible
              recentWorkspaces={[]}
              recentFiles={[...QA_RECENT_FILES]}
              onOpenRecentWorkspace={() => undefined}
              onOpenRecent={(path) => {
                setLastOpenedRecent(path)
                setStatus(`open-recent:${path}`)
              }}
              onClearRecent={async () => setStatus('clear-recent')}
            />
          ) : null}
        </aside>
      ) : null}
      <div className="qa-sidebar-chrome-diagnostics">
      <p data-testid="qa-ready">Sidebar search QA</p>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-panel-view">{sidebarPanelView}</p>
      <p data-testid="qa-list-mode">{sidebarListMode}</p>
      <p data-testid="qa-search-open">{sidebarSearchOpen ? 'open' : 'closed'}</p>
      <p data-testid="qa-search-text">{searchText}</p>
      <p data-testid="qa-sidebar-visible">{sidebarVisible ? 'yes' : 'no'}</p>
      <p data-testid="qa-workspace-ready">{rootDir ? 'yes' : 'no'}</p>
      <p data-testid="qa-file-view">{sidebarFileView}</p>
      <p data-testid="qa-workspace-menu-open">{workspaceMenuOpen ? 'open' : 'closed'}</p>
      <p data-testid="qa-last-opened-recent">{lastOpenedRecent || 'none'}</p>
      <button type="button" data-testid="qa-show-sidebar" onClick={() => setSidebarVisible(true)}>
        Show sidebar
      </button>
      <button type="button" data-testid="qa-hide-sidebar" onClick={() => setSidebarVisible(false)}>
        Hide sidebar
      </button>
      <button
        type="button"
        data-testid="qa-set-no-workspace"
        onClick={() => {
          setRootDir('')
          setWorkspaceMenuOpen(false)
          setStatus('no-workspace')
        }}
      >
        Clear workspace
      </button>
      </div>
    </div>
  )
}

export function QaSidebarSearchPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaSidebarChromeInner />
    </I18nProvider>
  )
}
