import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'
import {
  SettingsButton,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSwitch,
} from '../../components/settings'
import { revealWorkspaceTemplatesFolder } from '../../templates/templateService'
import { WorkspaceTemplateSelect } from '../../templates/workspaceTemplateSelect'
import {
  readWorkspaceConfig,
  writeWorkspaceConfig,
} from '../../workspace/workspaceConfig'
import type { WorkspaceConfig } from '../../workspace/workspaceConfigTypes'
import { PreferencesNotice } from '../PreferencesNotice'
import { SettingsHelpPopover, SettingsLabelWithHelp } from '../../components/settings'

export type WorkspaceNotesSection = 'daily' | 'templates' | 'all'

type Props = {
  t: TranslateFn
  rootDir: string
  highlightQuery?: string
  visibleSection?: WorkspaceNotesSection
  hideSectionHeaders?: boolean
  panelId?: string
}

function fieldHelp(title: string, body: string, bodyMono = false): ReactNode {
  return <SettingsHelpPopover title={title} body={body} bodyMono={bodyMono} />
}

function rowMatchesQuery(label: string, description: string | undefined, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return `${label} ${description ?? ''}`.toLowerCase().includes(q)
}

function rowHighlight(label: string, description: string | undefined, highlightQuery?: string) {
  return rowMatchesQuery(label, description ?? '', highlightQuery ?? '')
    ? 'is-search-match'
    : undefined
}

export function WorkspaceNotesSettings({
  t,
  rootDir,
  highlightQuery = '',
  visibleSection = 'all',
  hideSectionHeaders = false,
  panelId,
}: Props) {
  const [config, setConfig] = useState<WorkspaceConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [committedTemplatesFolder, setCommittedTemplatesFolder] = useState('Templates')
  const lastPersistedTemplatesFolderRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!rootDir.trim()) {
      setConfig(null)
      return
    }
    try {
      const next = await readWorkspaceConfig(rootDir)
      setConfig(next)
      setError(null)
      const folder = next.templates?.folder ?? 'Templates'
      lastPersistedTemplatesFolderRef.current = folder
      setCommittedTemplatesFolder(folder)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [rootDir])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = highlightQuery.trim()
    if (!q) return
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('.settings-row.is-search-match')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [highlightQuery, config])

  const persist = useCallback(
    async (next: WorkspaceConfig) => {
      if (!rootDir.trim()) return
      setSaving(true)
      setError(null)
      try {
        await writeWorkspaceConfig(rootDir, next)
        setConfig(next)
        const folder = next.templates?.folder ?? 'Templates'
        lastPersistedTemplatesFolderRef.current = folder
        setCommittedTemplatesFolder(folder)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSaving(false)
      }
    },
    [rootDir],
  )

  const dailyTemplatePath = config?.dailyNotes?.template ?? 'Templates/Daily.md'
  const defaultTemplatePath = config?.templates?.defaultNewNote ?? 'Templates/Default.md'
  const templatesFolderPath = config?.templates?.folder ?? 'Templates'

  if (!rootDir.trim()) {
    return <PreferencesNotice tone="muted">{t('settings.templates.noWorkspace')}</PreferencesNotice>
  }

  if (!config) {
    return <PreferencesNotice tone="muted">{t('settings.workspaceNotes.loading')}</PreferencesNotice>
  }

  const runQuickAction = async (action: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const templateVariablesTitle = t('settings.workspaceNotes.variablesTitle')
  const templateVariablesBody = t('settings.workspaceNotes.variablesList')
  const dateVariablesBody = t('settings.workspaceNotes.variablesDateHint')

  const dateFormatHelp = fieldHelp(
    t('settings.workspaceNotes.dailyFormat.label'),
    `${t('settings.workspaceNotes.dailyFormat.description')}\n\n${dateVariablesBody}`,
  )

  const templateVariablesHelp = fieldHelp(templateVariablesTitle, templateVariablesBody, true)

  const dailyEnabledLabel = t('settings.workspaceNotes.dailyEnabled.label')
  const dailyEnabledDescription = t('settings.workspaceNotes.dailyEnabled.description')
  const dailyFolderLabel = t('settings.workspaceNotes.dailyFolder.label')
  const dailyFolderDescription = t('settings.workspaceNotes.dailyFolder.description')
  const dailyFormatLabel = t('settings.workspaceNotes.dailyFormat.label')
  const dailyTemplateLabel = t('settings.workspaceNotes.dailyTemplate.label')
  const openOnStartupLabel = t('settings.workspaceNotes.openOnStartup.label')
  const openOnStartupDescription = t('settings.workspaceNotes.openOnStartup.description')
  const templatesFolderLabel = t('settings.workspaceNotes.templatesFolder.label')
  const templatesFolderDescription = t('settings.workspaceNotes.templatesFolder.description')
  const defaultTemplateLabel = t('settings.workspaceNotes.defaultTemplate.label')

  const showDaily = visibleSection === 'all' || visibleSection === 'daily'
  const showTemplates = visibleSection === 'all' || visibleSection === 'templates'
  const dailySectionTitle = hideSectionHeaders ? undefined : t('settings.workspaceNotes.dailySectionTitle')
  const templatesSectionTitle = hideSectionHeaders
    ? undefined
    : t('settings.workspaceNotes.templatesSectionTitle')

  return (
    <div
      id={panelId}
      role={panelId ? 'region' : undefined}
      aria-labelledby={panelId ? panelId.replace('-panel-', '-tab-') : undefined}
      className="workspace-notes-root"
    >
      {saving ? (
        <PreferencesNotice tone="status" role="status" ariaLive="polite">
          {t('settings.workspaceNotes.saving')}
        </PreferencesNotice>
      ) : null}

      {error ? (
        <PreferencesNotice tone="error" role="alert">
          {error}
        </PreferencesNotice>
      ) : null}

      {showDaily ? (
      <SettingsSection title={dailySectionTitle} className="workspace-notes-section">
        <SettingsRow
          label={dailyEnabledLabel}
          description={dailyEnabledDescription}
          className={rowHighlight(dailyEnabledLabel, dailyEnabledDescription, highlightQuery)}
        >
          <SettingsSwitch
            checked={config.dailyNotes?.enabled !== false}
            ariaLabel={dailyEnabledLabel}
            disabled={saving}
            onCheckedChange={(checked) => {
              void persist({
                ...config,
                dailyNotes: { ...config.dailyNotes, enabled: checked },
              })
            }}
          />
        </SettingsRow>

        <SettingsRow
          label={dailyFolderLabel}
          description={dailyFolderDescription}
          className={rowHighlight(dailyFolderLabel, dailyFolderDescription, highlightQuery)}
        >
          <SettingsInput
            value={config.dailyNotes?.folder ?? 'Daily'}
            disabled={saving}
            onChange={(e) => {
              setConfig({
                ...config,
                dailyNotes: { ...config.dailyNotes, folder: e.target.value },
              })
            }}
            onBlur={() => void persist(config)}
          />
        </SettingsRow>

        <SettingsRow
          label={
            <SettingsLabelWithHelp label={dailyFormatLabel} help={dateFormatHelp} />
          }
          className={rowHighlight(dailyFormatLabel, t('settings.workspaceNotes.dailyFormat.description'), highlightQuery)}
        >
          <SettingsInput
            value={config.dailyNotes?.format ?? 'YYYY-MM-DD'}
            disabled={saving}
            onChange={(e) => {
              setConfig({
                ...config,
                dailyNotes: { ...config.dailyNotes, format: e.target.value },
              })
            }}
            onBlur={() => void persist(config)}
          />
        </SettingsRow>

        <SettingsRow
          label={
            <SettingsLabelWithHelp label={dailyTemplateLabel} help={templateVariablesHelp} />
          }
          className={rowHighlight(dailyTemplateLabel, t('settings.workspaceNotes.dailyTemplate.description'), highlightQuery)}
        >
          <WorkspaceTemplateSelect
            rootDir={rootDir}
            templatesFolder={committedTemplatesFolder}
            value={dailyTemplatePath}
            disabled={saving}
            ariaLabel={dailyTemplateLabel}
            t={t}
            onValueChange={(path) => {
              void persist({
                ...config,
                dailyNotes: { ...config.dailyNotes, template: path },
              })
            }}
          />
        </SettingsRow>

        <SettingsRow
          label={openOnStartupLabel}
          description={openOnStartupDescription}
          className={rowHighlight(openOnStartupLabel, openOnStartupDescription, highlightQuery)}
        >
          <SettingsSwitch
            checked={config.dailyNotes?.openOnStartup === true}
            ariaLabel={openOnStartupLabel}
            disabled={saving}
            onCheckedChange={(checked) => {
              void persist({
                ...config,
                dailyNotes: { ...config.dailyNotes, openOnStartup: checked },
              })
            }}
          />
        </SettingsRow>
      </SettingsSection>
      ) : null}

      {showTemplates ? (
      <SettingsSection title={templatesSectionTitle} className="workspace-notes-section">
        <SettingsRow
          label={templatesFolderLabel}
          description={templatesFolderDescription}
          className={rowHighlight(templatesFolderLabel, templatesFolderDescription, highlightQuery)}
        >
          <div className="settings-stack">
            <SettingsInput
              data-testid="workspace-templates-folder-input"
              value={templatesFolderPath}
              disabled={saving}
              onChange={(e) => {
                setConfig({
                  ...config,
                  templates: { ...config.templates, folder: e.target.value },
                })
              }}
              onBlur={() => {
                const folder = config.templates?.folder ?? 'Templates'
                const lastFolder = lastPersistedTemplatesFolderRef.current ?? 'Templates'
                if (folder === lastFolder) return
                void persist(config)
              }}
            />
            <div className="settings-inline-controls workspace-template-actions">
              <SettingsButton
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() =>
                  void runQuickAction(async () => {
                    await revealWorkspaceTemplatesFolder(rootDir)
                  })
                }
              >
                {t('settings.workspaceNotes.openTemplatesFolder')}
              </SettingsButton>
            </div>
          </div>
        </SettingsRow>

        <SettingsRow
          label={
            <SettingsLabelWithHelp label={defaultTemplateLabel} help={templateVariablesHelp} />
          }
          className={rowHighlight(defaultTemplateLabel, t('settings.workspaceNotes.defaultTemplate.description'), highlightQuery)}
        >
          <WorkspaceTemplateSelect
            rootDir={rootDir}
            templatesFolder={committedTemplatesFolder}
            value={defaultTemplatePath}
            disabled={saving}
            ariaLabel={defaultTemplateLabel}
            t={t}
            onValueChange={(path) => {
              void persist({
                ...config,
                templates: { ...config.templates, defaultNewNote: path },
              })
            }}
          />
        </SettingsRow>
      </SettingsSection>
      ) : null}
    </div>
  )
}
