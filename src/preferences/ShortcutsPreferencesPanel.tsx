import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { TranslateFn } from '../i18n'
import {
  SettingsButton,
  SettingsHelpPopover,
  SettingsInlineHelp,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from '../components/settings'
import { formatAcceleratorForDisplay } from '../menu/menu.shortcuts'
import {
  findShortcutConflicts,
  getEffectiveAccelerator,
  getManifestDefaultAccelerator,
  getShortcutOverrides,
  keyboardEventToAccelerator,
  listCustomizableShortcutCommands,
  validateShortcutAccelerator,
  type ShortcutConflict,
} from '../menu/shortcutCustomization'
import { getManifestEntry } from '../menu/commandManifest.build'
import { isShortcutCustomizable, SHORTCUT_PREF_SECTIONS } from '../menu/shortcutPlatformDefaults'
import {
  getAppSettingsSnapshot,
  resetAllShortcutOverrides,
  setShortcutOverride,
  subscribeAppSettings,
} from '../settings/appSettingsStore'

type Props = {
  t: TranslateFn
  highlightQuery?: string
}

function rowHighlight(label: string, query: string): string | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return label.toLowerCase().includes(q) ? 'is-search-match' : undefined
}

function useShortcutOverridesRevision(): void {
  useSyncExternalStore(
    subscribeAppSettings,
    () => JSON.stringify(getAppSettingsSnapshot().shortcutOverrides ?? {}),
    () => '{}',
  )
}

export function ShortcutsPreferencesPanel({ t, highlightQuery = '' }: Props) {
  useShortcutOverridesRevision()
  const settings = getAppSettingsSnapshot()
  const overrides = getShortcutOverrides(settings)
  const conflicts = useMemo(() => findShortcutConflicts(overrides), [overrides])

  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)

  const sections = useMemo(() => {
    return SHORTCUT_PREF_SECTIONS.map((section) => ({
      ...section,
      items: section.commandIds
        .map((id) => getManifestEntry(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e)),
    })).filter((s) => s.items.length > 0)
  }, [])

  const labelForCommand = useCallback(
    (commandId: string) => {
      const entry = listCustomizableShortcutCommands().find((e) => e.id === commandId)
      return entry ? t(entry.labelKey) : commandId
    },
    [t],
  )

  const conflictFor = useCallback(
    (commandId: string): ShortcutConflict | undefined =>
      conflicts.find((c) => c.commandId === commandId || c.otherId === commandId),
    [conflicts],
  )

  const startRecording = useCallback((commandId: string) => {
    setRecordError(null)
    setRecordingId(commandId)
  }, [])

  const cancelRecording = useCallback(() => {
    setRecordingId(null)
    setRecordError(null)
  }, [])

  useEffect(() => {
    if (!recordingId) return

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        cancelRecording()
        return
      }

      const acc = keyboardEventToAccelerator(event)
      if (!acc) return

      if (validateShortcutAccelerator(acc)) {
        setRecordError(t('settings.shortcuts.invalid'))
        return
      }

      const testOverrides = { ...overrides, [recordingId]: acc }
      const hit = findShortcutConflicts(testOverrides).find(
        (c) => c.commandId === recordingId || c.otherId === recordingId,
      )
      if (hit) {
        setRecordError(t('settings.shortcuts.conflict', { command: labelForCommand(hit.otherId) }))
        return
      }

      const defaultAcc = getManifestDefaultAccelerator(recordingId)
      void setShortcutOverride(recordingId, defaultAcc === acc ? null : acc)
      cancelRecording()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recordingId, overrides, t, cancelRecording, labelForCommand])

  const onResetOne = useCallback((commandId: string) => {
    void setShortcutOverride(commandId, null)
  }, [])

  const onResetAll = useCallback(() => {
    void resetAllShortcutOverrides()
    cancelRecording()
  }, [cancelRecording])

  const hasAnyOverride = Object.keys(overrides).length > 0

  useEffect(() => {
    const q = highlightQuery.trim()
    if (!q) return
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('.settings-row.is-search-match')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [highlightQuery, sections])

  return (
    <SettingsPage
      title={
        <SettingsInlineHelp
          label={t('settings.sidebar.shortcuts')}
          help={
            <SettingsHelpPopover
              title={t('settings.sidebar.shortcuts')}
              body={t('prefs.section.shortcuts.lead')}
            />
          }
          className="settings-section-title-with-help"
        />
      }
      description={t('prefs.section.shortcuts.lead')}
      className="settings-page--prefs settings-page--prefs-shortcuts"
    >
      <div className="prefs-shortcuts-actions">
        <SettingsButton
          type="button"
          variant="secondary"
          disabled={!hasAnyOverride}
          onClick={() => void onResetAll()}
        >
          {t('settings.shortcuts.resetAll')}
        </SettingsButton>
      </div>
      {sections.map((section) => (
        <SettingsSection key={section.id} title={t(section.labelKey)}>
          {section.items.map((entry) => {
            const label = t(entry.labelKey)
            const effective = getEffectiveAccelerator(entry.id, settings)
            const display = effective ? formatAcceleratorForDisplay(effective) : '—'
            const readOnly = section.readOnly === true || !isShortcutCustomizable(entry.id)
            const isCustom = !readOnly && Boolean(overrides[entry.id])
            const isRecording = !readOnly && recordingId === entry.id
            const conflict = readOnly ? undefined : conflictFor(entry.id)
            const rowHint = readOnly
              ? t('settings.shortcuts.readOnly')
              : isRecording && recordError
                ? recordError
                : conflict
                  ? t('settings.shortcuts.conflict', { command: labelForCommand(conflict.otherId) })
                  : undefined
            const rowHintNode = rowHint ? (
              <span className={readOnly ? 'prefs-shortcut-hint-muted' : 'prefs-shortcut-hint-error'}>
                {rowHint}
              </span>
            ) : undefined

            return (
              <SettingsRow
                key={entry.id}
                label={label}
                description={rowHintNode}
                className={rowHighlight(label, highlightQuery)}
              >
                <div className="prefs-shortcuts-row-controls">
                  {readOnly ? (
                    <kbd className="prefs-shortcut-key prefs-shortcut-key--readonly" aria-readonly="true">
                      {display}
                    </kbd>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`prefs-shortcut-key${isRecording ? ' is-recording' : ''}${conflict ? ' has-conflict' : ''}`}
                        aria-label={
                          isRecording
                            ? t('settings.shortcuts.recording')
                            : t('settings.shortcuts.record', { command: label })
                        }
                        onClick={() => (isRecording ? cancelRecording() : startRecording(entry.id))}
                      >
                        {isRecording ? t('settings.shortcuts.recording') : display}
                      </button>
                      {isCustom ? (
                        <SettingsButton
                          type="button"
                          variant="ghost"
                          className="prefs-shortcut-reset-one"
                          onClick={() => onResetOne(entry.id)}
                          title={t('settings.shortcuts.resetOne')}
                        >
                          {t('settings.shortcuts.reset')}
                        </SettingsButton>
                      ) : null}
                    </>
                  )}
                </div>
              </SettingsRow>
            )
          })}
        </SettingsSection>
      ))}
    </SettingsPage>
  )
}
