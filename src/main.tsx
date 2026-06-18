import './index.css'
import './theme-presets.css'
import './theme/modeThemeTokens.css'
import './theme/calloutThemeTokens.css'
import 'katex/dist/katex.min.css'
import './editor/katexEditorTheme.css'
import './editor/hljsEditorTheme.css'
import './editor/lunaMarkdownTable.css'
import { mountApp } from './app/BootRoot'
import { installGlobalErrorHandlers } from './lib/lunaLogger'
import { createRoot } from 'react-dom/client'
import type { ComponentType } from 'react'

function isTauriRuntime(): boolean {
  const g = globalThis as {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
  return Boolean(g.__TAURI__ || g.__TAURI_INTERNALS__)
}

function qaRouteParam(): string | null {
  return new URLSearchParams(window.location.search).get('qa')
}

function renderRuntimeBlockedMessage(message: string): void {
  document.body.innerHTML = `<div class="luna-runtime-blocked">${message}</div>`
}

/** WebView2 on Windows can report incorrect `dvh`; pin shell height to innerHeight. */
function installAppViewportHeightSync(): void {
  const root = document.documentElement
  const sync = () => {
    root.style.setProperty('--app-vh', `${window.innerHeight}px`)
  }
  sync()
  window.addEventListener('resize', sync)
  window.visualViewport?.addEventListener('resize', sync)
}

function installProductionInteractionGuard(): void {
  const isInspectShortcut = (event: KeyboardEvent): boolean => {
    const key = event.key.toLowerCase()
    const mod = event.metaKey || event.ctrlKey
    if (event.key === 'F12') return true
    if (mod && event.shiftKey && (key === 'i' || key === 'c' || key === 'j')) return true
    return false
  }

  const isReloadShortcut = (event: KeyboardEvent): boolean => {
    const key = event.key.toLowerCase()
    const mod = event.metaKey || event.ctrlKey
    if (event.key === 'F5') return true
    if (mod && key === 'r') return true
    return false
  }

  //The capture phase only blocks the system default menu; stopPropagation is not allowed, otherwise the React custom right-click menu will be truncated.
  window.addEventListener(
    'contextmenu',
    (event) => {
      event.preventDefault()
    },
    { capture: true },
  )

  window.addEventListener(
    'keydown',
    (event) => {
      if (!isInspectShortcut(event) && !isReloadShortcut(event)) return
      event.preventDefault()
      event.stopPropagation()
    },
    { capture: true },
  )
}

type QaPlaygroundLoader = () => Promise<{ default: ComponentType } | Record<string, unknown>>

async function loadDevQaPlayground(qa: string): Promise<ComponentType | null> {
  const exportNameByRoute: Record<string, string> = {
    overlays: 'QaOverlayPlayground',
    'codeblock-cm': 'QaCodeBlockCmPlayground',
    'codeblock-gutter': 'QaCodeBlockCmPlayground',
    'document-editor': 'QaDocumentEditorPlayground',
    mermaid: 'QaMermaidPlayground',
    knowledge: 'QaKnowledgePlayground',
    'app-knowledge': 'QaAppKnowledgeIntegrationPlayground',
    export: 'QaExportPlayground',
    snapshot: 'QaSnapshotPlayground',
    preferences: 'QaPreferencesPlayground',
    'mode-switch': 'QaModeSwitchPlayground',
    startup: 'QaStartupPlayground',
    ui: 'QaUiPlayground',
    menu: 'QaMenuPlayground',
    'multi-tab': 'QaMultiTabPlayground',
    'sidebar-search': 'QaSidebarSearchPlayground',
    'workspace-tree': 'QaWorkspaceTreePlayground',
    'window-title': 'QaWindowTitlePlayground',
    'context-menu': 'QaContextMenuPlayground',
    'chrome-visual': 'QaChromeVisualPlayground',
    'first-run': 'QaFirstRunPlayground',
    'workspace-sidebar-selection': 'QaWorkspaceSidebarSelectionPlayground',
    'workspace-bulk': 'QaBulkWorkspacePlayground',
    'native-input-clipboard': 'QaNativeInputClipboardPlayground',
    'plugin-catalog-media': 'QaPluginCatalogMediaPlayground',
  }

  const routes: Record<string, QaPlaygroundLoader> = {
    overlays: () => import('./app/QaOverlayPlayground'),
    'codeblock-cm': () => import('./app/QaCodeBlockCmPlayground'),
    'codeblock-gutter': () => import('./app/QaCodeBlockCmPlayground'),
    'document-editor': () => import('./app/QaDocumentEditorPlayground'),
    mermaid: () => import('./app/QaMermaidPlayground'),
    knowledge: () => import('./app/QaKnowledgePlayground'),
    'app-knowledge': () => import('./app/QaAppKnowledgeIntegrationPlayground'),
    export: () => import('./app/QaExportPlayground'),
    snapshot: () => import('./app/QaSnapshotPlayground'),
    preferences: () => import('./app/QaPreferencesPlayground'),
    'mode-switch': () => import('./app/QaModeSwitchPlayground'),
    startup: () => import('./app/QaStartupPlayground'),
    ui: () => import('./app/QaUiPlayground'),
    menu: () => import('./app/QaMenuPlayground'),
    'multi-tab': () => import('./app/QaMultiTabPlayground'),
    'sidebar-search': () => import('./app/QaSidebarSearchPlayground'),
    'workspace-tree': () => import('./app/QaWorkspaceTreePlayground'),
    'window-title': () => import('./app/QaWindowTitlePlayground'),
    'context-menu': () => import('./app/QaContextMenuPlayground'),
    'chrome-visual': () => import('./app/QaChromeVisualPlayground'),
    'first-run': () => import('./app/QaFirstRunPlayground'),
    'workspace-sidebar-selection': () => import('./app/QaWorkspaceSidebarSelectionPlayground'),
    'workspace-bulk': () => import('./app/QaBulkWorkspacePlayground'),
    'native-input-clipboard': () => import('./app/QaNativeInputClipboardPlayground'),
    'plugin-catalog-media': () => import('./app/QaPluginCatalogMediaPlayground'),
  }

  const loader = routes[qa]
  if (!loader) return null
  const mod = await loader()
  if (mod.default) return mod.default as ComponentType
  const exportName = exportNameByRoute[qa]
  const component = exportName ? (mod as Record<string, unknown>)[exportName] : null
  return typeof component === 'function' ? (component as ComponentType) : null
}

async function bootDevApp(rootEl: HTMLElement): Promise<void> {
  const qa = qaRouteParam()
  if (qa) {
    const Playground = await loadDevQaPlayground(qa)
    if (Playground) {
      createRoot(rootEl).render(<Playground />)
      return
    }
  }
  mountApp(rootEl, { strict: true })
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<div class="luna-runtime-blocked luna-runtime-blocked--neutral">Missing #root element — cannot start Lunote.</div>'
} else if (import.meta.env.DEV) {
  if (isTauriRuntime()) {
    installAppViewportHeightSync()
    installGlobalErrorHandlers()
  }
  void bootDevApp(rootEl)
} else {
  if (!isTauriRuntime()) {
    renderRuntimeBlockedMessage(
      'This release build can only run inside the official desktop app runtime. Browser URL access is blocked for security.',
    )
    throw new Error('Blocked non-tauri runtime access in production')
  }
  installAppViewportHeightSync()
  installProductionInteractionGuard()
  installGlobalErrorHandlers()
  mountApp(rootEl)
}
