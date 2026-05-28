import type { SettingsValue } from './settingsTypes'
import type { TranslateFn } from '../i18n'
import { readLocaleMeta } from '../i18n/localeAudit'
import { isUiLocaleId, UI_LOCALE_IDS, type UiLocaleId } from '../i18n/localeRegistry'
import { getSetting, setSetting, subscribe } from './settingsRuntime'
import type { LeafSetting } from './settingsTypes'
import type { SettingsSelectOption } from '../components/settings'
import { clearPreviewTheme, getCurrentThemeSelection, setPreviewTheme } from '../theme-runtime/themeRuntime'
import { listThemes } from '../theme-runtime/themeRegistry'
import { normalizeThemeVariant } from '../theme-runtime/themeResolver'
import { listAvailableThemeStylesheets } from '../theme-runtime/themeStylesheetRuntime'

export type SettingsActionHandler = (actionId: string, path: string) => void | Promise<void>

export type SettingsBinding = {
  value: SettingsValue
  setValue: (value: SettingsValue) => Promise<void>
  subscribe: (callback: () => void) => () => void
}

export function bind(path: string): SettingsBinding {
  return {
    value: getSetting(path),
    setValue: (value) => setSetting(path, value),
    subscribe: (callback) => subscribe(path, callback),
  }
}

export function bindValue(path: string): SettingsValue {
  return getSetting(path)
}

export function onChange(path: string, value: SettingsValue): Promise<void> {
  return setSetting(path, value)
}

export function activeValueForSetting(path: string): string | undefined {
  if (path === 'theme.active') return getCurrentThemeSelection()
  return undefined
}

export function previewValueForSetting(path: string, value: string): void {
  if (path === 'theme.active') setPreviewTheme(normalizeThemeVariant(value))
}

export function clearPreviewForSetting(path: string): void {
  if (path === 'theme.active') clearPreviewTheme()
}

export function getCurrentThemeStatusText(): string {
  return String(getCurrentThemeSelection())
}

function labelForLocaleValue(value: string, t: TranslateFn): string {
  if (value === 'system') return t('settings.language.system')
  if (!isUiLocaleId(value)) return value
  return readLocaleMeta(value as UiLocaleId).nativeName
}

export function resolveSettingOptions(
  item: LeafSetting,
  t: TranslateFn,
  effectiveLocale: UiLocaleId,
): readonly SettingsSelectOption<string>[] | undefined {
  if (item.path === 'theme.active') {
    return listThemes().map((entry) => ({
      value: entry.id,
      label: entry.label,
      group: entry.group,
      description: entry.description ?? entry.id,
    }))
  }

  if (item.path === 'theme.cssFile') {
    const currentRawValue = bindValue(item.path)
    const currentValue = typeof currentRawValue === 'string' ? currentRawValue.trim() : ''
    const options: SettingsSelectOption<string>[] = [
      {
        value: '',
        label: t('settings.theme.cssFile.none'),
        description: t('settings.theme.cssFile.noneDescription'),
      },
      ...listAvailableThemeStylesheets().map((entry) => ({
        value: entry.name,
        label: entry.name,
        group: 'Theme/*.css',
        description: entry.name,
      })),
    ]
    if (currentValue && !options.some((option) => option.value === currentValue)) {
      options.push({
        value: currentValue,
        label: currentValue,
        group: 'Missing',
        description: t('settings.theme.cssFile.missingDescription'),
      })
    }
    return options
  }

  if (item.path !== 'general.language') return undefined

  return (['system', ...UI_LOCALE_IDS] as const).map((value) => ({
    value,
    label: labelForLocaleValue(value, t),
    description: value === 'system' ? `${t('settings.language.system')} -> ${labelForLocaleValue(effectiveLocale, t)}` : undefined,
  }))
}
