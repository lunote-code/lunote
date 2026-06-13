import { applyInitialThemeFromSettings, reloadCustomThemesFromDisk } from '../theme-runtime/themeRuntime'
import { reloadThemeExportStylesFromDisk } from '../theme-runtime/themeExportStyleRuntime'
import { reloadThemeStylesheetsFromDisk } from '../theme-runtime/themeStylesheetRuntime'
import { reloadThemeSnippetsFromDisk } from '../theme-runtime/themeSnippetRuntime'
import { logInfo, logWarn } from '../lib/lunaLogger'

/** Load custom themes / stylesheets / snippets from disk (Tauri IPC). Safe to defer after first paint. */
export async function reloadThemeAssetsFromDisk(): Promise<void> {
  await Promise.all([
    reloadCustomThemesFromDisk(),
    reloadThemeStylesheetsFromDisk(),
    reloadThemeSnippetsFromDisk(),
    reloadThemeExportStylesFromDisk(),
  ])
}

/** Refresh theme after disk assets arrive; failures are logged and do not block startup. */
export function scheduleDeferredThemeAssetsReload(): void {
  void reloadThemeAssetsFromDisk()
    .then(() => {
      applyInitialThemeFromSettings()
      logInfo('[BOOT] deferred_theme_assets ready')
    })
    .catch((error) => {
      logWarn('[BOOT] deferred_theme_assets failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
}
