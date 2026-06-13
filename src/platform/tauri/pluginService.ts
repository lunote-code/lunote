import { invoke } from '@tauri-apps/api/core'

import type { InstalledPluginRecord, PluginPackageFile } from '../../plugins/pluginTypes'

export async function installPluginFiles(
  pluginId: string,
  files: readonly PluginPackageFile[],
): Promise<void> {
  await invoke('install_plugin_files', {
    pluginId,
    files: files.map((file) => ({ path: file.path, content: file.content })),
  })
}

export async function listInstalledPluginsFromDisk(): Promise<InstalledPluginRecord[]> {
  return invoke<InstalledPluginRecord[]>('list_installed_plugins')
}

export async function readPluginManifestFromDisk(pluginId: string): Promise<string> {
  return invoke<string>('read_plugin_manifest', { pluginId })
}

export async function uninstallPluginFromDisk(pluginId: string): Promise<void> {
  await invoke('uninstall_plugin', { pluginId })
}
