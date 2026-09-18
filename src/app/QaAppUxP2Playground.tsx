import { useCallback, useEffect, useRef, useState } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import { getEnMessagesSnapshot } from '../i18n/localeRegistry'
import { executeManifestCommand } from '../menu'
import { buildNullEditorContext } from '../menu/commandContext'
import type { AppMenuUiDeps } from '../menu/menu.types'
import { createRegistryShortcutHandler } from '../menu/shortcutRuntime'
import { openShortcutsCheatsheetDialog } from '../components/shortcutsCheatsheetStore'
import { ShortcutsCheatsheetDialogHost } from '../components/ShortcutsCheatsheetDialog'
import { EditorTabBar } from './components/EditorTabBar'
import { TabSwitcherModal } from './components/TabSwitcherModal'
import { touchTabMru } from './document/tabMru'

const QA_BOOTSTRAP = {
  mergedMessages: getEnMessagesSnapshot(),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getEnMessagesSnapshot(),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const QA_TABS = ['/qa-vault/welcome.md', '/qa-vault/notes.md', '/qa-vault/third.md'] as const

declare global {
  interface Window {
    __QA_APP_UX_P2__?: {
      runManifestCommand: (commandId: string) => Promise<void>
      touchTab: (path: string) => void
    }
  }
}

function QaAppUxP2Inner() {
  const { t } = useI18n()
  const [openedTabs] = useState<string[]>([...QA_TABS])
  const [activePath, setActivePath] = useState<string>(QA_TABS[0])
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false)
  const [tabSwitcherQuery, setTabSwitcherQuery] = useState('')
  const tabMruRef = useRef<string[]>([QA_TABS[0]])
  const tabSwitcherInputRef = useRef<HTMLInputElement | null>(null)
  const tabSwitcherOpenRef = useRef(tabSwitcherOpen)
  const appMenuCtxRef = useRef({
    rootDir: '/qa-vault',
    setStatus: () => undefined,
    t,
    getEditorContext: () => buildNullEditorContext('visual'),
  })
  const paletteUiDepsRef = useRef<AppMenuUiDeps | null>(null)
  tabSwitcherOpenRef.current = tabSwitcherOpen

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const openTabSwitcherModal = useCallback(() => {
    setTabSwitcherQuery('')
    setTabSwitcherOpen(true)
  }, [])

  useEffect(() => {
    appMenuCtxRef.current = {
      rootDir: '/qa-vault',
      setStatus: () => undefined,
      t,
      getEditorContext: () => buildNullEditorContext('visual'),
    }
    paletteUiDepsRef.current = {
      openTabSwitcherModal,
      openShortcutsCheatsheet: () => openShortcutsCheatsheetDialog(),
    } as AppMenuUiDeps
  }, [openTabSwitcherModal, t])

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
      isBlocked: () => tabSwitcherOpenRef.current,
    })
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    window.__QA_APP_UX_P2__ = {
      runManifestCommand: async (commandId) => {
        await executeManifestCommand(commandId, appMenuCtxRef.current as never, paletteUiDepsRef.current as never)
      },
      touchTab: (path) => {
        setActivePath(path)
        tabMruRef.current = touchTabMru(tabMruRef.current, path)
      },
    }
    return () => {
      delete window.__QA_APP_UX_P2__
    }
  }, [])

  return (
    <div className="layout workspace-split mod-root qa-app-ux-p2-frame" data-testid="qa-app-ux-p2-root">
      <EditorTabBar
        t={t}
        openedTabs={openedTabs}
        activePath={activePath}
        externalDiskChangedPaths={new Set()}
        tabLabel={tabLabel}
        onActivate={(path) => {
          setActivePath(path)
          tabMruRef.current = touchTabMru(tabMruRef.current, path)
        }}
        onClose={() => {}}
        onReorder={() => {}}
        onContextMenu={() => {}}
        onOpenGlobalSearch={openTabSwitcherModal}
      />
      <TabSwitcherModal
        open={tabSwitcherOpen}
        query={tabSwitcherQuery}
        openedTabs={openedTabs}
        mruPaths={tabMruRef.current}
        tabLabel={tabLabel}
        onQueryChange={setTabSwitcherQuery}
        onClose={() => setTabSwitcherOpen(false)}
        onActivateTab={(path) => {
          setActivePath(path)
          tabMruRef.current = touchTabMru(tabMruRef.current, path)
          setTabSwitcherOpen(false)
        }}
        inputRef={tabSwitcherInputRef}
        t={t}
      />
      <ShortcutsCheatsheetDialogHost t={t} />
    </div>
  )
}

export function QaAppUxP2Playground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaAppUxP2Inner />
    </I18nProvider>
  )
}
