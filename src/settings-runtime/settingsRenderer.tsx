import { useMemo, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import {
  SettingsButton,
  SettingsDescription,
  SettingsFileInput,
  SettingsInput,
  SettingsPage,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
  SettingsTextArea,
  type SettingsSelectOption,
} from '../components/settings'
import { getSection, getSetting as getSchemaSetting } from './settingsRegistry'
import {
  activeValueForSetting,
  bindValue,
  clearPreviewForSetting,
  onChange,
  previewValueForSetting,
  type SettingsActionHandler,
} from './settingsBindings'
import { getSettingsRuntimeVersion, subscribeAll } from './settingsRuntime'
import { translateSettingDescription, translateSettingLabel, translateSettingOptions } from './settingsI18n'
import type { GroupSetting, LeafSetting, SettingsSectionId, SettingsValue } from './settingsTypes'
import { getCurrentTheme, subscribeTheme } from '../theme-runtime/themeRuntime'

type SettingsRendererProps = {
  section: SettingsSectionId
  title?: string
  resolveOptions?: (item: LeafSetting) => readonly SettingsSelectOption<string>[] | undefined
  renderBeforeSection?: (group: GroupSetting) => React.ReactNode
  renderAfterSection?: (group: GroupSetting) => React.ReactNode
  onAction?: SettingsActionHandler
  onFile?: (actionId: string, path: string, file: File) => void | Promise<void>
}

function useSettingsVersion(): number {
  return useSyncExternalStore(
    subscribeAll,
    getSettingsRuntimeVersion,
    () => 0,
  )
}

function useThemeDisplayVersion(): string {
  return useSyncExternalStore(
    (callback) => subscribeTheme(() => callback()),
    () => getCurrentTheme().id,
    () => 'dark',
  )
}

function isVisible(item: LeafSetting): boolean {
  if (!item.visibleWhen) return true
  return Object.is(bindValue(item.visibleWhen.path), item.visibleWhen.equals)
}

function toStringValue(value: SettingsValue): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function toBooleanValue(value: SettingsValue): boolean {
  return value === true
}

function toFileDisplayValue(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  const normalized = trimmed.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) ?? trimmed
}

function renderSetting(
  item: LeafSetting,
  t: ReturnType<typeof useI18n>['t'],
  resolveOptions?: SettingsRendererProps['resolveOptions'],
  onAction?: SettingsActionHandler,
  onFile?: SettingsRendererProps['onFile'],
) {
  if (!isVisible(item)) return null

  const value = bindValue(item.path)
  const label = translateSettingLabel(item, t)
  const description = translateSettingDescription(item, t)

  switch (item.type) {
    case 'select': {
      const options = resolveOptions?.(item) ?? translateSettingOptions(item.options, t)
      return (
        <SettingsRow key={item.path} label={label} description={description}>
          <SettingsSelect
            value={toStringValue(value ?? item.default)}
            activeValue={activeValueForSetting(item.path)}
            options={options}
            ariaLabel={label}
            onPreviewValue={(next) => previewValueForSetting(item.path, next)}
            onClearPreview={() => clearPreviewForSetting(item.path)}
            onValueChange={(next) => void onChange(item.path, next)}
          />
        </SettingsRow>
      )
    }
    case 'input':
      return (
        <SettingsRow key={item.path} label={label} description={description}>
          <div className={item.action ? 'settings-path-control' : 'settings-stack'}>
            <SettingsInput
              type={item.numeric ? 'number' : undefined}
              inputMode={item.numeric ? 'numeric' : undefined}
              min={item.numeric ? item.min : undefined}
              max={item.numeric ? item.max : undefined}
              value={toStringValue(value ?? item.default)}
              placeholder={item.placeholderKey ? t(item.placeholderKey) : undefined}
              onChange={(event) => {
                const raw = event.target.value
                if (!item.numeric) {
                  void onChange(item.path, raw)
                  return
                }
                if (raw.trim() === '') {
                  void onChange(item.path, '')
                  return
                }
                const n = Number.parseFloat(raw)
                if (!Number.isFinite(n)) return
                void onChange(item.path, String(n))
              }}
              onBlur={
                item.numeric
                  ? (event) => {
                      const raw = event.target.value.trim()
                      if (raw === '') {
                        void onChange(item.path, '')
                        return
                      }
                      const n = Number.parseFloat(raw)
                      if (!Number.isFinite(n)) {
                        void onChange(item.path, '')
                        return
                      }
                      const clamped = Math.max(
                        item.min ?? Number.NEGATIVE_INFINITY,
                        Math.min(item.max ?? Number.POSITIVE_INFINITY, Math.round(n)),
                      )
                      if (String(clamped) !== raw) void onChange(item.path, String(clamped))
                    }
                  : undefined
              }
            />
            {item.action ? (
              <SettingsButton
                type="button"
                variant={item.action.variant ?? 'secondary'}
                onClick={() => void onAction?.(item.action!.id, item.path)}
              >
                {t(item.action.labelKey)}
              </SettingsButton>
            ) : null}
            {item.helpTextKey ? <SettingsDescription>{t(item.helpTextKey)}</SettingsDescription> : null}
          </div>
        </SettingsRow>
      )
    case 'switch':
      return (
        <SettingsRow key={item.path} label={label} description={description}>
          <SettingsSwitch
            checked={toBooleanValue(value ?? item.default)}
            ariaLabel={label}
            onCheckedChange={(next) => void onChange(item.path, next)}
          />
        </SettingsRow>
      )
    case 'textarea':
      return (
        <SettingsRow key={item.path} label={label} description={description}>
          <SettingsTextArea
            value={toStringValue(value ?? item.default)}
            placeholder={item.placeholderKey ? t(item.placeholderKey) : undefined}
            onChange={(event) => void onChange(item.path, event.target.value)}
          />
        </SettingsRow>
      )
    case 'file':
      {
        const stringValue = toStringValue(value ?? item.default).trim()
        const fileDisplayValue =
          item.path === 'theme.customThemeFile'
            ? toFileDisplayValue(stringValue)
            : stringValue
      return (
        <SettingsRow key={item.path} label={label} description={description}>
          <div className="settings-stack">
            <SettingsFileInput
              value={fileDisplayValue}
              accept={item.accept}
              buttonLabel={item.action ? t(item.action.labelKey) : t('settings.file.choose')}
              emptyLabel={t('settings.file.empty')}
              dropHint={t('settings.file.dropHint')}
              onFile={(file) => {
                if (item.action) {
                  void onFile?.(item.action.id, item.path, file)
                }
              }}
            />
            {item.path === 'theme.customThemeFile' && stringValue ? (
              <div className="settings-file-dropzone settings-file-dropzone-static">
                <div className="settings-file-copy settings-file-copy-wrap">
                  <strong>{stringValue}</strong>
                  <span>{t('settings.theme.customThemeFile.savedPath')}</span>
                </div>
                <div className="settings-file-actions">
                  <SettingsButton
                    type="button"
                    variant="secondary"
                    onClick={() => void onAction?.('theme.openCustomThemeFolder', item.path)}
                  >
                    {t('settings.theme.customThemeFile.openFolder')}
                  </SettingsButton>
                </div>
              </div>
            ) : null}
          </div>
        </SettingsRow>
      )
      }
    default:
      return null
  }
}

function renderGroup(
  group: GroupSetting,
  t: ReturnType<typeof useI18n>['t'],
  resolveOptions: SettingsRendererProps['resolveOptions'],
  renderBeforeSection: SettingsRendererProps['renderBeforeSection'],
  renderAfterSection: SettingsRendererProps['renderAfterSection'],
  onAction: SettingsRendererProps['onAction'],
  onFile: SettingsRendererProps['onFile'],
) {
  const renderedItems = group.items
    .map((path) => {
      const item = getSchemaSetting(path)
      if (!item) return null
      return renderSetting(item, t, resolveOptions, onAction, onFile)
    })
    .filter(Boolean)

  return (
    <SettingsSection key={group.id} title={t(group.titleKey)} description={group.descriptionKey ? t(group.descriptionKey) : undefined}>
      {renderBeforeSection?.(group)}
      {renderedItems}
      {renderAfterSection?.(group)}
    </SettingsSection>
  )
}

export function SettingsRenderer({
  section,
  title,
  resolveOptions,
  renderBeforeSection,
  renderAfterSection,
  onAction,
  onFile,
}: SettingsRendererProps) {
  useSettingsVersion()
  useThemeDisplayVersion()
  const { t } = useI18n()
  const schema = useMemo(() => getSection(section), [section])

  return (
    <SettingsPage title={title}>
      {schema.groups.map((group) =>
        renderGroup(group, t, resolveOptions, renderBeforeSection, renderAfterSection, onAction, onFile),
      )}
    </SettingsPage>
  )
}
