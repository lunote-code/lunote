import { useCallback, useEffect, useRef, useState } from 'react'

import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import {
  applyBootEarlyThemeMarkup,
  resolveBootEarlyThemeMarkup,
} from '../platform/bootEarlyTheme'
import { applyInitialThemeFromSettings } from '../theme-runtime/themeRuntime'
import { SidebarWorkspaceMenu } from './components/SidebarWorkspaceMenu'
import { TabContextMenu } from './components/TabContextMenu'
import { WorkspaceFileContextMenu } from './components/WorkspaceFileContextMenu'

const QA_ROOT = '/qa-vault'

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

function QaContextMenuInner() {
  const { t } = useI18n()
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)
  const fileMenuRef = useRef<HTMLDivElement | null>(null)
  const tabMenuRef = useRef<HTMLDivElement | null>(null)
  const [lastPick, setLastPick] = useState('ready')

  const setTheme = useCallback((mode: 'light' | 'dark') => {
    const variant = mode === 'light' ? 'github-light' : 'github-dark'
    applyBootEarlyThemeMarkup(resolveBootEarlyThemeMarkup(variant))
    applyInitialThemeFromSettings()
  }, [])

  useEffect(() => {
    setTheme('dark')
  }, [setTheme])

  return (
    <div className="qa-context-menu-root" style={{ padding: 24, minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Context menu QA</h1>
      <p data-testid="qa-status">{lastPick}</p>

      <section data-testid="qa-workspace-menu-section" style={{ position: 'relative', width: 280, marginBottom: 24 }}>
        <SidebarWorkspaceMenu
          t={t}
          rootDir={QA_ROOT}
          workspaceFolderName="qa-vault"
          workspaceMenuRef={workspaceMenuRef}
          workspaceMenuPopRef={workspaceMenuPopRef}
          workspaceMenuOpen
          setWorkspaceMenuOpen={() => undefined}
          workspaceMenuPopStyle={{ position: 'static', visibility: 'visible', pointerEvents: 'auto' }}
          fileSortMode="group"
          setFileSortMode={() => undefined}
          createNewNote={() => setLastPick('workspace:newFile')}
          createNewNoteFromTemplate={() => setLastPick('workspace:newFromTemplate')}
          chooseFolder={() => setLastPick('workspace:openFolder')}
          refreshFileTree={() => setLastPick('workspace:refresh')}
          setStatus={(msg) => setLastPick(msg)}
        />
      </section>

      <section data-testid="qa-file-menu-section" style={{ position: 'relative', height: 420, marginBottom: 24 }}>
        <WorkspaceFileContextMenu
          menuRef={fileMenuRef}
          state={{
            x: 24,
            y: 120,
            path: `${QA_ROOT}/notes/hello.md`,
            isDirectory: false,
            variant: 'item',
          }}
          onPick={(action) => setLastPick(`file:${action}`)}
        />
      </section>

      <section data-testid="qa-tab-menu-section" style={{ position: 'relative', height: 220 }}>
        <TabContextMenu
          menuRef={tabMenuRef}
          state={{
            x: 24,
            y: 520,
            path: `${QA_ROOT}/doc-a.md`,
            index: 1,
            total: 3,
          }}
          onPick={(action) => setLastPick(`tab:${action}`)}
        />
      </section>
    </div>
  )
}

export function QaContextMenuPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaContextMenuInner />
    </I18nProvider>
  )
}
