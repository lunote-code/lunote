import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertDialog } from '../components/AlertDialog'
import { Icon } from '../design-system/icons'
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
  takePendingPreferencesTab,
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
  upsertExportStyleInline,
} from '../theme-runtime/themeExportStyleRuntime'
import { reloadThemeStylesheetsFromDisk } from '../theme-runtime/themeStylesheetRuntime'
import {
  enableThemeSnippet,
  reloadThemeSnippetsFromDisk,
  toggleThemeSnippet,
  upsertSnippetInline,
} from '../theme-runtime/themeSnippetRuntime'
import {
  revealCustomThemeDirectory,
  revealThemeExportDirectory,
  revealThemeDirectory,
  revealThemeSnippetsDirectory,
  saveCustomThemeJson,
  saveThemeExportStyle,
  saveThemeSnippet,
  saveThemeStylesheet,
} from '../platform/tauri/themeService'
import '../components/settings/settings.css'
import './preferencesDialog.css'

export type PreferencesDialogProps = {
  /** Controlled mode: choose one from the global store; only use `preferencesDialogStore` when not passed*/
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Current workspace root for per-vault template / daily note settings */
  workspaceRoot?: string
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

function buildCssThemeFileName(fileName: string): string {
  const trimmed = fileName.trim()
  const source = trimmed || 'imported-theme.css'
  const safeBase = source
    .replace(/[/\\]+/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+/, '')
  const normalized = safeBase || 'imported-theme.css'
  return normalized.toLowerCase().endsWith('.css') ? normalized : `${normalized}.css`
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

export function PreferencesDialog({
  open: openProp,
  onOpenChange,
  workspaceRoot = '',
}: PreferencesDialogProps = {}) {
  const dlgRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
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
      const nowOpen = isPreferencesDialogOpen()
      setStoreOpen(nowOpen)
      if (nowOpen) {
        const tab = takePendingPreferencesTab()
        if (tab) {
          setActiveTab(tab)
          writeStoredTab(tab)
        }
      }
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
      requestAnimationFrame(() => {
        searchInputRef.current?.focus({ preventScroll: true })
      })
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
        title: t('settings.assets.absolutePath.selectFolder'),
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
    if (actionId === 'theme.setCssFile') {
      try {
        await setSetting('theme.cssFile', typeof path === 'string' ? path : '')
        await reloadThemeStylesheetsFromDisk()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setThemeActionError(t('app.status.operationFailed', { message }))
      }
      return
    }
    if (actionId === 'theme.setExportCssFile') {
      try {
        await setSetting('theme.exportCssFile', typeof path === 'string' ? path : '')
        await reloadThemeExportStylesFromDisk()
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
  }, [t])

  const onSettingFile = useCallback(async (actionId: string, _path: string, file: File) => {
    if (actionId === 'theme.importCustomFile') {
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
      return
    }

    const isCssThemeImport = actionId === 'theme.importCssFile'
    const isCssSnippetImport = actionId === 'theme.importCssSnippet'
    const isExportCssImport = actionId === 'theme.importExportCss'
    if (!isCssThemeImport && !isCssSnippetImport && !isExportCssImport) return

    if (!file.name.toLowerCase().endsWith('.css')) {
      setThemeActionError(t('settings.theme.cssFile.invalid'))
      return
    }

    try {
      const css = await file.text()
      const fileName = buildCssThemeFileName(file.name)

      if (isCssThemeImport) {
        if (isTauri()) {
          const savedPath = await saveThemeStylesheet({ fileName, content: css })
          await setSetting('theme.cssContent', '')
          await setSetting('theme.cssImportFile', savedPath)
          await setSetting('theme.cssFile', fileName)
          await reloadThemeStylesheetsFromDisk()
        } else {
          await setSetting('theme.cssContent', css)
          await setSetting('theme.cssImportFile', file.name)
          await setSetting('theme.cssFile', fileName)
        }
        return
      }

      if (isCssSnippetImport) {
        if (isTauri()) {
          const savedPath = await saveThemeSnippet({ fileName, content: css })
          await setSetting('theme.cssSnippetImport', savedPath)
        } else {
          await upsertSnippetInline(fileName, css)
          await setSetting('theme.cssSnippetImport', file.name)
        }
        await enableThemeSnippet(fileName)
        await reloadThemeSnippetsFromDisk()
        return
      }

      if (isTauri()) {
        const savedPath = await saveThemeExportStyle({ fileName, content: css })
        await setSetting('theme.exportCssContent', '')
        await setSetting('theme.exportCssImport', savedPath)
        await setSetting('theme.exportCssFile', fileName)
        await reloadThemeExportStylesFromDisk()
      } else {
        await upsertExportStyleInline(fileName, css)
        await setSetting('theme.exportCssContent', css)
        await setSetting('theme.exportCssImport', file.name)
        await setSetting('theme.exportCssFile', fileName)
      }
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
            <Icon name="close" size="sm" tone="muted" />
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
            searchInputRef={searchInputRef}
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
              workspaceRoot={workspaceRoot}
              searchQuery={searchQuery}
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
