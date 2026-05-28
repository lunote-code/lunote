import type { UiLocaleId } from '../i18n/resolveLocale'
import type { ThemeDefinition } from '../theme-runtime/themeTypes'
import { getCurrentTheme } from '../theme-runtime/themeRuntime'
import {
  getActiveThemeStylesheetCompat,
  getActiveThemeStylesheetCss,
  getActiveThemeStylesheetName,
} from '../theme-runtime/themeStylesheetRuntime'
import {
  getActiveThemeExportStyleCss,
  getActiveThemeExportStyleNames,
} from '../theme-runtime/themeExportStyleRuntime'
import { getActiveThemeSnippetCss, getActiveThemeSnippetNames } from '../theme-runtime/themeSnippetRuntime'

export type ExportThemeSnapshot = {
  dark: boolean
  localeId?: UiLocaleId
  theme: ThemeDefinition
  stylesheetName: string
  stylesheetCss: string
  stylesheetCompat: 'none' | 'obsidian' | 'native'
  snippetNames: readonly string[]
  snippetCss: string
  exportStyleNames: readonly string[]
  exportStyleCss: string
}

export function createExportThemeSnapshot(opts: {
  dark: boolean
  localeId?: UiLocaleId
}): ExportThemeSnapshot {
  return {
    dark: opts.dark,
    localeId: opts.localeId,
    theme: getCurrentTheme(),
    stylesheetName: getActiveThemeStylesheetName(),
    stylesheetCss: getActiveThemeStylesheetCss(),
    stylesheetCompat: getActiveThemeStylesheetCompat(),
    snippetNames: getActiveThemeSnippetNames(),
    snippetCss: getActiveThemeSnippetCss(),
    exportStyleNames: getActiveThemeExportStyleNames(),
    exportStyleCss: getActiveThemeExportStyleCss(),
  }
}
