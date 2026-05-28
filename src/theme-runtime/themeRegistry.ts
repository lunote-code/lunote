import type { ThemeDefinition } from './themeTypes'
import { BUILT_IN_THEMES } from './themeTokens'
import { THEME_CATALOG } from './themeCatalog'

export type ThemeRegistryEntry = {
  id: string
  label: string
  type: 'built-in' | 'custom'
  group: string
  description?: string
}

const registry = new Map<string, ThemeDefinition>()

for (const theme of BUILT_IN_THEMES) {
  registry.set(theme.id, theme)
}

export function registerTheme(theme: ThemeDefinition): void {
  registry.set(theme.id, theme)
}

export function unregisterTheme(id: string): void {
  const theme = registry.get(id)
  if (!theme || theme.builtIn) return
  registry.delete(id)
}

export function getTheme(id: string): ThemeDefinition | undefined {
  return registry.get(id)
}

export function listThemeDefinitions(): readonly ThemeDefinition[] {
  return [...registry.values()]
}

export function listThemes(): readonly ThemeRegistryEntry[] {
  const builtInThemes = THEME_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.name,
    type: 'built-in' as const,
    group: entry.group,
    description: entry.description,
  }))
  const customThemes = [...registry.values()]
    .filter((theme) => theme.builtIn !== true)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((theme) => ({
      id: theme.id,
      label: theme.name,
      type: 'custom' as const,
      group: 'Custom',
      description: 'sourceName' in theme && typeof theme.sourceName === 'string'
        ? theme.sourceName
        : theme.id,
    }))
  return [...builtInThemes, ...customThemes]
}
