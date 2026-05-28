import { isTauri } from '@tauri-apps/api/core'
import { getSetting } from '../settings-runtime/settingsRuntime'
import {
  listThemeStylesheets,
  readThemeStylesheet,
  type ThemeStyleEntry,
} from '../platform/tauri/themeService'
import { syncThemeCssMenu } from '../platform/tauri/platformShellService'

export type ThemeCssCompatMode = 'native' | 'obsidian-auto'

type StylesheetSubscriber = () => void

const STYLE_TAG_ID = 'luna-user-theme-css'
const COMPAT_MODES = new Set<ThemeCssCompatMode>(['native', 'obsidian-auto'])
const stylesheetSubscribers = new Set<StylesheetSubscriber>()

let availableStylesheets: readonly ThemeStyleEntry[] = []
let activeStylesheetName = ''
let activeCompatKind: 'none' | 'obsidian' | 'native' = 'none'
let activeStylesheetCss = ''

function notifyStylesheetSubscribers(): void {
  for (const subscriber of stylesheetSubscribers) subscriber()
}

function setStyleTagContent(css: string): void {
  if (typeof document === 'undefined') return
  let style = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!css.trim()) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_TAG_ID
    document.head.appendChild(style)
  }
  style.textContent = css
}

function readThemeCssFileName(): string {
  const value = getSetting('theme.cssFile')
  return typeof value === 'string' ? value.trim() : ''
}

function readCompatMode(): ThemeCssCompatMode {
  const value = getSetting('theme.cssCompatMode')
  return typeof value === 'string' && COMPAT_MODES.has(value as ThemeCssCompatMode)
    ? (value as ThemeCssCompatMode)
    : 'obsidian-auto'
}

function detectObsidianTheme(css: string): boolean {
  const sample = css.toLowerCase()
  return (
    sample.includes('.theme-dark') ||
    sample.includes('.theme-light') ||
    sample.includes('--background-primary') ||
    sample.includes('.workspace-split') ||
    sample.includes('.markdown-preview-view') ||
    sample.includes('.markdown-source-view') ||
    sample.includes('.view-content')
  )
}

function buildObsidianCompatCss(): string {
  return `
body.theme-dark,
body.theme-light {
  --divider-color: var(--background-modifier-border, var(--border-subtle));
}

.workspace.workspace-root {
  min-height: 100%;
}

.workspace-split.mod-root {
  min-width: 0;
  min-height: 0;
}

.workspace-leaf {
  min-width: 0;
  min-height: 0;
}

.workspace-leaf-content[data-type='markdown'] {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workspace-leaf-content[data-type='markdown'] .view-content {
  min-height: 0;
  flex: 1 1 auto;
}

.markdown-preview-view,
.markdown-source-view {
  background: var(--background-primary);
  color: var(--text-normal);
}
`.trim()
}

function syncRuntimeMarkers(
  fileName: string,
  compatKind: 'none' | 'obsidian' | 'native',
): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const body = document.body
  if (!body) return

  if (fileName) {
    root.setAttribute('data-theme-css-file', fileName)
    body.setAttribute('data-theme-css-file', fileName)
  } else {
    root.removeAttribute('data-theme-css-file')
    body.removeAttribute('data-theme-css-file')
  }

  if (compatKind === 'none') {
    root.removeAttribute('data-theme-css-compat')
    body.removeAttribute('data-theme-css-compat')
    body.classList.remove('obsidian-app')
    return
  }

  root.setAttribute('data-theme-css-compat', compatKind)
  body.setAttribute('data-theme-css-compat', compatKind)
  body.classList.toggle('obsidian-app', compatKind === 'obsidian')
}

export function listAvailableThemeStylesheets(): readonly ThemeStyleEntry[] {
  return availableStylesheets
}

export function subscribeThemeStylesheetCatalog(callback: StylesheetSubscriber): () => void {
  stylesheetSubscribers.add(callback)
  return () => stylesheetSubscribers.delete(callback)
}

export function getActiveThemeStylesheetName(): string {
  return activeStylesheetName
}

export function getActiveThemeStylesheetCompat(): 'none' | 'obsidian' | 'native' {
  return activeCompatKind
}

export function getActiveThemeStylesheetCss(): string {
  return activeStylesheetCss
}

export async function reloadThemeStylesheetsFromDisk(): Promise<void> {
  if (!isTauri()) {
    availableStylesheets = []
    activeStylesheetCss = ''
    notifyStylesheetSubscribers()
    setStyleTagContent('')
    syncRuntimeMarkers('', 'none')
    return
  }

  const nextEntries = await listThemeStylesheets()
  availableStylesheets = nextEntries
  await syncThemeCssMenu(nextEntries.map((entry) => entry.name))
  notifyStylesheetSubscribers()
  await refreshThemeStylesheetFromSettings()
}

export async function refreshThemeStylesheetFromSettings(): Promise<void> {
  const fileName = readThemeCssFileName()
  const compatMode = readCompatMode()

  activeStylesheetName = fileName

  if (!isTauri() || !fileName) {
    activeCompatKind = 'none'
    activeStylesheetCss = ''
    setStyleTagContent('')
    syncRuntimeMarkers('', 'none')
    return
  }

  try {
    const css = await readThemeStylesheet(fileName)
    const isObsidianTheme = compatMode === 'obsidian-auto' && detectObsidianTheme(css)
    const compatCss = isObsidianTheme ? `${buildObsidianCompatCss()}\n` : ''
    activeCompatKind = isObsidianTheme ? 'obsidian' : 'native'
    activeStylesheetCss = css
    setStyleTagContent(`${compatCss}${css}`)
    syncRuntimeMarkers(fileName, activeCompatKind)
  } catch (error) {
    activeCompatKind = 'none'
    activeStylesheetCss = ''
    setStyleTagContent('')
    syncRuntimeMarkers('', 'none')
    console.warn('[theme-stylesheet-runtime] Failed to apply theme stylesheet.', {
      fileName,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
