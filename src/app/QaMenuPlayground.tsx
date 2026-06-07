import { useCallback, useEffect, useRef, useState } from 'react'

import { AppMenuBar } from './AppMenuBar'
import './appMenuBar.css'
import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import { APP_MENU_SCHEMA, isLeaf, isSeparator, isSubmenu } from '../menu'
import type { MenuNode } from '../menu'

const QA_RECENT_FILES = ['/qa-vault/note-a.md', '/qa-vault/note-b.md'] as const

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

function countMenuLeaves(nodes: readonly MenuNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (isSeparator(node)) continue
    if (isSubmenu(node)) {
      count += countMenuLeaves(node.children)
      continue
    }
    if (isLeaf(node)) count += 1
  }
  return count
}

declare global {
  interface Window {
    __QA_MENU__?: {
      getLastAction: () => string | null
      getLastRecentPath: () => string | null
      getSchemaSummary: () => {
        groupCount: number
        groupLabels: string[]
        totalLeaves: number
      }
      getOpenGroupLabel: () => string | null
    }
  }
}

function QaMenuInner() {
  const [status, setStatus] = useState('ready')
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(null)
  const lastActionRef = useRef<string | null>(null)
  const lastRecentPathRef = useRef<string | null>(null)

  const onRunAction = useCallback((commandId: string) => {
    lastActionRef.current = commandId
    setStatus(`action:${commandId}`)
  }, [])

  const onOpenRecent = useCallback((path: string) => {
    lastRecentPathRef.current = path
    setStatus(`recent:${path}`)
  }, [])

  useEffect(() => {
    window.__QA_MENU__ = {
      getLastAction: () => lastActionRef.current,
      getLastRecentPath: () => lastRecentPathRef.current,
      getSchemaSummary: () => ({
        groupCount: APP_MENU_SCHEMA.bar.length,
        groupLabels: APP_MENU_SCHEMA.bar.map((group) => group.labelKey),
        totalLeaves: APP_MENU_SCHEMA.bar.reduce((sum, group) => sum + countMenuLeaves(group.children), 0),
      }),
      getOpenGroupLabel: () => openGroupLabel,
    }
    return () => {
      delete window.__QA_MENU__
    }
  }, [openGroupLabel])

  useEffect(() => {
    const syncOpenGroup = () => {
      const openTrigger = document.querySelector('.app-menubar-group.is-open .app-menubar-trigger')
      setOpenGroupLabel(openTrigger?.textContent?.trim() ?? null)
    }
    syncOpenGroup()
    const observer = new MutationObserver(syncOpenGroup)
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="qa-menu-shell" style={{ padding: 24, minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Menu QA</h1>
      <p data-testid="qa-status">{status}</p>
      <AppMenuBar
        recentFiles={[...QA_RECENT_FILES]}
        onRunAction={onRunAction}
        onOpenRecent={onOpenRecent}
      />
    </div>
  )
}

export function QaMenuPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaMenuInner />
    </I18nProvider>
  )
}
