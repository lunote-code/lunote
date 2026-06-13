import { isTauri } from '@tauri-apps/api/core'
import { getSetting, setSetting } from '../settings-runtime/settingsRuntime'
import {
  listThemeExportStyles,
  readThemeExportStyle,
  type ThemeStyleEntry,
} from '../platform/tauri/themeService'

type ExportStyleSubscriber = () => void

const exportStyleSubscribers = new Set<ExportStyleSubscriber>()

let availableExportStyles: readonly ThemeStyleEntry[] = []
let activeExportStyleNames: readonly string[] = []
let activeExportStyleCss = ''

function notifyExportStyleSubscribers(): void {
  for (const subscriber of exportStyleSubscribers) subscriber()
}

function normalizeNames(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/g)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

function readLegacyExportStyleNames(): string[] {
  const value = getSetting('theme.exportCssSnippets')
  return typeof value === 'string' ? normalizeNames(value) : []
}

function readExportCssFileName(): string {
  const value = getSetting('theme.exportCssFile')
  if (typeof value === 'string' && value.trim()) return value.trim()
  const legacy = readLegacyExportStyleNames()
  return legacy[0] ?? ''
}

function readExportStyleInlineMap(): Record<string, string> {
  const raw = getSetting('theme.exportCssSnippetsInline')
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

function readExportCssContent(): string {
  const value = getSetting('theme.exportCssContent')
  return typeof value === 'string' ? value : ''
}

export async function upsertExportStyleInline(name: string, css: string): Promise<void> {
  const map = readExportStyleInlineMap()
  map[name] = css
  await setSetting('theme.exportCssSnippetsInline', JSON.stringify(map))
}

export function listAvailableThemeExportStyles(): readonly ThemeStyleEntry[] {
  return availableExportStyles
}

export function subscribeThemeExportStyleCatalog(callback: ExportStyleSubscriber): () => void {
  exportStyleSubscribers.add(callback)
  return () => exportStyleSubscribers.delete(callback)
}

export function getActiveThemeExportStyleNames(): readonly string[] {
  return activeExportStyleNames
}

export function getActiveThemeExportStyleCss(): string {
  return activeExportStyleCss
}

export async function reloadThemeExportStylesFromDisk(): Promise<void> {
  if (!isTauri()) {
    const inlineMap = readExportStyleInlineMap()
    availableExportStyles = Object.keys(inlineMap)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((name) => ({ name }))
    notifyExportStyleSubscribers()
    await refreshThemeExportStylesFromSettings()
    return
  }
  const nextEntries = await listThemeExportStyles()
  availableExportStyles = nextEntries
  notifyExportStyleSubscribers()
  await refreshThemeExportStylesFromSettings()
}

export async function refreshThemeExportStylesFromSettings(): Promise<void> {
  const fileName = readExportCssFileName()
  activeExportStyleNames = fileName ? [fileName] : []

  if (!fileName) {
    activeExportStyleCss = ''
    notifyExportStyleSubscribers()
    return
  }

  if (!isTauri()) {
    const inlineMap = readExportStyleInlineMap()
    const inlineCss = inlineMap[fileName]?.trim() ?? readExportCssContent().trim()
    activeExportStyleCss = inlineCss
    notifyExportStyleSubscribers()
    return
  }

  try {
    const css = await readThemeExportStyle(fileName)
    activeExportStyleCss = css
  } catch (error) {
    activeExportStyleCss = ''
    console.warn('[theme-export-style-runtime] Failed to read export style.', {
      fileName,
      message: error instanceof Error ? error.message : String(error),
    })
  }
  notifyExportStyleSubscribers()
}
