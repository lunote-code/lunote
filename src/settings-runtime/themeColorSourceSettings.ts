import { getAppSettingsSnapshot } from '../settings/appSettingsStore'
import {
  isBuiltinThemeColorsActive,
  isExternalThemeCssActive,
  type ThemeColorSourceSettings,
} from '../theme-runtime/themeColorSource'

export const BUILTIN_THEME_DISABLED_SENTINEL = '__builtin_disabled__'
export const EXTERNAL_THEME_DISABLED_SENTINEL = '__external_disabled__'

export function readThemeColorSourceSettings(): ThemeColorSourceSettings {
  return getAppSettingsSnapshot().appearance?.theme ?? {}
}

export function isExternalThemeCssActiveFromSettings(): boolean {
  return isExternalThemeCssActive(readThemeColorSourceSettings())
}

export function isBuiltinThemeColorsActiveFromSettings(): boolean {
  return isBuiltinThemeColorsActive(readThemeColorSourceSettings())
}

export function isThemeColorSourceSentinelValue(value: string): boolean {
  return value === BUILTIN_THEME_DISABLED_SENTINEL || value === EXTERNAL_THEME_DISABLED_SENTINEL
}

export function displayValueForThemeColorSourceSetting(path: string, storedValue: string): string {
  const trimmed = storedValue.trim()
  if (path === 'theme.active' && isExternalThemeCssActiveFromSettings()) {
    return BUILTIN_THEME_DISABLED_SENTINEL
  }
  if (path === 'theme.cssFile' && isBuiltinThemeColorsActiveFromSettings() && !trimmed) {
    return EXTERNAL_THEME_DISABLED_SENTINEL
  }
  return storedValue
}

const EXTERNAL_THEME_SETTING_PATHS = new Set(['theme.cssFile', 'theme.cssImportFile'])
const BUILTIN_THEME_SETTING_PATHS = new Set(['theme.active', 'theme.customThemeFile'])

export function isExternalThemeSettingPath(path: string): boolean {
  return EXTERNAL_THEME_SETTING_PATHS.has(path)
}

export function isBuiltinThemeSettingPath(path: string): boolean {
  return BUILTIN_THEME_SETTING_PATHS.has(path)
}
