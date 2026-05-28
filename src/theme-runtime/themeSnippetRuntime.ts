import { isTauri } from '@tauri-apps/api/core'
import { getSetting, setSetting } from '../settings-runtime/settingsRuntime'
import {
  ensureThemeSnippetsDirectory,
  listThemeSnippets,
  readThemeSnippet,
  type ThemeStyleEntry,
} from '../platform/tauri/themeService'

type SnippetSubscriber = () => void

const STYLE_TAG_ID = 'luna-user-theme-snippets'
const snippetSubscribers = new Set<SnippetSubscriber>()

let availableSnippets: readonly ThemeStyleEntry[] = []
let activeSnippetNames: readonly string[] = []
let activeSnippetCss = ''

function notifySnippetSubscribers(): void {
  for (const subscriber of snippetSubscribers) subscriber()
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

function normalizeSnippetNames(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/g)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

function readSnippetSetting(): string[] {
  const value = getSetting('theme.cssSnippets')
  return typeof value === 'string' ? normalizeSnippetNames(value) : []
}

export function stringifySnippetNames(names: readonly string[]): string {
  return normalizeSnippetNames(names.join('\n')).join('\n')
}

export function listAvailableThemeSnippets(): readonly ThemeStyleEntry[] {
  return availableSnippets
}

export function subscribeThemeSnippetCatalog(callback: SnippetSubscriber): () => void {
  snippetSubscribers.add(callback)
  return () => snippetSubscribers.delete(callback)
}

export function getActiveThemeSnippetNames(): readonly string[] {
  return activeSnippetNames
}

export function getActiveThemeSnippetCss(): string {
  return activeSnippetCss
}

export function isThemeSnippetEnabled(name: string): boolean {
  return activeSnippetNames.includes(name)
}

export async function toggleThemeSnippet(name: string): Promise<void> {
  const current = new Set(readSnippetSetting())
  if (current.has(name)) current.delete(name)
  else current.add(name)
  await setSetting('theme.cssSnippets', stringifySnippetNames(Array.from(current)))
}

export async function ensureThemeSnippetsFolder(): Promise<string> {
  return ensureThemeSnippetsDirectory()
}

export async function reloadThemeSnippetsFromDisk(): Promise<void> {
  if (!isTauri()) {
    availableSnippets = []
    activeSnippetNames = []
    activeSnippetCss = ''
    setStyleTagContent('')
    notifySnippetSubscribers()
    return
  }
  const nextEntries = await listThemeSnippets()
  availableSnippets = nextEntries
  notifySnippetSubscribers()
  await refreshThemeSnippetsFromSettings()
}

export async function refreshThemeSnippetsFromSettings(): Promise<void> {
  const names = readSnippetSetting()
  activeSnippetNames = names

  if (!isTauri() || names.length === 0) {
    activeSnippetCss = ''
    setStyleTagContent('')
    notifySnippetSubscribers()
    return
  }

  const chunks = await Promise.all(
    names.map(async (name) => {
      try {
        const css = await readThemeSnippet(name)
        return `/* theme-snippet:${name} */\n${css}`
      } catch (error) {
        console.warn('[theme-snippet-runtime] Failed to read theme snippet.', {
          name,
          message: error instanceof Error ? error.message : String(error),
        })
        return ''
      }
    }),
  )

  activeSnippetCss = chunks.filter(Boolean).join('\n\n')
  setStyleTagContent(activeSnippetCss)
  notifySnippetSubscribers()
}
