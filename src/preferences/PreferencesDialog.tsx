import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertDialog } from '../components/AlertDialog'
import { isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useI18n } from '../i18n'
import { setSetting } from '../settings-runtime/settingsRuntime'
import type { SettingsActionHandler } from '../settings-runtime/settingsBindings'
import {
  closePreferencesDialog,
  isPreferencesDialogOpen,
  openPreferencesDialog,
  subscribePreferencesDialog,
} from './preferencesDialogStore'
import {
  getPendingRestartReason,
  setPendingRestartReason,
  subscribePendingRestart,
} from '../restart/pendingRestartStore'
import { PreferencesPanel } from './PreferencesPanel'
import { PreferencesSidebar } from './PreferencesSidebar'
import { filterPrefsTabs } from './prefsSearch'
import {
  PREFS_ACTIVE_TAB_STORAGE_KEY,
  PREFS_TAB_IDS,
  type PrefsTabId,
} from './types'
import { INVALID_CUSTOM_THEME_ID, loadThemeFromJSON } from '../theme-runtime/themeLoader'
import { registerImportedCustomTheme, reloadCustomThemesFromDisk } from '../theme-runtime/themeRuntime'
import {
  reloadThemeExportStylesFromDisk,
  toggleThemeExportStyle,
} from '../theme-runtime/themeExportStyleRuntime'
import { reloadThemeStylesheetsFromDisk } from '../theme-runtime/themeStylesheetRuntime'
import { reloadThemeSnippetsFromDisk, toggleThemeSnippet } from '../theme-runtime/themeSnippetRuntime'
import {
  revealCustomThemeDirectory,
  revealThemeExportDirectory,
  revealThemeDirectory,
  revealThemeSnippetsDirectory,
  saveCustomThemeJson,
} from '../platform/tauri/themeService'
import '../components/settings/settings.css'
import './preferencesDialog.css'

export type PreferencesDialogProps = {
  /** Controlled mode: choose one from the global store; only use `preferencesDialogStore` when not passed*/
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function readStoredTab(): PrefsTabId {
  try {
    const raw = localStorage.getItem(PREFS_ACTIVE_TAB_STORAGE_KEY)
    if (raw && (PREFS_TAB_IDS as readonly string[]).includes(raw)) return raw as PrefsTabId
  } catch {
    /* ignore */
  }
  return 'general'
}

function writeStoredTab(tab: PrefsTabId): void {
  try {
    localStorage.setItem(PREFS_ACTIVE_TAB_STORAGE_KEY, tab)
  } catch {
    /* ignore */
  }
}

function buildCustomThemeFileName(fileName: string, themeId: string): string {
  const trimmed = fileName.trim()
  const source = trimmed || `${themeId}.json`
  const ext = source.toLowerCase().endsWith('.json') ? '' : '.json'
  const safeBase = source
    .replace(/[/\\]+/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+/, '')
  const normalized = safeBase || `${themeId}.json`
  return normalized.toLowerCase().endsWith('.json') ? normalized : `${normalized}${ext}`
}

export function PreferencesDialog({ open: openProp, onOpenChange }: PreferencesDialogProps = {}) {
  const dlgRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { t, effectiveLocale } = useI18n()
  const [storeOpen, setStoreOpen] = useState(() => isPreferencesDialogOpen())
  const [activeTab, setActiveTab] = useState<PrefsTabId>(readStoredTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingRestart, setPendingRestart] = useState(() => getPendingRestartReason())
  const [webRestartHintOpen, setWebRestartHintOpen] = useState(false)
  const [themeActionError, setThemeActionError] = useState<string | null>(null)

  const isControlled = openProp !== undefined
  const isOpen = isControlled ? openProp : storeOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next)
      } else if (next) {
        openPreferencesDialog()
      } else {
        closePreferencesDialog()
      }
    },
    [isControlled, onOpenChange],
  )

  useEffect(() => {
    if (isControlled) return
    return subscribePreferencesDialog(() => {
      setStoreOpen(isPreferencesDialogOpen())
    })
  }, [isControlled])

  useEffect(() => {
    if (isOpen) setSearchQuery('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    void reloadCustomThemesFromDisk()
    void reloadThemeStylesheetsFromDisk()
    void reloadThemeSnippetsFromDisk()
    void reloadThemeExportStylesFromDisk()
  }, [isOpen])

  useEffect(() => {
    return subscribePendingRestart(() => {
      setPendingRestart(getPendingRestartReason())
    })
  }, [])

  useEffect(() => {
    const dlg = dlgRef.current
    if (!dlg) return
    if (isOpen) {
      if (!dlg.open) dlg.showModal()
    } else if (dlg.open) {
      dlg.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dlg = dlgRef.current
    if (!dlg) return
    const onClose = () => setOpen(false)
    dlg.addEventListener('close', onClose)
    return () => dlg.removeEventListener('close', onClose)
  }, [setOpen])

  const onTabChange = useCallback((tab: PrefsTabId) => {
    setActiveTab(tab)
    writeStoredTab(tab)
  }, [])

  const visibleTabs = filterPrefsTabs(t, searchQuery)
  const panelTab =
    visibleTabs.length === 0
      ? activeTab
      : visibleTabs.includes(activeTab)
        ? activeTab
        : visibleTabs[0]!

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]!)
    }
  }, [visibleTabs, activeTab])

  const onSettingAction = useCallback<SettingsActionHandler>(async (actionId, path) => {
    if (actionId === 'assets.pickAbsolutePath') {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose asset storage folder',
      })
      if (typeof selected !== 'string') return
      await setSetting('assets.storage.mode', 'absolute_path')
      await setSetting('assets.absolute.path', selected)
      return
    }
    if (actionId === 'theme.openCustomThemeFolder') {
      if (!isTauri()) {
        setThemeActionError(t('app.status.revealDesktopOnly'))
        return
      }
      try {
        await revealCustomThemeDirectory()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.openThemeFolder') {
      if (!isTauri()) {
        setThemeActionError(t('app.status.revealDesktopOnly'))
        return
      }
      try {
        await revealThemeDirectory()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.refreshCssThemes') {
      try {
        await reloadThemeStylesheetsFromDisk()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.openThemeSnippetsFolder') {
      if (!isTauri()) {
        setThemeActionError(t('app.status.revealDesktopOnly'))
        return
      }
      try {
        await revealThemeSnippetsDirectory()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.refreshCssSnippets') {
      try {
        await reloadThemeSnippetsFromDisk()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.toggleCssSnippet') {
      try {
        if (path) await toggleThemeSnippet(path)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.openThemeExportFolder') {
      if (!isTauri()) {
        setThemeActionError(t('app.status.revealDesktopOnly'))
        return
      }
      try {
        await revealThemeExportDirectory()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.refreshExportStyles') {
      try {
        await reloadThemeExportStylesFromDisk()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.toggleExportStyle') {
      try {
        if (path) await toggleThemeExportStyle(path)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
    }
  }, [t])

  const onSettingFile = useCallback(async (actionId: string, _path: string, file: File) => {
    if (actionId !== 'theme.importCustomFile') return
    try {
      const json = await file.text()
      const theme = loadThemeFromJSON(json, file.name)
      if (theme.id === INVALID_CUSTOM_THEME_ID) {
        setThemeActionError(t('settings.theme.customThemeFile.invalid'))
        return
      }
      registerImportedCustomTheme(theme)
      const persistedFile = isTauri()
        ? await saveCustomThemeJson({
            fileName: buildCustomThemeFileName(file.name, theme.id),
            content: json,
          })
        : file.name
      await setSetting('theme.customThemeJSON', json)
      await setSetting('theme.customThemeFile', persistedFile)
      await setSetting('theme.active', theme.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setThemeActionError(t('app.status.themeLoadFailed', { message }))
    }
  }, [t])

  const onRestartNow = useCallback(async () => {
    setPendingRestartReason(null)
    if (!isTauri()) {
      setWebRestartHintOpen(true)
      return
    }
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch {
      setWebRestartHintOpen(true)
    }
  }, [])

  const onLater = useCallback(() => {
    setPendingRestartReason(null)
  }, [])

  const requestClose = useCallback(() => {
    dlgRef.current?.close()
  }, [])

  return (
    <>
    <dialog ref={dlgRef} className="prefs-dialog" aria-labelledby={titleId}>
      <div className="prefs-modal">
        <header className="prefs-modal-header">
          <h2 id={titleId} className="prefs-modal-title">
            {t('prefs.title')}
          </h2>
          <button
            type="button"
            className="prefs-modal-close"
            aria-label={t('prefs.close')}
            onClick={requestClose}
          >
            ×
          </button>
        </header>
        <div className="prefs-layout">
          <PreferencesSidebar
            t={t}
            activeTab={panelTab}
            onTabChange={onTabChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            visibleTabs={visibleTabs}
          />
          {visibleTabs.length === 0 ? (
            <div className="prefs-content prefs-content-empty" role="status">
              <p>{t('prefs.search.noResults')}</p>
            </div>
          ) : (
            <PreferencesPanel
              t={t}
              activeTab={panelTab}
              effectiveLocale={effectiveLocale}
              pendingRestart={pendingRestart}
              onSettingAction={onSettingAction}
              onSettingFile={onSettingFile}
              onRestartNow={onRestartNow}
              onLater={onLater}
            />
          )}
        </div>
      </div>
    </dialog>
    <AlertDialog
      open={webRestartHintOpen}
      title={t('app.alert.title')}
      message={t('prefs.restart.webHint')}
      okLabel={t('app.about.close')}
      onClose={() => setWebRestartHintOpen(false)}
    />
    <AlertDialog
      open={themeActionError != null}
      title={t('app.alert.title')}
      message={themeActionError ?? ''}
      okLabel={t('app.about.close')}
      onClose={() => setThemeActionError(null)}
    />
    </>
  )
}
