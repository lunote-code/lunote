import './index.css'
import './theme-presets.css'
import './editor/hljsEditorTheme.css'
import './editor/lunaMarkdownTable.css'
import { mountApp } from './app/BootRoot'

function isTauriRuntime(): boolean {
  const g = globalThis as {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
  return Boolean(g.__TAURI__ || g.__TAURI_INTERNALS__)
}

function renderRuntimeBlockedMessage(message: string): void {
  document.body.innerHTML = `<div style="padding:24px;font-family:system-ui;line-height:1.6;color:#b42318;background:#fff1f3;border:1px solid #fecdca;border-radius:12px;margin:24px;">${message}</div>`
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
    '<div style="padding:24px;font-family:system-ui">Missing #root element — cannot start Luna Note.</div>'
} else if (import.meta.env.DEV) {
  if (isTauriRuntime()) installAppViewportHeightSync()
  mountApp(rootEl, { strict: true })
} else {
  if (!isTauriRuntime()) {
    renderRuntimeBlockedMessage(
      'This release build can only run inside the official desktop app runtime. Browser URL access is blocked for security.',
    )
    throw new Error('Blocked non-tauri runtime access in production')
  }
  installAppViewportHeightSync()
  installProductionInteractionGuard()
  mountApp(rootEl)
}
