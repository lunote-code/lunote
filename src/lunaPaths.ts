import { invoke } from '@tauri-apps/api/core'

export type LunaPaths = {
  root: string
  config: string
  theme: string
  workspace: string
  cache: string
  logs: string
  state: string
}

let cachedPaths: LunaPaths | null = null

export async function ensureLunaDirs(): Promise<LunaPaths> {
  cachedPaths = await invoke<LunaPaths>('ensure_luna_dirs')
  return cachedPaths
}

export async function getLunaRoot(): Promise<string> {
  return (cachedPaths ?? await ensureLunaDirs()).root
}

export async function getConfigPath(): Promise<string> {
  return (cachedPaths ?? await ensureLunaDirs()).config
}

export async function getWorkspacePath(): Promise<string> {
  return (cachedPaths ?? await ensureLunaDirs()).workspace
}

export async function getThemePath(): Promise<string> {
  return (cachedPaths ?? await ensureLunaDirs()).theme
}

export async function getThemeStylePath(): Promise<string> {
  const root = await getThemePath()
  return `${root}/style`
}

export async function getThemeSnippetsPath(): Promise<string> {
  const root = await getThemePath()
  return `${root}/snippets`
}

export async function getThemeExportPath(): Promise<string> {
  const root = await getThemePath()
  return `${root}/export`
}

export async function getThemeTokensPath(): Promise<string> {
  const root = await getThemePath()
  return `${root}/tokens`
}

export async function getCachePath(): Promise<string> {
  return (cachedPaths ?? await ensureLunaDirs()).cache
}

export async function getLogsPath(): Promise<string> {
  return (cachedPaths ?? await ensureLunaDirs()).logs
}

export async function getStatePath(): Promise<string> {
  return (cachedPaths ?? await ensureLunaDirs()).state
}
