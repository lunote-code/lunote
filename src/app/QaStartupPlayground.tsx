import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { bootstrapI18n, I18nProvider, type I18nBootstrap } from '../i18n'
import { getWorkspaceRestorePlan } from '../editor/knowledgeOS/ui/knowledgeAppIntegration'
import {
  applyBootEarlyThemeFromLocalStorage,
  readBootEarlySettingsRaw,
  type BootEarlyThemeMarkup,
} from '../platform/bootEarlyTheme'
import { getAppSettingsSnapshot } from '../settings/appSettingsStore'
import { getSetting } from '../settings-runtime/settingsRuntime'
import { resolveEffectiveEditorFontSize } from '../settings-runtime/editorTypography'
import { applyInitialThemeFromSettings, applyTheme, getCurrentThemeMode, getCurrentThemeSelection } from '../theme-runtime/themeRuntime'
import { getTheme } from '../theme-runtime/themeRegistry'
import {
  analyzeWindowThemeSyncHistory,
  getLastTauriWindowThemeSync,
  getTauriWindowThemeSyncHistory,
  resetTauriWindowThemeSyncHistory,
} from '../platform/tauri/windowThemeSync'
import { workspaceIdFromRoot } from '../lunaPersistence'
import {
  readQaWorkspaceSnapshot,
  qaStartupWorkspaceHasPath,
  writeQaWorkspaceSnapshot,
} from './qaStartupPersistence'

export type QaStartupWorkspaceRestore = {
  rootDir: string
  activePath: string | null
  openTabs: string[]
}

export type QaStartupBootResult = {
  bootstrap: I18nBootstrap
  earlyTheme: BootEarlyThemeMarkup
  workspace: QaStartupWorkspaceRestore | null
}

declare global {
  interface Window {
    __QA_STARTUP__?: {
      reloadBootstrap: () => Promise<QaStartupBootResult>
      getBootStatus: () => string
      getEffectiveLocale: () => string
      getThemeMode: () => 'light' | 'dark'
      getThemeVariant: () => string
      getSetting: (path: string) => unknown
      getWorkspaceRoot: () => string | null
      getActivePath: () => string | null
      getOpenTabs: () => string[]
      readPersistedSettingsJson: () => string | null
      getEarlyThemeAttr: () => {
        dataTheme: string | null
        dataThemePreset: string | null
        backgroundColor: string
      }
      getWindowThemeSync: () => {
        mode: 'light' | 'dark'
        background: string
        syncedAt: number
      } | null
      getWindowThemeSyncHistory: () => Array<{
        mode: 'light' | 'dark'
        background: string
        syncedAt: number
        seq: number
      }>
      resetWindowThemeSyncHistory: () => void
      analyzeWindowThemeSyncHistory: () => {
        inconsistentEntries: Array<{
          index: number
          mode: 'light' | 'dark'
          background: string
          reason: 'mode-background-mismatch'
        }>
        oscillationEvents: Array<{
          startedAt: number
          endedAt: number
          modes: Array<'light' | 'dark'>
        }>
        totalSyncs: number
      }
      switchThemeVariant: (variant: string) => void
      writeWorkspaceSnapshot: (snapshot: {
        rootDir: string
        activePath: string | null
        openTabs: string[]
      }) => void
    }
  }
}

async function simulateWebWorkspaceRestore(): Promise<QaStartupWorkspaceRestore | null> {
  const settings = getAppSettingsSnapshot()
  const savedWorkspaceRoot = settings.lastWorkspaceRoot?.trim()
  const savedWorkspaceId = settings.lastWorkspaceId?.trim()
  if (!savedWorkspaceRoot && !savedWorkspaceId) return null

  const workspaceId = savedWorkspaceId || workspaceIdFromRoot(savedWorkspaceRoot!)
  const snap = readQaWorkspaceSnapshot(workspaceId)
  const savedRoot = snap?.rootDir?.trim() || savedWorkspaceRoot
  if (!savedRoot) return null

  const treeHas = (path: string) => qaStartupWorkspaceHasPath(path)
  const { tabPaths } = getWorkspaceRestorePlan(treeHas, snap?.openTabs ?? [])
  const prefer = snap?.activePath?.trim() || null
  const activePath =
    prefer && treeHas(prefer) ? prefer : tabPaths[tabPaths.length - 1] ?? null

  return {
    rootDir: savedRoot,
    activePath,
    openTabs: tabPaths,
  }
}

async function runStartupBootstrap(): Promise<QaStartupBootResult> {
  const earlyTheme = applyBootEarlyThemeFromLocalStorage()
  const bootstrap = await bootstrapI18n()
  applyInitialThemeFromSettings()
  const workspace = await simulateWebWorkspaceRestore()
  return { bootstrap, earlyTheme, workspace }
}

type QaStartupInnerProps = {
  initialBootstrap: I18nBootstrap
  initialWorkspace: QaStartupWorkspaceRestore | null
  initialEarlyTheme: BootEarlyThemeMarkup
}

function QaStartupInner({
  initialBootstrap,
  initialWorkspace,
  initialEarlyTheme,
}: QaStartupInnerProps) {
  const [status, setStatus] = useState('ready')
  const [bootstrap, setBootstrap] = useState(initialBootstrap)
  const [workspace, setWorkspace] = useState(initialWorkspace)
  const [earlyTheme, setEarlyTheme] = useState(initialEarlyTheme)
  const workspaceRef = useRef(initialWorkspace)

  useEffect(() => {
    workspaceRef.current = workspace
  }, [workspace])

  const executeBootstrap = useCallback(async () => {
    setStatus('booting')
    const result = await runStartupBootstrap()
    setBootstrap(result.bootstrap)
    setWorkspace(result.workspace)
    workspaceRef.current = result.workspace
    setEarlyTheme(result.earlyTheme)
    setStatus('ready')
    return result
  }, [])

  useEffect(() => {
    window.__QA_STARTUP__ = {
      reloadBootstrap: executeBootstrap,
      getBootStatus: () => status,
      getEffectiveLocale: () => bootstrap.effectiveLocale,
      getThemeMode: () => getCurrentThemeMode(),
      getThemeVariant: () => getCurrentThemeSelection(),
      getSetting: (path) => getSetting(path),
      getWorkspaceRoot: () => workspaceRef.current?.rootDir ?? null,
      getActivePath: () => workspaceRef.current?.activePath ?? null,
      getOpenTabs: () => workspaceRef.current?.openTabs ?? [],
      readPersistedSettingsJson: () => {
        try {
          return readBootEarlySettingsRaw()
        } catch {
          return null
        }
      },
      getEarlyThemeAttr: () => {
        const root = document.documentElement
        return {
          dataTheme: root.getAttribute('data-theme'),
          dataThemePreset: root.getAttribute('data-theme-preset'),
          backgroundColor: root.style.backgroundColor,
        }
      },
      getWindowThemeSync: () => getLastTauriWindowThemeSync(),
      getWindowThemeSyncHistory: () => getTauriWindowThemeSyncHistory(),
      resetWindowThemeSyncHistory: () => resetTauriWindowThemeSyncHistory(),
      analyzeWindowThemeSyncHistory: () => analyzeWindowThemeSyncHistory(),
      switchThemeVariant: (variant: string) => {
        const theme = getTheme(variant)
        if (!theme) throw new Error(`unknown theme variant: ${variant}`)
        applyTheme(theme)
      },
      writeWorkspaceSnapshot: (snapshot) => {
        const workspaceId = workspaceIdFromRoot(snapshot.rootDir)
        writeQaWorkspaceSnapshot({
          workspaceId,
          rootDir: snapshot.rootDir,
          activePath: snapshot.activePath,
          openTabs: snapshot.openTabs,
          updatedAt: Date.now(),
        })
      },
    }
    return () => {
      delete window.__QA_STARTUP__
    }
  }, [bootstrap, executeBootstrap, status])

  const editorFontSize = resolveEffectiveEditorFontSize(getSetting('editor.fontSize'))

  const editorPreviewStyle = useMemo(
    () =>
      ({
        '--editor-content-font-size': `${editorFontSize}px`,
        fontSize: `${editorFontSize}px`,
      }) as CSSProperties,
    [editorFontSize],
  )

  const openTabsLabel = workspace?.openTabs.join('|') ?? ''

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Startup QA</h1>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-effective-locale">{bootstrap.effectiveLocale}</p>
      <p data-testid="qa-language-setting">{bootstrap.languageSetting}</p>
      <p data-testid="qa-theme-mode">{status === 'ready' ? getCurrentThemeMode() : ''}</p>
      <p data-testid="qa-theme-variant">{status === 'ready' ? getCurrentThemeSelection() : ''}</p>
      <p data-testid="qa-theme-preset">{earlyTheme.preset}</p>
      <p data-testid="qa-editor-font-size">{editorFontSize}</p>
      <p data-testid="qa-workspace-root">{workspace?.rootDir ?? ''}</p>
      <p data-testid="qa-active-path">{workspace?.activePath ?? ''}</p>
      <p data-testid="qa-open-tabs">{openTabsLabel}</p>
      <div
        className="preview-pane markdown-visual-editor qa-startup-editor-preview"
        data-testid="qa-editor-preview"
        style={editorPreviewStyle}
      >
        <p className="qa-startup-editor-sample">Sample editor text</p>
      </div>
    </div>
  )
}

export function QaStartupPlayground() {
  const [phase, setPhase] = useState<'booting' | 'ready' | 'error'>('booting')
  const [bootstrap, setBootstrap] = useState<I18nBootstrap | null>(null)
  const [workspace, setWorkspace] = useState<QaStartupWorkspaceRestore | null>(null)
  const [earlyTheme, setEarlyTheme] = useState<BootEarlyThemeMarkup | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await runStartupBootstrap()
        if (cancelled) return
        setBootstrap(result.bootstrap)
        setWorkspace(result.workspace)
        setEarlyTheme(result.earlyTheme)
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
        <h1 data-testid="qa-ready">Startup QA</h1>
        <p data-testid="qa-status">booting</p>
      </div>
    )
  }

  if (phase === 'error' || !bootstrap || !earlyTheme) {
    return (
      <div style={{ padding: 24 }}>
        <h1 data-testid="qa-ready">Startup QA</h1>
        <p data-testid="qa-status">error</p>
        <p data-testid="qa-error">{error ?? 'unknown'}</p>
      </div>
    )
  }

  return (
    <I18nProvider bootstrap={bootstrap}>
      <QaStartupInner
        initialBootstrap={bootstrap}
        initialWorkspace={workspace}
        initialEarlyTheme={earlyTheme}
      />
    </I18nProvider>
  )
}
