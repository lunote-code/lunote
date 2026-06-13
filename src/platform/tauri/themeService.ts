import { invoke } from '@tauri-apps/api/core'

type SaveCustomThemePayload = {
  fileName: string
  content: string
}

export type ThemeStyleEntry = {
  name: string
}

export type CustomThemeEntry = {
  name: string
}

export async function ensureThemeDirectory(): Promise<string> {
  return invoke<string>('ensure_theme_directory')
}

export async function ensureThemeSnippetsDirectory(): Promise<string> {
  return invoke<string>('ensure_theme_snippets_directory')
}

export async function ensureThemeExportDirectory(): Promise<string> {
  return invoke<string>('ensure_theme_export_directory')
}

export async function revealThemeDirectory(): Promise<void> {
  await invoke('reveal_theme_directory')
}

export async function revealThemeSnippetsDirectory(): Promise<void> {
  await invoke('reveal_theme_snippets_directory')
}

export async function revealThemeExportDirectory(): Promise<void> {
  await invoke('reveal_theme_export_directory')
}

export async function listThemeStylesheets(): Promise<ThemeStyleEntry[]> {
  return invoke<ThemeStyleEntry[]>('list_theme_stylesheets')
}

export async function listThemeSnippets(): Promise<ThemeStyleEntry[]> {
  return invoke<ThemeStyleEntry[]>('list_theme_snippets')
}

export async function listThemeExportStyles(): Promise<ThemeStyleEntry[]> {
  return invoke<ThemeStyleEntry[]>('list_theme_export_styles')
}

export async function readThemeStylesheet(name: string): Promise<string> {
  return invoke<string>('read_theme_stylesheet', { name })
}

export async function readThemeSnippet(name: string): Promise<string> {
  return invoke<string>('read_theme_snippet', { name })
}

export async function readThemeExportStyle(name: string): Promise<string> {
  return invoke<string>('read_theme_export_style', { name })
}

export async function saveCustomThemeJson(payload: SaveCustomThemePayload): Promise<string> {
  return invoke<string>('save_custom_theme_json', { payload })
}

export async function saveThemeStylesheet(payload: SaveCustomThemePayload): Promise<string> {
  return invoke<string>('save_theme_stylesheet', { payload })
}

export async function saveThemeSnippet(payload: SaveCustomThemePayload): Promise<string> {
  return invoke<string>('save_theme_snippet', { payload })
}

export async function saveThemeExportStyle(payload: SaveCustomThemePayload): Promise<string> {
  return invoke<string>('save_theme_export_style', { payload })
}

export async function revealCustomThemeDirectory(): Promise<void> {
  await invoke('reveal_custom_theme_directory')
}

export async function listCustomThemeFiles(): Promise<CustomThemeEntry[]> {
  return invoke<CustomThemeEntry[]>('list_custom_theme_files')
}

export async function readCustomThemeJson(name: string): Promise<string> {
  return invoke<string>('read_custom_theme_json', { name })
}

export async function deleteThemeStylesheet(name: string): Promise<void> {
  await invoke('delete_theme_stylesheet', { name })
}

export async function deleteThemeSnippet(name: string): Promise<void> {
  await invoke('delete_theme_snippet', { name })
}

export async function deleteCustomThemeJson(name: string): Promise<void> {
  await invoke('delete_custom_theme_json', { name })
}
