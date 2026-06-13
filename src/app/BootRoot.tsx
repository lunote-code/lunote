import {
  Component,
  StrictMode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { MacNativeMenuEarlyUpgrade } from './components/MacNativeMenuEarlyUpgrade'
import { bootstrapI18n, I18nProvider, type I18nBootstrap } from '../i18n'
import { BootErrorScreen } from './BootScreens'
import { BootShell } from './components/BootShell'
import { applyBootEarlyThemeFromLocalStorage } from '../platform/bootEarlyTheme'
import { syncTauriWindowTheme } from '../platform/tauri/windowThemeSync'
import { applyInitialThemeFromSettings } from '../theme-runtime/themeRuntime'
import { scheduleDeferredThemeAssetsReload } from './bootThemeAssets'
import { markBootPhase, measureBootSince } from './bootPerf'
import { logCrash, logError, logInfo } from '../lib/lunaLogger'
import { installSingleInstanceHandler } from './singleInstance'

const LazyApp = lazy(() => import('../App'))

type BootPhase =
  | { status: 'loading' }
  | { status: 'ready'; bootstrap: I18nBootstrap }
  | { status: 'error'; error: string }

function logBoot(phase: string, extra?: Record<string, unknown>): void {
  if (phase === 'failed' || phase === 'render_error') {
    logError(`[BOOT] ${phase}`, extra)
    return
  }
  logInfo(`[BOOT] ${phase}`, extra)
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    logCrash('[BOOT] render_error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <BootErrorScreen
          error={this.state.error}
          onRetry={() => {
            this.setState({ error: null })
            window.location.reload()
          }}
        />
      )
    }
    return this.props.children
  }
}

const BOOT_CROSSFADE_MS = 160

function AppReadyGate({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  useLayoutEffect(() => {
    onReady()
  }, [onReady])
  return <>{children}</>
}

function BootApp() {
  const [phase, setPhase] = useState<BootPhase>({ status: 'loading' })
  const [bootShellMounted, setBootShellMounted] = useState(true)
  const [bootShellExiting, setBootShellExiting] = useState(false)
  const [appEntered, setAppEntered] = useState(false)
  /** Intergenerational token: compatible with StrictMode dual mounting to avoid re-running bootstrap after cleanup is cancelled.*/
  const bootGenerationRef = useRef(0)

  const handleAppReady = useCallback(() => {
    markBootPhase('app_chunk_ready')
    requestAnimationFrame(() => {
      setAppEntered(true)
      setBootShellExiting(true)
    })
  }, [])

  const runBootstrap = useCallback(async (isStale?: () => boolean) => {
    setPhase({ status: 'loading' })
    setBootShellMounted(true)
    setBootShellExiting(false)
    setAppEntered(false)
    markBootPhase('start')
    logBoot('start')
    try {
      const earlyTheme = applyBootEarlyThemeFromLocalStorage()
      void syncTauriWindowTheme(earlyTheme.mode, earlyTheme.surfaceApp)
      markBootPhase('early_theme_synced')
      markBootPhase('i18n_start')
      const bootstrap = await bootstrapI18n()
      markBootPhase('i18n_ready')
      if (isStale?.()) {
        logBoot('stale_skip_ready')
        return
      }
      applyInitialThemeFromSettings()
      markBootPhase('theme_applied')
      logBoot('ready', {
        settingsLoaded: true,
        documentLoaded: false,
        editorReady: false,
        effectiveLocale: bootstrap.effectiveLocale,
        bootError: null,
      })
      setPhase({ status: 'ready', bootstrap })
      scheduleDeferredThemeAssetsReload()
      const ms = measureBootSince('start', 'theme_applied')
      if (ms != null) logBoot('bootstrap_ms', { ms: Math.round(ms) })
    } catch (e) {
      if (isStale?.()) return
      const message = e instanceof Error ? e.message : String(e)
      logBoot('failed', { bootError: message })
      setPhase({ status: 'error', error: message })
    }
  }, [])

  useEffect(() => {
    markBootPhase('react_mounted')
    const generation = ++bootGenerationRef.current
    void runBootstrap(() => bootGenerationRef.current !== generation)
  }, [runBootstrap])

  useEffect(() => {
    if (!appEntered) return
    const unmountTimer = window.setTimeout(() => {
      setBootShellMounted(false)
    }, BOOT_CROSSFADE_MS)
    return () => window.clearTimeout(unmountTimer)
  }, [appEntered])

  useEffect(() => {
    if (phase.status !== 'ready') return
    void installSingleInstanceHandler()
  }, [phase.status])

  if (phase.status === 'error') {
    return <BootErrorScreen error={phase.error} onRetry={() => void runBootstrap()} />
  }

  const ready = phase.status === 'ready'

  return (
    <div className="boot-stage">
      {bootShellMounted ? (
        <div className={`boot-shell-layer${bootShellExiting ? ' boot-shell-layer--exit' : ''}`}>
          <BootShell />
        </div>
      ) : null}
      {ready ? (
        <div className={`boot-app-layer${appEntered ? ' boot-app-layer--enter' : ''}`}>
          <I18nProvider bootstrap={phase.bootstrap}>
            <MacNativeMenuEarlyUpgrade />
            <Suspense fallback={<BootShell />}>
              <AppReadyGate onReady={handleAppReady}>
                <LazyApp />
              </AppReadyGate>
            </Suspense>
          </I18nProvider>
        </div>
      ) : null}
    </div>
  )
}

export function mountApp(rootEl: HTMLElement, options?: { strict?: boolean }): Root {
  const tree = (
    <AppErrorBoundary>
      <BootApp />
    </AppErrorBoundary>
  )
  const root = createRoot(rootEl)
  root.render(options?.strict ? <StrictMode>{tree}</StrictMode> : tree)
  return root
}
