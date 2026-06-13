import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import {
  SettingsButton,
  SettingsDescription,
  SettingsFileInput,
  SettingsHelpPopover,
  SettingsInlineHelp,
  SettingsInput,
  SettingsLabelWithHelp,
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
  title?: ReactNode
  description?: ReactNode
  toolbar?: ReactNode
  className?: string
  panelId?: string
  highlightQuery?: string
  visibleGroupIds?: readonly string[]
  hideGroupHeaders?: boolean
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

const FILE_FIELD_MESSAGE_KEYS: Record<string, { empty: string; dropHint: string }> = {
  'theme.cssImportFile': {
    empty: 'settings.theme.cssImportFile.empty',
    dropHint: 'settings.theme.cssImportFile.dropHint',
  },
  'theme.cssSnippetImport': {
    empty: 'settings.theme.cssSnippetImport.empty',
    dropHint: 'settings.theme.cssSnippetImport.dropHint',
  },
  'theme.exportCssImport': {
    empty: 'settings.theme.exportCssImport.empty',
    dropHint: 'settings.theme.exportCssImport.dropHint',
  },
}

function fileFieldMessageKeys(path: string): { empty: string; dropHint: string } {
  return FILE_FIELD_MESSAGE_KEYS[path] ?? {
    empty: 'settings.file.empty',
    dropHint: 'settings.file.dropHint',
  }
}

function renderSettingLabel(
  item: LeafSetting,
  label: string,
  description: string | undefined,
  t: ReturnType<typeof useI18n>['t'],
): { label: ReactNode; description?: string } {
  if (description && item.descriptionAsHelp) {
    const helpTitle = item.helpTitleKey ? t(item.helpTitleKey) : label
    const extraHelp = item.type === 'input' && item.helpTextKey ? t(item.helpTextKey) : undefined
    const helpBody = extraHelp ? `${description}\n${extraHelp}` : description
    return {
      label: (
        <SettingsLabelWithHelp
          label={label}
          help={<SettingsHelpPopover title={helpTitle} body={helpBody} />}
        />
      ),
    }
  }
  return { label, description }
}

function settingMatchesQuery(
  label: string,
  description: string | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return `${label} ${description ?? ''}`.toLowerCase().includes(q)
}

function rowHighlightProps(
  item: LeafSetting,
  labelText: string,
  descriptionText: string | undefined,
  highlightQuery?: string,
) {
  const matched = settingMatchesQuery(labelText, descriptionText, highlightQuery ?? '')
  return {
    className: matched ? 'is-search-match' : undefined,
    dataSettingId: item.path,
  }
}

function renderSetting(
  item: LeafSetting,
  t: ReturnType<typeof useI18n>['t'],
  resolveOptions?: SettingsRendererProps['resolveOptions'],
  onAction?: SettingsActionHandler,
  onFile?: SettingsRendererProps['onFile'],
  highlightQuery?: string,
) {
  if (!isVisible(item)) return null

  const value = bindValue(item.path)
  const labelText = translateSettingLabel(item, t)
  const descriptionText = translateSettingDescription(item, t)
  const { label, description } = renderSettingLabel(item, labelText, descriptionText, t)
  const rowProps = rowHighlightProps(item, labelText, descriptionText, highlightQuery)

  switch (item.type) {
    case 'select': {
      const options = resolveOptions?.(item) ?? translateSettingOptions(item.options, t)
      return (
        <SettingsRow key={item.path} label={label} description={description} {...rowProps}>
          <SettingsSelect
            value={toStringValue(value ?? item.default)}
            activeValue={activeValueForSetting(item.path)}
            options={options}
            ariaLabel={labelText}
            onPreviewValue={(next) => previewValueForSetting(item.path, next)}
            onClearPreview={() => clearPreviewForSetting(item.path)}
            onValueChange={(next) => onChange(item.path, next)}
          />
        </SettingsRow>
      )
    }
    case 'input':
      return (
        <SettingsRow key={item.path} label={label} description={description} {...rowProps}>
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
            {item.helpTextKey && !item.descriptionAsHelp ? (
              <SettingsDescription>{t(item.helpTextKey)}</SettingsDescription>
            ) : null}
          </div>
        </SettingsRow>
      )
    case 'switch':
      return (
        <SettingsRow key={item.path} label={label} description={description} {...rowProps}>
          <SettingsSwitch
            checked={toBooleanValue(value ?? item.default)}
            ariaLabel={labelText}
            onCheckedChange={(next) => void onChange(item.path, next)}
          />
        </SettingsRow>
      )
    case 'textarea':
      return (
        <SettingsRow key={item.path} label={label} description={description} {...rowProps}>
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
          item.path === 'theme.customThemeFile' ||
          item.path === 'theme.cssImportFile' ||
          item.path === 'theme.cssSnippetImport' ||
          item.path === 'theme.exportCssImport'
            ? toFileDisplayValue(stringValue)
            : stringValue
        const fileMessages = fileFieldMessageKeys(item.path)
      return (
        <SettingsRow key={item.path} label={label} description={description} {...rowProps}>
          <div className="settings-stack">
            <SettingsFileInput
              value={fileDisplayValue}
              accept={item.accept}
              buttonLabel={item.action ? t(item.action.labelKey) : t('settings.file.choose')}
              emptyLabel={t(fileMessages.empty)}
              dropHint={t(fileMessages.dropHint)}
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
            {(item.path === 'theme.cssImportFile' ||
              item.path === 'theme.cssSnippetImport' ||
              item.path === 'theme.exportCssImport') &&
            stringValue ? (
              <div className="settings-file-dropzone settings-file-dropzone-static">
                <div className="settings-file-copy settings-file-copy-wrap">
                  <strong>{fileDisplayValue}</strong>
                  <span>{t('settings.theme.customThemeFile.savedPath')}</span>
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

function renderGroupTitle(group: GroupSetting, t: ReturnType<typeof useI18n>['t']): ReactNode {
  const title = t(group.titleKey)
  if (group.descriptionKey && group.descriptionAsHelp) {
    return (
      <SettingsInlineHelp
        className="settings-section-title-with-help"
        label={title}
        help={<SettingsHelpPopover title={title} body={t(group.descriptionKey)} />}
      />
    )
  }
  return title
}

function renderGroup(
  group: GroupSetting,
  t: ReturnType<typeof useI18n>['t'],
  resolveOptions: SettingsRendererProps['resolveOptions'],
  renderBeforeSection: SettingsRendererProps['renderBeforeSection'],
  renderAfterSection: SettingsRendererProps['renderAfterSection'],
  onAction: SettingsRendererProps['onAction'],
  onFile: SettingsRendererProps['onFile'],
  highlightQuery?: string,
  hideGroupHeaders?: boolean,
  panelId?: string,
) {
  const renderedItems = group.items
    .map((path) => {
      const item = getSchemaSetting(path)
      if (!item) return null
      return renderSetting(item, t, resolveOptions, onAction, onFile, highlightQuery)
    })
    .filter(Boolean)

  if (group.hideHeader || hideGroupHeaders) {
    return (
      <div
        key={group.id}
        id={panelId}
        role={panelId ? 'region' : undefined}
        aria-labelledby={panelId ? panelId.replace('-panel-', '-tab-') : undefined}
        className="settings-section settings-section-bare"
      >
        {renderBeforeSection?.(group)}
        {renderedItems}
        {renderAfterSection?.(group)}
      </div>
    )
  }

  return (
    <SettingsSection
      key={group.id}
      id={panelId}
      role={panelId ? 'region' : undefined}
      aria-labelledby={panelId ? panelId.replace('-panel-', '-tab-') : undefined}
      title={renderGroupTitle(group, t)}
      description={
        group.descriptionKey && !group.descriptionAsHelp ? t(group.descriptionKey) : undefined
      }
    >
      {renderBeforeSection?.(group)}
      {renderedItems}
      {renderAfterSection?.(group)}
    </SettingsSection>
  )
}

export function SettingsRenderer({
  section,
  title,
  description,
  toolbar,
  className,
  panelId,
  highlightQuery,
  visibleGroupIds,
  hideGroupHeaders,
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
  const groups = useMemo(() => {
    if (!visibleGroupIds?.length) return schema.groups
    const allowed = new Set(visibleGroupIds)
    return schema.groups.filter((group) => allowed.has(group.id))
  }, [schema.groups, visibleGroupIds])

  useEffect(() => {
    const q = highlightQuery?.trim()
    if (!q) return
    const frame = window.requestAnimationFrame(() => {
      const match = document.querySelector('.settings-row.is-search-match')
      match?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [section, highlightQuery])

  const pageClassName = ['settings-page--prefs', className].filter(Boolean).join(' ')

  return (
    <SettingsPage title={title} description={description} toolbar={toolbar} className={pageClassName}>
      {groups.map((group) =>
        renderGroup(
          group,
          t,
          resolveOptions,
          renderBeforeSection,
          renderAfterSection,
          onAction,
          onFile,
          highlightQuery,
          hideGroupHeaders,
          panelId,
        ),
      )}
    </SettingsPage>
  )
}
