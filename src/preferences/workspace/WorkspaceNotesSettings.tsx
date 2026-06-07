import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'
import {
  SettingsButton,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSwitch,
} from '../../components/settings'
import { openDailyNote, openRelativeDailyNote } from '../../templates/dailyNoteService'
import { revealWorkspaceTemplatesFolder } from '../../templates/templateService'
import { WorkspaceTemplateSelect } from '../../templates/workspaceTemplateSelect'
import {
  readWorkspaceConfig,
  writeWorkspaceConfig,
} from '../../workspace/workspaceConfig'
import type { WorkspaceConfig } from '../../workspace/workspaceConfigTypes'
import { closePreferencesDialog } from '../preferencesDialogStore'
import { SettingsHelpPopover, SettingsLabelWithHelp } from '../../components/settings'

type Props = {
  t: TranslateFn
  rootDir: string
  highlightQuery?: string
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

export function WorkspaceNotesSettings({ t, rootDir, highlightQuery = '' }: Props) {
  const [config, setConfig] = useState<WorkspaceConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateReloadKey, setTemplateReloadKey] = useState(0)

  const load = useCallback(async () => {
    if (!rootDir.trim()) {
      setConfig(null)
      return
    }
    try {
      const next = await readWorkspaceConfig(rootDir)
      setConfig(next)
      setError(null)
      setTemplateReloadKey((key) => key + 1)
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

  if (!rootDir.trim()) {
    return <p className="prefs-empty-state">{t('settings.templates.noWorkspace')}</p>
  }

  if (!config) {
    return <p className="prefs-empty-state">{t('settings.workspaceNotes.loading')}</p>
  }

  const runOpenDailyNote = async (open: () => Promise<string | null>) => {
    setSaving(true)
    setError(null)
    try {
      if (config.dailyNotes?.enabled === false) {
        setError(t('app.menu.dailyNoteDisabled'))
        return
      }
      const openedPath = await open()
      if (openedPath) {
        closePreferencesDialog()
      } else {
        setError(t('app.menu.dailyNoteDisabled'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
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

  return (
    <>
      {saving ? (
        <p className="prefs-save-status" role="status" aria-live="polite">
          {t('settings.workspaceNotes.saving')}
        </p>
      ) : null}

      {error ? (
        <p className="prefs-error-state" role="alert">
          {error}
        </p>
      ) : null}

      <SettingsSection title={t('settings.workspaceNotes.dailySectionTitle')}>
        <div className="workspace-notes-actions">
          <SettingsButton
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() =>
              void runOpenDailyNote(async () => openRelativeDailyNote(rootDir, -1))
            }
          >
            {t('settings.workspaceNotes.openYesterday')}
          </SettingsButton>
          <SettingsButton
            type="button"
            variant="secondary"
            className="workspace-notes-action-today"
            disabled={saving}
            onClick={() => void runOpenDailyNote(async () => openDailyNote(rootDir))}
          >
            {t('settings.workspaceNotes.openToday')}
          </SettingsButton>
          <SettingsButton
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() =>
              void runOpenDailyNote(async () => openRelativeDailyNote(rootDir, 1))
            }
          >
            {t('settings.workspaceNotes.openTomorrow')}
          </SettingsButton>
        </div>

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
            key={`daily-${templateReloadKey}`}
            rootDir={rootDir}
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

      <SettingsSection title={t('settings.workspaceNotes.templatesSectionTitle')}>
        <SettingsRow
          label={templatesFolderLabel}
          description={templatesFolderDescription}
          className={rowHighlight(templatesFolderLabel, templatesFolderDescription, highlightQuery)}
        >
          <div className="workspace-template-field">
            <SettingsInput
              value={config.templates?.folder ?? 'Templates'}
              disabled={saving}
              onChange={(e) => {
                setConfig({
                  ...config,
                  templates: { ...config.templates, folder: e.target.value },
                })
              }}
              onBlur={async () => {
                await persist(config)
                setTemplateReloadKey((key) => key + 1)
              }}
            />
            <div className="workspace-template-field-actions">
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
            key={`default-${templateReloadKey}`}
            rootDir={rootDir}
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

        <div className="workspace-template-section-footer">
          <SettingsButton type="button" variant="secondary" disabled={saving} onClick={() => void load()}>
            {t('settings.workspaceNotes.reload')}
          </SettingsButton>
        </div>
      </SettingsSection>
    </>
  )
}
