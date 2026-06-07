export type SettingsSectionId =
  | 'general'
  | 'appearance'
  | 'export'
  | 'import'
  | 'templates'
  | 'editor'
  | 'language'

export type SettingsValue = string | boolean | number | null | undefined

export type SettingsOption = {
  label?: string
  labelKey?: string
  value: string
  group?: string
  groupKey?: string
  description?: string
  descriptionKey?: string
}

export type SettingsVisibilityRule = {
  path: string
  equals: SettingsValue
}

export type SettingsAction = {
  id: string
  labelKey: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

export interface BaseSetting {
  id: string
  path: string
  labelKey: string
  descriptionKey?: string
  /** When true, description is shown in a ? popover instead of under the label. */
  descriptionAsHelp?: boolean
  helpTitleKey?: string
  section: SettingsSectionId
  visibleWhen?: SettingsVisibilityRule
}

export interface SelectSetting extends BaseSetting {
  type: 'select'
  options: readonly SettingsOption[]
  default: string
}

export interface InputSetting extends BaseSetting {
  type: 'input'
  placeholderKey?: string
  default?: string
  helpTextKey?: string
  action?: SettingsAction
  /** Numeric input (such as document font size)*/
  numeric?: boolean
  min?: number
  max?: number
}

export interface SwitchSetting extends BaseSetting {
  type: 'switch'
  default: boolean
}

export interface TextareaSetting extends BaseSetting {
  type: 'textarea'
  placeholderKey?: string
  default?: string
}

export interface FileSetting extends BaseSetting {
  type: 'file'
  accept?: string
  default?: string
  action?: SettingsAction
}

export interface GroupSetting {
  type: 'group'
  id: string
  section: SettingsSectionId
  titleKey: string
  descriptionKey?: string
  descriptionAsHelp?: boolean
  hideHeader?: boolean
  items: readonly string[]
}

export type LeafSetting = SelectSetting | InputSetting | SwitchSetting | TextareaSetting | FileSetting
export type SettingsItem = LeafSetting | GroupSetting

export type SettingsSectionSchema = {
  section: SettingsSectionId
  groups: readonly GroupSetting[]
  items: readonly LeafSetting[]
}
