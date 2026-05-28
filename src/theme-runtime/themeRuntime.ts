import { getSetting, subscribe } from '../settings-runtime/settingsRuntime'
import type { ThemeDefinition } from './themeTypes'
import { applyThemeCssVariables } from './themeCssInjector'
import { getTheme, listThemeDefinitions, registerTheme, unregisterTheme } from './themeRegistry'
import { INVALID_CUSTOM_THEME_ID, loadThemeFromJSON } from './themeLoader'
import { DARK_THEME, GITHUB_DARK_THEME, LIGHT_THEME } from './themeTokens'
import { detectLegacyTheme, normalizeThemeInput } from './themeCompatibilityLayer'
import { validateThemeContrast } from './themeContrastValidator'
import {
  normalizeThemeVariant,
  resolveThemeVariant,
  type ThemeVariant,
} from './themeResolver'
import { isTauri } from '@tauri-apps/api/core'
import { listCustomThemeFiles, readCustomThemeJson } from '../platform/tauri/themeService'
import { refreshThemeExportStylesFromSettings } from './themeExportStyleRuntime'
import { refreshThemeStylesheetFromSettings } from './themeStylesheetRuntime'
import { refreshThemeSnippetsFromSettings } from './themeSnippetRuntime'

type ThemeSubscriber = (theme: ThemeDefinition) => void

let activeTheme: ThemeDefinition = DARK_THEME
let activeThemeSignature = ''
let previewTheme: ThemeVariant | null = null
let registeredCustomThemeId: string | null = null
let registeredDiskThemeIds = new Set<string>()
const subscribers = new Set<ThemeSubscriber>()

function notify(): void {
  for (const subscriber of subscribers) subscriber(activeTheme)
}

function readThemeMode(): ThemeVariant {
  const value = getSetting('theme.active')
  return normalizeThemeVariant(value)
}

function clearRegisteredCustomTheme(): void {
  if (!registeredCustomThemeId) return
  if (!registeredDiskThemeIds.has(registeredCustomThemeId)) {
    unregisterTheme(registeredCustomThemeId)
  }
  registeredCustomThemeId = null
}

function readCustomThemeJSON(): string {
  const value = getSetting('theme.customThemeJSON')
  return typeof value === 'string' ? value : ''
}

export function registerImportedCustomTheme(theme: ThemeDefinition): void {
  if (registeredCustomThemeId && registeredCustomThemeId !== theme.id) {
    if (!registeredDiskThemeIds.has(registeredCustomThemeId)) {
      unregisterTheme(registeredCustomThemeId)
    }
  }
  registerTheme(theme)
  registeredCustomThemeId = theme.id
}

function syncDiskThemes(themes: readonly ThemeDefinition[]): void {
  const nextIds = new Set(themes.map((theme) => theme.id))
  let changed = false

  for (const id of registeredDiskThemeIds) {
    if (nextIds.has(id)) continue
    if (registeredCustomThemeId !== id) {
      unregisterTheme(id)
    }
    changed = true
  }

  for (const theme of themes) {
    registerTheme(theme)
    if (!registeredDiskThemeIds.has(theme.id)) changed = true
  }

  registeredDiskThemeIds = nextIds
  if (changed) notify()
}

export async function reloadCustomThemesFromDisk(): Promise<void> {
  if (!isTauri()) return

  const entries = await listCustomThemeFiles()
  const themes: ThemeDefinition[] = []

  for (const entry of entries) {
    try {
      const json = await readCustomThemeJson(entry.name)
      const theme = loadThemeFromJSON(json, entry.name)
      if (theme.id === INVALID_CUSTOM_THEME_ID) continue
      themes.push(theme)
    } catch (error) {
      console.warn('[theme-runtime] Failed to load custom theme from disk.', {
        name: entry.name,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  syncDiskThemes(themes)
  refreshThemeFromSettings()
}

export function restoreCustomThemeFromSettings(): ThemeDefinition | null {
  const json = readCustomThemeJSON().trim()
  if (!json) {
    clearRegisteredCustomTheme()
    return null
  }
  const theme = loadThemeFromJSON(json)
  if (theme.id === INVALID_CUSTOM_THEME_ID) {
    clearRegisteredCustomTheme()
    return null
  }
  registerImportedCustomTheme(theme)
  return theme
}

function resolveThemeFromSettings(): ThemeDefinition {
  const mode = readThemeMode()
  const variant = resolveThemeVariant(mode)
  const builtInTheme = getTheme(variant)
  if (builtInTheme) return builtInTheme
  return variant.endsWith('-light') ? LIGHT_THEME : DARK_THEME
}

function resolveThemeVariantDefinition(variant: ThemeVariant): ThemeDefinition {
  return getTheme(variant) ?? (variant.endsWith('-light') ? LIGHT_THEME : DARK_THEME)
}

function resolveThemeForRender(): ThemeDefinition {
  return previewTheme ? resolveThemeVariantDefinition(previewTheme) : resolveThemeFromSettings()
}

export function applyTheme(theme: ThemeDefinition): void {
  applyCompatibleTheme(theme)
}

export function isLegacyTheme(theme: unknown): boolean {
  return detectLegacyTheme(theme)
}

export function applyCompatibleTheme(theme: ThemeDefinition): void {
  const compatibleTheme = normalizeThemeInput(theme)
  const safeTheme = validateThemeContrast({
    background: compatibleTheme.colors.background,
    foreground: compatibleTheme.colors.foreground,
    muted: compatibleTheme.colors.muted,
    surface: compatibleTheme.colors.background,
  })
    ? compatibleTheme
    : normalizeThemeInput(GITHUB_DARK_THEME)
  if (safeTheme !== compatibleTheme) {
    console.warn('[theme-runtime] Theme contrast validation failed; falling back to github-dark.', {
      themeId: compatibleTheme.id,
      colors: compatibleTheme.colors,
    })
  }
  const nextSignature = JSON.stringify({
    id: safeTheme.id,
    builtIn: safeTheme.builtIn,
    colors: safeTheme.colors,
    radius: safeTheme.radius,
    spacing: safeTheme.spacing,
  })
  if (nextSignature === activeThemeSignature) return
  activeThemeSignature = nextSignature
  activeTheme = safeTheme
  applyThemeCssVariables(safeTheme)
  const root = document.documentElement
  const themeMode = isLightTheme(safeTheme) ? 'light' : 'dark'
  root.setAttribute('data-theme', themeMode)
  root.setAttribute('data-theme-preset', presetForTheme(safeTheme))
  document.body?.classList.remove('theme-dark', 'theme-light')
  document.body?.classList.add(themeMode === 'light' ? 'theme-light' : 'theme-dark')
  document.body?.setAttribute('data-theme', themeMode)
  document.body?.setAttribute('data-theme-preset', presetForTheme(safeTheme))
  notify()
}

function presetForTheme(theme: ThemeDefinition): string {
  if (!theme.builtIn) return 'custom'
  const preset = theme.family ?? theme.id
  if (preset === 'idea' || preset === 'dim') return preset
  return 'github'
}

function isLightTheme(theme: ThemeDefinition): boolean {
  if (theme.variant === 'light') return true
  if (theme.variant === 'dark') return false
  if (theme.id === 'light') return true
  if (theme.id === 'dark') return false
  const color = theme.colors.background
  if (!color.startsWith('#') || color.length !== 7) return false
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

export function refreshThemeFromSettings(): void {
  restoreCustomThemeFromSettings()
  const next = resolveThemeForRender()
  applyTheme(next)
  void refreshThemeStylesheetFromSettings()
  void refreshThemeSnippetsFromSettings()
  void refreshThemeExportStylesFromSettings()
}

export function setPreviewTheme(variant: ThemeVariant): void {
  previewTheme = normalizeThemeVariant(variant)
  refreshThemeFromSettings()
}

export function clearPreviewTheme(): void {
  if (!previewTheme) return
  previewTheme = null
  refreshThemeFromSettings()
}

export function applyInitialThemeFromSettings(): void {
  refreshThemeFromSettings()
}

export function getActiveTheme(): ThemeDefinition {
  return activeTheme
}

export function getCurrentTheme(): ThemeDefinition {
  return activeTheme
}

export function getCurrentThemeSelection(): string {
  return readThemeMode()
}

export function subscribeTheme(callback: ThemeSubscriber): () => void {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

export function subscribeThemeRuntime(): () => void {
  refreshThemeFromSettings()
  const unsubscribers = [
    subscribe('theme.active', refreshThemeFromSettings),
    subscribe('theme.customThemeJSON', refreshThemeFromSettings),
    subscribe('theme.cssFile', () => {
      void refreshThemeStylesheetFromSettings()
    }),
    subscribe('theme.cssCompatMode', () => {
      void refreshThemeStylesheetFromSettings()
    }),
    subscribe('theme.cssSnippets', () => {
      void refreshThemeSnippetsFromSettings()
    }),
    subscribe('theme.exportCssSnippets', () => {
      void refreshThemeExportStylesFromSettings()
    }),
  ]

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}

export function listRuntimeThemes(): readonly ThemeDefinition[] {
  return listThemeDefinitions()
}
