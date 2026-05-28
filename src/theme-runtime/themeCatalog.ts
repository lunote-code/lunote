import type { BuiltInThemeVariant } from './themeResolver'

export type ThemeCatalogGroup = 'GitHub' | 'IDEA' | 'Dim'
export type ThemeCatalogMode = 'light' | 'dark'

export interface ThemeCatalogEntry {
  id: BuiltInThemeVariant
  name: string
  group: ThemeCatalogGroup
  mode: ThemeCatalogMode
  preview?: string
  description?: string
}

export const THEME_CATALOG: ThemeCatalogEntry[] = [
  {
    id: 'github-light',
    name: 'github-light',
    group: 'GitHub',
    mode: 'light',
    description: 'GitHub light theme variant.',
  },
  {
    id: 'github-dark',
    name: 'github-dark',
    group: 'GitHub',
    mode: 'dark',
    description: 'GitHub dark theme variant.',
  },
  {
    id: 'idea-light',
    name: 'idea-light',
    group: 'IDEA',
    mode: 'light',
    description: 'IDEA light theme variant.',
  },
  {
    id: 'idea-dark',
    name: 'idea-dark',
    group: 'IDEA',
    mode: 'dark',
    description: 'IDEA dark theme variant.',
  },
  {
    id: 'dim-light',
    name: 'dim-light',
    group: 'Dim',
    mode: 'light',
    description: 'Dim light theme variant.',
  },
  {
    id: 'dim-dark',
    name: 'dim-dark',
    group: 'Dim',
    mode: 'dark',
    description: 'Dim dark theme variant.',
  },
]

export function getThemeEntry(id: string): ThemeCatalogEntry | undefined {
  return THEME_CATALOG.find((entry) => entry.id === id)
}

export function getThemesByGroup(group: ThemeCatalogGroup): ThemeCatalogEntry[] {
  return THEME_CATALOG.filter((entry) => entry.group === group)
}

export function getThemeMode(id: string): ThemeCatalogMode | undefined {
  return getThemeEntry(id)?.mode
}
