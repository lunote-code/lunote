import { useCallback, useEffect, useRef, useState } from 'react'

import '../App.css'
import { I18nProvider, type I18nBootstrap, useI18n } from '../i18n'
import {
  ensureLocaleRawLoaded,
  getEnMessagesSnapshot,
  isUiLocaleId,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import { Icon } from '../design-system/icons/Icon'
import {
  applyBootEarlyThemeFromLocalStorage,
  applyBootEarlyThemeMarkup,
  resolveBootEarlyThemeMarkup,
} from '../platform/bootEarlyTheme'
import { applyInitialThemeFromSettings } from '../theme-runtime/themeRuntime'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { EditorTabBar } from './components/EditorTabBar'
import {
  SidebarFileViewToggleButton,
  SidebarListModeSegmented,
} from './components/SidebarHeaderChrome'
import { SidebarSearchToggleButton } from './components/SidebarSearchChrome'
import { SidebarWorkspaceMenu } from './components/SidebarWorkspaceMenu'
import type { FileSortMode } from './workspace/types'

const QA_ROOT = '/qa-vault'
const OVERFLOW_TABS = Array.from(
  { length: 12 },
  (_, index) => `${QA_ROOT}/project-alpha/doc-${String(index + 1).padStart(2, '0')}-release-notes.md`,
)

function resolveQaLocale(): UiLocaleId {
  const raw = new URLSearchParams(window.location.search).get('locale')
  return raw && isUiLocaleId(raw) ? raw : 'en'
}

declare global {
  interface Window {
    __QA_CHROME_VISUAL__?: {
      getThemeMode: () => 'light' | 'dark'
      setTheme: (mode: 'light' | 'dark') => void
      openWorkspaceMenu: (open: boolean) => void
      getSidebarHeaderHeight: () => number
      getTabsScrollWidth: () => number
      getTabsClientWidth: () => number
    }
  }
}

function QaChromeVisualInner({ locale }: { locale: UiLocaleId }) {
  const { t } = useI18n()
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>('group')
  const [sidebarFileView, setSidebarFileView] = useState<'tree' | 'list'>('tree')
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)

  const setTheme = useCallback((mode: 'light' | 'dark') => {
    const variant = mode === 'light' ? 'github-light' : 'github-dark'
    applyBootEarlyThemeMarkup(resolveBootEarlyThemeMarkup(variant))
    applyInitialThemeFromSettings()
    setThemeMode(mode)
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: locale })
    applyBootEarlyThemeFromLocalStorage()
    applyInitialThemeFromSettings()
    setTheme('dark')
  }, [locale, setTheme])

  useEffect(() => {
    window.__QA_CHROME_VISUAL__ = {
      getThemeMode: () => themeMode,
      setTheme,
      openWorkspaceMenu: (open) => setWorkspaceMenuOpen(open),
      getSidebarHeaderHeight: () =>
        document.querySelector('[data-testid="qa-chrome-visual-sidebar"] .sidebar-header')?.getBoundingClientRect()
          .height ?? 0,
      getTabsScrollWidth: () =>
        document.querySelector('[data-testid="qa-chrome-visual-tabs"] .editor-tabs')?.scrollWidth ?? 0,
      getTabsClientWidth: () =>
        document.querySelector('[data-testid="qa-chrome-visual-tabs"] .editor-tabs')?.clientWidth ?? 0,
    }
    return () => {
      delete window.__QA_CHROME_VISUAL__
    }
  }, [setTheme, themeMode])

  const workspaceMenuPopStyle = workspaceMenuOpen
    ? ({
        position: 'fixed',
        left: 12,
        top: 48,
        visibility: 'visible',
      } as const)
    : null

  return (
    <div className="qa-chrome-visual-root">
      <div className="qa-chrome-visual-controls">
        <p data-testid="qa-ready">Chrome visual QA</p>
        <p data-testid="qa-locale">locale={locale}</p>
        <p data-testid="qa-theme-mode">{themeMode}</p>
        <button type="button" data-testid="set-theme-light" onClick={() => setTheme('light')}>
          Light theme
        </button>
        <button type="button" data-testid="set-theme-dark" onClick={() => setTheme('dark')}>
          Dark theme
        </button>
        <button type="button" data-testid="open-workspace-menu" onClick={() => setWorkspaceMenuOpen(true)}>
          Open workspace menu
        </button>
        <button type="button" data-testid="close-workspace-menu" onClick={() => setWorkspaceMenuOpen(false)}>
          Close workspace menu
        </button>
      </div>

      <div
        data-testid="qa-chrome-visual-frame"
        className="qa-chrome-visual-frame layout workspace-split mod-root"
        style={{ width: 880, minHeight: 120, border: '1px solid var(--border-subtle)' }}
      >
        <aside
          data-testid="qa-chrome-visual-sidebar"
          className="sidebar workspace-split mod-left-split qa-sidebar-chrome-shell"
          data-workspace-sidebar
          style={{ width: 240, minWidth: 240, maxWidth: 240 }}
        >
          <div className="sidebar-pane-top">
            <div className="sidebar-header">
              <div className="sidebar-header-primary">
                <SidebarListModeSegmented
                  t={t}
                  mode="files"
                  onSelectFiles={() => undefined}
                  onSelectOutline={() => undefined}
                />
                <SidebarFileViewToggleButton
                  t={t}
                  sidebarFileView={sidebarFileView}
                  disabled={false}
                  onToggle={() => setSidebarFileView((view) => (view === 'tree' ? 'list' : 'tree'))}
                />
              </div>
              <div className="sidebar-header-actions">
                <SidebarSearchToggleButton
                  t={t}
                  rootDir={QA_ROOT}
                  open={false}
                  isFiltering={false}
                  onToggle={() => undefined}
                />
                <SidebarWorkspaceMenu
                  t={t}
                  rootDir={QA_ROOT}
                  workspaceFolderName="qa-vault"
                  workspaceMenuRef={workspaceMenuRef}
                  workspaceMenuPopRef={workspaceMenuPopRef}
                  workspaceMenuOpen={workspaceMenuOpen}
                  setWorkspaceMenuOpen={setWorkspaceMenuOpen}
                  workspaceMenuPopStyle={workspaceMenuPopStyle}
                  fileSortMode={fileSortMode}
                  setFileSortMode={setFileSortMode}
                  createNewNote={async () => undefined}
                  createNewNoteFromTemplate={async () => undefined}
                  chooseFolder={async () => undefined}
                  refreshFileTree={async () => undefined}
                  setStatus={() => undefined}
                />
              </div>
            </div>
          </div>
        </aside>

        <main
          data-testid="qa-chrome-visual-main"
          className="main main-with-rail workspace-leaf mod-active"
          style={{ minWidth: 0, flex: 1 }}
        >
          <div data-testid="qa-chrome-visual-tabs" style={{ minWidth: 0 }}>
            <EditorTabBar
              t={t}
              openedTabs={OVERFLOW_TABS}
              activePath={OVERFLOW_TABS[3] ?? ''}
              externalDiskChangedPaths={new Set([OVERFLOW_TABS[1] ?? ''])}
              tabLabel={(path) => path.split('/').pop() ?? path}
              onActivate={() => undefined}
              onClose={() => undefined}
              onReorder={() => undefined}
              onContextMenu={() => undefined}
              trailingActions={
                <>
                  <button
                    type="button"
                    className="luna-chrome-icon-btn editor-chrome-action-btn"
                    data-testid="editor-focus-toggle"
                    aria-label="Focus mode"
                  >
                    <Icon name="focus" size="sm" stroke="strong" />
                  </button>
                  <button
                    type="button"
                    className="luna-chrome-icon-btn editor-chrome-action-btn"
                    data-testid="editor-knowledge-toggle"
                    aria-label="Knowledge panel"
                  >
                    <Icon name="graph" size="sm" stroke="strong" />
                  </button>
                </>
              }
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export function QaChromeVisualPlayground() {
  const locale = resolveQaLocale()
  const [bootstrap, setBootstrap] = useState<I18nBootstrap | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const enMessages = getEnMessagesSnapshot()
      const rawLocale = locale === 'en' ? enMessages : await ensureLocaleRawLoaded(locale)
      if (cancelled) return
      setBootstrap({
        mergedMessages: locale === 'en' ? enMessages : { ...enMessages, ...rawLocale },
        enMessages,
        rawLocale,
        languageSetting: locale,
        effectiveLocale: locale,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [locale])

  if (!bootstrap) {
    return (
      <div className="qa-chrome-visual-root">
        <p data-testid="qa-ready">Chrome visual QA</p>
        <p data-testid="qa-locale">locale={locale}</p>
      </div>
    )
  }

  return (
    <I18nProvider bootstrap={bootstrap}>
      <QaChromeVisualInner locale={locale} />
    </I18nProvider>
  )
}
