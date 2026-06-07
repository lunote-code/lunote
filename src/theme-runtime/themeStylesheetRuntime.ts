import { isTauri } from '@tauri-apps/api/core'
import { getSetting } from '../settings-runtime/settingsRuntime'
import {
  listThemeStylesheets,
  readThemeStylesheet,
  type ThemeStyleEntry,
} from '../platform/tauri/themeService'
import { syncThemeCssMenu } from '../platform/tauri/platformShellService'

type StylesheetSubscriber = () => void

const STYLE_TAG_ID = 'luna-user-theme-css'
const stylesheetSubscribers = new Set<StylesheetSubscriber>()

let availableStylesheets: readonly ThemeStyleEntry[] = []
let activeStylesheetName = ''
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

function syncRuntimeMarkers(fileName: string): void {
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

export function getActiveThemeStylesheetCss(): string {
  return activeStylesheetCss
}

export async function reloadThemeStylesheetsFromDisk(): Promise<void> {
  if (!isTauri()) {
    availableStylesheets = []
    activeStylesheetCss = ''
    notifyStylesheetSubscribers()
    setStyleTagContent('')
    syncRuntimeMarkers('')
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

  activeStylesheetName = fileName

  if (!isTauri() || !fileName) {
    activeStylesheetCss = ''
    setStyleTagContent('')
    syncRuntimeMarkers('')
    return
  }

  try {
    const css = await readThemeStylesheet(fileName)
    activeStylesheetCss = css
    setStyleTagContent(css)
    syncRuntimeMarkers(fileName)
  } catch (error) {
    activeStylesheetCss = ''
    setStyleTagContent('')
    syncRuntimeMarkers('')
    console.warn('[theme-stylesheet-runtime] Failed to apply theme stylesheet.', {
      fileName,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
