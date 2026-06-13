import { isTauri } from '@tauri-apps/api/core'

import {
  installPluginFiles,
  listInstalledPluginsFromDisk,
  readPluginManifestFromDisk,
  uninstallPluginFromDisk,
} from '../platform/tauri/pluginService'
import {
  deleteCustomThemeJson,
  deleteThemeSnippet,
  deleteThemeStylesheet,
  readCustomThemeJson,
  saveCustomThemeJson,
  saveThemeSnippet,
  saveThemeStylesheet,
} from '../platform/tauri/themeService'
import { getSetting, setSetting } from '../settings-runtime/settingsRuntime'
import { loadThemeFromJSON } from '../theme-runtime/themeLoader'
import { reloadCustomThemesFromDisk, refreshThemeFromSettings } from '../theme-runtime/themeRuntime'
import { DEFAULT_THEME_VARIANT } from '../theme-runtime/themeResolver'
import {
  disableThemeSnippet,
  enableThemeSnippet,
  reloadThemeSnippetsFromDisk,
  removeSnippetInline,
  upsertSnippetInline,
} from '../theme-runtime/themeSnippetRuntime'
import { reloadThemeStylesheetsFromDisk } from '../theme-runtime/themeStylesheetRuntime'
import { resolvePluginCatalogUrl } from './pluginConstants'
import type {
  PluginCatalogDetail,
  PluginManifest,
  PluginPackage,
  PluginThemeDefaultEnable,
  PluginThemeSnippetContribution,
  PluginThemeStyleContribution,
  PluginThemeTokenContribution,
} from './pluginTypes'
import {
  isPluginInstalledInStore,
  removeInstalledPluginFromStore,
  upsertInstalledPluginInStore,
} from './pluginStore'

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] ?? normalized
}

function fileContentByPath(files: PluginPackage['files'], relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/')
  const hit = files.find((file) => file.path.replace(/\\/g, '/') === normalized)
  return hit?.content ?? null
}

type NormalizedThemeManifestContributions = {
  style?: PluginThemeStyleContribution[]
  snippets?: PluginThemeSnippetContribution[]
  tokens?: PluginThemeTokenContribution[]
  defaultEnable?: PluginThemeDefaultEnable
}

function readThemeManifestContributions(
  manifest: PluginManifest,
): NormalizedThemeManifestContributions | undefined {
  const current = manifest.contributes?.theme
  if (current) return current

  const legacy = manifest.theme?.contributes
  if (!legacy) return undefined

  return {
    style: legacy.style,
    snippets: legacy.snippets,
    tokens: legacy.tokens,
  }
}

function readDefaultThemeEnable(detail?: PluginCatalogDetail) {
  return detail?.contributes?.theme?.defaultEnable ?? detail?.theme?.defaultEnable
}

async function writeThemeContributions(manifest: PluginManifest, pkg: PluginPackage): Promise<void> {
  const contributes = readThemeManifestContributions(manifest)
  if (!contributes) return

  for (const style of contributes.style ?? []) {
    const content = fileContentByPath(pkg.files, style.file)
    if (!content) continue
    const fileName = basename(style.file)
    if (isTauri()) {
      await saveThemeStylesheet({ fileName, content })
    }
  }

  for (const token of contributes.tokens ?? []) {
    const content = fileContentByPath(pkg.files, token.file)
    if (!content) continue
    const fileName = basename(token.file)
    if (isTauri()) {
      await saveCustomThemeJson({ fileName, content })
    }
  }

  for (const snippet of contributes.snippets ?? []) {
    const content = fileContentByPath(pkg.files, snippet.file)
    if (!content) continue
    const fileName = basename(snippet.file)
    if (isTauri()) {
      await saveThemeSnippet({ fileName, content })
    } else {
      await upsertSnippetInline(fileName, content)
    }
  }
}

async function enableDefaultSnippets(
  manifest: PluginManifest,
  detail?: PluginCatalogDetail,
): Promise<void> {
  const snippetIds = new Set<string>()
  const manifestTheme = readThemeManifestContributions(manifest)

  for (const snippet of manifestTheme?.snippets ?? []) {
    if (snippet.defaultEnabled) snippetIds.add(basename(snippet.file))
  }

  for (const snippetId of manifestTheme?.defaultEnable?.snippets ?? []) {
    const manifestSnippet = manifestTheme?.snippets?.find((entry) => entry.id === snippetId)
    if (manifestSnippet) snippetIds.add(basename(manifestSnippet.file))
  }

  for (const snippetId of readDefaultThemeEnable(detail)?.snippets ?? []) {
    const manifestSnippet = manifestTheme?.snippets?.find((entry) => entry.id === snippetId)
    if (manifestSnippet) snippetIds.add(basename(manifestSnippet.file))
  }

  for (const fileName of snippetIds) {
    await enableThemeSnippet(fileName)
  }
}

type PluginThemeAssetNames = {
  styleFileNames: string[]
  snippetFileNames: string[]
  tokenFileNames: string[]
}

function collectThemeAssetNames(manifest: PluginManifest): PluginThemeAssetNames {
  const contributes = readThemeManifestContributions(manifest)
  return {
    styleFileNames: (contributes?.style ?? []).map((entry) => basename(entry.file)),
    snippetFileNames: (contributes?.snippets ?? []).map((entry) => basename(entry.file)),
    tokenFileNames: (contributes?.tokens ?? []).map((entry) => basename(entry.file)),
  }
}

async function readInstalledPluginManifest(pluginId: string): Promise<PluginManifest | null> {
  if (!isTauri()) return null
  try {
    const raw = await readPluginManifestFromDisk(pluginId)
    return JSON.parse(raw) as PluginManifest
  } catch (error) {
    console.warn('[plugin-install-runtime] Failed to read installed plugin manifest.', {
      pluginId,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

async function readTokenThemeIdsBeforeDelete(tokenFileNames: readonly string[]): Promise<string[]> {
  if (!isTauri() || tokenFileNames.length === 0) return []
  const ids: string[] = []
  for (const fileName of tokenFileNames) {
    try {
      const json = await readCustomThemeJson(fileName)
      const theme = loadThemeFromJSON(json, fileName)
      if (theme.id.trim()) ids.push(theme.id.trim())
    } catch (error) {
      console.warn('[plugin-install-runtime] Failed to read token theme before uninstall.', {
        fileName,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return ids
}

async function deleteThemeAssetsFromDisk(assets: PluginThemeAssetNames): Promise<void> {
  if (!isTauri()) return
  for (const fileName of assets.styleFileNames) {
    await deleteThemeStylesheet(fileName)
  }
  for (const fileName of assets.snippetFileNames) {
    await deleteThemeSnippet(fileName)
  }
  for (const fileName of assets.tokenFileNames) {
    await deleteCustomThemeJson(fileName)
  }
}

async function clearThemeSettingsAfterPluginRemoval(
  assets: PluginThemeAssetNames,
  tokenThemeIds: readonly string[],
): Promise<void> {
  const cssFile = getSetting('theme.cssFile')
  if (typeof cssFile === 'string' && assets.styleFileNames.includes(cssFile.trim())) {
    await setSetting('theme.cssFile', '')
  }

  const customThemeFile = getSetting('theme.customThemeFile')
  if (typeof customThemeFile === 'string' && customThemeFile.trim()) {
    const customBasename = basename(customThemeFile)
    if (assets.tokenFileNames.includes(customBasename)) {
      await setSetting('theme.customThemeFile', '')
      await setSetting('theme.customThemeJSON', '')
    }
  }

  for (const fileName of assets.snippetFileNames) {
    await disableThemeSnippet(fileName)
    await removeSnippetInline(fileName)
  }

  const activeTheme = getSetting('theme.active')
  if (typeof activeTheme === 'string' && tokenThemeIds.includes(activeTheme.trim())) {
    await setSetting('theme.active', DEFAULT_THEME_VARIANT)
  }
}

async function removeThemeContributions(manifest: PluginManifest): Promise<void> {
  const assets = collectThemeAssetNames(manifest)
  if (
    assets.styleFileNames.length === 0 &&
    assets.snippetFileNames.length === 0 &&
    assets.tokenFileNames.length === 0
  ) {
    return
  }

  const tokenThemeIds = await readTokenThemeIdsBeforeDelete(assets.tokenFileNames)
  await deleteThemeAssetsFromDisk(assets)
  await clearThemeSettingsAfterPluginRemoval(assets, tokenThemeIds)
}

export async function fetchPluginPackage(packageUrl: string): Promise<PluginPackage> {
  const resolvedUrl = resolvePluginCatalogUrl(packageUrl)
  try {
    const response = await fetch(resolvedUrl, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Plugin package request failed (${response.status}) for ${resolvedUrl}`)
    }
    return (await response.json()) as PluginPackage
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Plugin package request failed for ${resolvedUrl}: ${message}`, { cause })
  }
}

export async function installPluginPackage(
  pkg: PluginPackage,
  detail?: PluginCatalogDetail,
): Promise<void> {
  if (isTauri()) {
    await installPluginFiles(pkg.id, pkg.files)
  }

  await writeThemeContributions(pkg.manifest, pkg)

  if (isTauri()) {
    await Promise.all([
      reloadThemeStylesheetsFromDisk(),
      reloadThemeSnippetsFromDisk(),
      reloadCustomThemesFromDisk(),
    ])
  }

  await enableDefaultSnippets(pkg.manifest, detail)

  if (isTauri()) {
    await reloadThemeSnippetsFromDisk()
  }

  upsertInstalledPluginInStore({
    id: pkg.manifest.id,
    name: pkg.manifest.name,
    version: pkg.manifest.version,
    installedAt: new Date().toISOString(),
  })
}

export async function installPluginFromCatalogDetail(
  detail: PluginCatalogDetail,
): Promise<void> {
  const version = detail.versions[0]
  if (!version?.packageUrl) {
    throw new Error('Plugin package URL is missing')
  }
  const pkg = await fetchPluginPackage(version.packageUrl)
  await installPluginPackage(pkg, detail)
}

export function isPluginInstalled(pluginId: string): boolean {
  if (isPluginInstalledInStore(pluginId)) return true
  return false
}

export async function refreshInstalledPluginsFromDisk(): Promise<void> {
  if (!isTauri()) return
  const records = await listInstalledPluginsFromDisk()
  for (const record of records) {
    upsertInstalledPluginInStore(record)
  }
}

export async function uninstallPlugin(pluginId: string): Promise<void> {
  if (isTauri()) {
    const manifest = await readInstalledPluginManifest(pluginId)
    if (manifest) {
      await removeThemeContributions(manifest)
    }
    await uninstallPluginFromDisk(pluginId)
    await Promise.all([
      reloadThemeStylesheetsFromDisk(),
      reloadThemeSnippetsFromDisk(),
      reloadCustomThemesFromDisk(),
    ])
    refreshThemeFromSettings()
  }
  removeInstalledPluginFromStore(pluginId)
}
