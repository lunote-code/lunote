import { isTauri } from '@tauri-apps/api/core'
import { getSetting, setSetting } from '../settings-runtime/settingsRuntime'
import {
  ensureThemeExportDirectory,
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

function readExportStyleSetting(): string[] {
  const value = getSetting('theme.exportCssSnippets')
  return typeof value === 'string' ? normalizeNames(value) : []
}

export function stringifyExportStyleNames(names: readonly string[]): string {
  return normalizeNames(names.join('\n')).join('\n')
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

export async function toggleThemeExportStyle(name: string): Promise<void> {
  const current = new Set(readExportStyleSetting())
  if (current.has(name)) current.delete(name)
  else current.add(name)
  await setSetting('theme.exportCssSnippets', stringifyExportStyleNames(Array.from(current)))
}

export async function ensureThemeExportFolder(): Promise<string> {
  return ensureThemeExportDirectory()
}

export async function reloadThemeExportStylesFromDisk(): Promise<void> {
  if (!isTauri()) {
    availableExportStyles = []
    activeExportStyleNames = []
    activeExportStyleCss = ''
    notifyExportStyleSubscribers()
    return
  }
  const nextEntries = await listThemeExportStyles()
  availableExportStyles = nextEntries
  notifyExportStyleSubscribers()
  await refreshThemeExportStylesFromSettings()
}

export async function refreshThemeExportStylesFromSettings(): Promise<void> {
  const names = readExportStyleSetting()
  activeExportStyleNames = names

  if (!isTauri() || names.length === 0) {
    activeExportStyleCss = ''
    notifyExportStyleSubscribers()
    return
  }

  const chunks = await Promise.all(
    names.map(async (name) => {
      try {
        const css = await readThemeExportStyle(name)
        return `/* export-style:${name} */\n${css}`
      } catch (error) {
        console.warn('[theme-export-style-runtime] Failed to read export style.', {
          name,
          message: error instanceof Error ? error.message : String(error),
        })
        return ''
      }
    }),
  )

  activeExportStyleCss = chunks.filter(Boolean).join('\n\n')
  notifyExportStyleSubscribers()
}
