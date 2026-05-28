import type { TranslateFn } from '../i18n'
import type { LeafSetting, SettingsOption } from './settingsTypes'
import type { SettingsSelectOption } from '../components/settings'

export function translateSettingLabel(item: LeafSetting, t: TranslateFn): string {
  return t(item.labelKey)
}

export function translateSettingDescription(item: LeafSetting, t: TranslateFn): string | undefined {
  return item.descriptionKey ? t(item.descriptionKey) : undefined
}

export function translateSettingOptions(
  options: readonly SettingsOption[],
  t: TranslateFn,
): readonly SettingsSelectOption<string>[] {
  return options.map((option) => ({
    value: option.value,
    label: option.label ?? (option.labelKey ? t(option.labelKey) : option.value),
    group: option.group ?? (option.groupKey ? t(option.groupKey) : undefined),
    description: option.description ?? (option.descriptionKey ? t(option.descriptionKey) : undefined),
  }))
}
