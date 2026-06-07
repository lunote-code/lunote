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
import { QaCodeBlockCmPlayground } from './app/QaCodeBlockCmPlayground'
import { QaDocumentEditorPlayground } from './app/QaDocumentEditorPlayground'
import { QaExportPlayground } from './app/QaExportPlayground'
import { QaKnowledgePlayground } from './app/QaKnowledgePlayground'
import { QaMermaidPlayground } from './app/QaMermaidPlayground'
import { QaModeSwitchPlayground } from './app/QaModeSwitchPlayground'
import { QaOverlayPlayground } from './app/QaOverlayPlayground'
import { QaSnapshotPlayground } from './app/QaSnapshotPlayground'
import { QaPreferencesPlayground } from './app/QaPreferencesPlayground'
import { QaStartupPlayground } from './app/QaStartupPlayground'
import { QaUiPlayground } from './app/QaUiPlayground'
import { QaMenuPlayground } from './app/QaMenuPlayground'
import { QaMultiTabPlayground } from './app/QaMultiTabPlayground'
import { createRoot } from 'react-dom/client'

function isTauriRuntime(): boolean {
  const g = globalThis as {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
  return Boolean(g.__TAURI__ || g.__TAURI_INTERNALS__)
}

function isQaOverlayRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'overlays'
}

function isQaCodeBlockCmRoute(): boolean {
  const qa = new URLSearchParams(window.location.search).get('qa')
  return qa === 'codeblock-cm' || qa === 'codeblock-gutter'
}

function isQaSnapshotRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'snapshot'
}

function isQaExportRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'export'
}

function isQaKnowledgeRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'knowledge'
}

function isQaPreferencesRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'preferences'
}

function isQaDocumentEditorRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'document-editor'
}

function isQaMermaidRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'mermaid'
}

function isQaModeSwitchRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'mode-switch'
}

function isQaStartupRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'startup'
}

function isQaUiRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'ui'
}

function isQaMenuRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'menu'
}

function isQaMultiTabRoute(): boolean {
  return new URLSearchParams(window.location.search).get('qa') === 'multi-tab'
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

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<div class="luna-runtime-blocked luna-runtime-blocked--neutral">Missing #root element — cannot start Lunote.</div>'
} else if (import.meta.env.DEV) {
  if (isTauriRuntime()) {
    installAppViewportHeightSync()
    installGlobalErrorHandlers()
  }
  if (isQaOverlayRoute()) {
    createRoot(rootEl).render(<QaOverlayPlayground />)
  } else if (isQaCodeBlockCmRoute()) {
    createRoot(rootEl).render(<QaCodeBlockCmPlayground />)
  } else if (isQaDocumentEditorRoute()) {
    createRoot(rootEl).render(<QaDocumentEditorPlayground />)
  } else if (isQaMermaidRoute()) {
    createRoot(rootEl).render(<QaMermaidPlayground />)
  } else if (isQaKnowledgeRoute()) {
    createRoot(rootEl).render(<QaKnowledgePlayground />)
  } else if (isQaExportRoute()) {
    createRoot(rootEl).render(<QaExportPlayground />)
  } else if (isQaSnapshotRoute()) {
    createRoot(rootEl).render(<QaSnapshotPlayground />)
  } else if (isQaPreferencesRoute()) {
    createRoot(rootEl).render(<QaPreferencesPlayground />)
  } else if (isQaModeSwitchRoute()) {
    createRoot(rootEl).render(<QaModeSwitchPlayground />)
  } else if (isQaStartupRoute()) {
    createRoot(rootEl).render(<QaStartupPlayground />)
  } else if (isQaUiRoute()) {
    createRoot(rootEl).render(<QaUiPlayground />)
  } else if (isQaMenuRoute()) {
    createRoot(rootEl).render(<QaMenuPlayground />)
  } else if (isQaMultiTabRoute()) {
    createRoot(rootEl).render(<QaMultiTabPlayground />)
  } else {
    mountApp(rootEl, { strict: true })
  }
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
