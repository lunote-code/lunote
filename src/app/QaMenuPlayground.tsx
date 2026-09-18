import { useCallback, useEffect, useRef, useState } from 'react'

import { AppMenuBar } from './AppMenuBar'
import './appMenuBar.css'
import { I18nProvider, type I18nBootstrap } from '../i18n'
import {
  ensureLocaleRawLoaded,
  getEnMessagesSnapshot,
  isUiLocaleId,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import { APP_MENU_SCHEMA, isLeaf, isSeparator, isSubmenu } from '../menu'
import type { MenuNode } from '../menu'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'

const QA_RECENT_WORKSPACES = ['/qa-vault', '/qa-vault/archive'] as const
const QA_RECENT_FILES = ['/qa-vault/note-a.md', '/qa-vault/note-b.md'] as const

function resolveQaLocale(): UiLocaleId {
  const raw = new URLSearchParams(window.location.search).get('locale')
  return raw && isUiLocaleId(raw) ? raw : 'en'
}

async function buildMenuBootstrap(locale: UiLocaleId): Promise<I18nBootstrap> {
  const enMessages = getEnMessagesSnapshot()
  const rawLocale = locale === 'en' ? enMessages : await ensureLocaleRawLoaded(locale)
  return {
    mergedMessages: locale === 'en' ? enMessages : { ...enMessages, ...rawLocale },
    enMessages,
    rawLocale,
    languageSetting: locale,
    effectiveLocale: locale,
  }
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
      getEffectiveLocale: () => string
      getSchemaSummary: () => {
        groupCount: number
        groupLabels: string[]
        totalLeaves: number
      }
      getOpenGroupLabel: () => string | null
    }
  }
}

function QaMenuInner({ locale }: { locale: UiLocaleId }) {
  const [status, setStatus] = useState('ready')
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(null)
  const lastActionRef = useRef<string | null>(null)
  const lastRecentPathRef = useRef<string | null>(null)

  const onRunAction = useCallback((commandId: string) => {
    lastActionRef.current = commandId
    setStatus(`action:${commandId}`)
  }, [])

  const onOpenRecentWorkspace = useCallback((path: string) => {
    lastRecentPathRef.current = path
    setStatus(`recent-ws:${path}`)
  }, [])

  const onOpenRecent = useCallback((path: string) => {
    lastRecentPathRef.current = path
    setStatus(`recent:${path}`)
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: locale })
  }, [locale])

  useEffect(() => {
    window.__QA_MENU__ = {
      getLastAction: () => lastActionRef.current,
      getLastRecentPath: () => lastRecentPathRef.current,
      getEffectiveLocale: () => locale,
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
  }, [locale, openGroupLabel])

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
      <p data-testid="qa-effective-locale">{locale}</p>
      <AppMenuBar
        recentWorkspaces={[...QA_RECENT_WORKSPACES]}
        recentFiles={[...QA_RECENT_FILES]}
        onRunAction={onRunAction}
        onOpenRecent={onOpenRecent}
        onOpenRecentWorkspace={onOpenRecentWorkspace}
      />
    </div>
  )
}

export function QaMenuPlayground() {
  const [phase, setPhase] = useState<'booting' | 'ready' | 'error'>('booting')
  const [bootstrap, setBootstrap] = useState<I18nBootstrap | null>(null)
  const [locale, setLocale] = useState<UiLocaleId>('en')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const targetLocale = resolveQaLocale()
    setLocale(targetLocale)
    let cancelled = false
    void (async () => {
      try {
        const next = await buildMenuBootstrap(targetLocale)
        if (cancelled) return
        setBootstrap(next)
        setPhase('ready')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'booting') {
    return (
      <div style={{ padding: 24 }}>
        <h1 data-testid="qa-ready">Menu QA</h1>
        <p data-testid="qa-status">booting</p>
      </div>
    )
  }

  if (phase === 'error' || !bootstrap) {
    return (
      <div style={{ padding: 24 }}>
        <h1 data-testid="qa-ready">Menu QA</h1>
        <p data-testid="qa-status">error</p>
        <p data-testid="qa-error">{error ?? 'unknown'}</p>
      </div>
    )
  }

  return (
    <I18nProvider bootstrap={bootstrap}>
      <QaMenuInner locale={locale} />
    </I18nProvider>
  )
}
