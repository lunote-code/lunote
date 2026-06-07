import { useEffect, useMemo, useState } from 'react'

import { I18nProvider } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
  isUiLocaleId,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import { PreferencesDialog } from '../preferences/PreferencesDialog'
import { subscribeThemeRuntime } from '../theme-runtime/themeRuntime'
import {
  closePreferencesDialog,
  isPreferencesDialogOpen,
  openPreferencesDialog,
} from '../preferences/preferencesDialogStore'
import type { PrefsTabId } from '../preferences/types'
import { eventMatchesAccelerator } from '../menu/menu.shortcuts'
import {
  getAppSettingsSnapshot,
  hydrateAppSettingsStore,
  markAppSettingsHydratedForTests,
} from '../settings/appSettingsStore'
import { getSetting } from '../settings-runtime/settingsRuntime'

const WEB_SETTINGS_KEY = 'Lunote:appSettings:v1'

declare global {
  interface Window {
    __QA_PREFERENCES__?: {
      open: (tab?: PrefsTabId) => void
      close: () => void
      isOpen: () => boolean
      getSetting: (path: string) => unknown
      readPersistedJson: () => string | null
      getThemeMode: () => 'light' | 'dark' | null
      getThemePreset: () => string | null
    }
  }
}

function resolveQaLocale(): UiLocaleId {
  const raw = new URLSearchParams(window.location.search).get('locale')
  return raw && isUiLocaleId(raw) ? raw : 'en'
}

function QaPreferencesInner({ locale }: { locale: UiLocaleId }) {
  const [status, setStatus] = useState('booting')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        localStorage.removeItem(WEB_SETTINGS_KEY)
      } catch {
        /* ignore */
      }
      await hydrateAppSettingsStore()
      if (cancelled) return
      if (locale !== 'en') {
        markAppSettingsHydratedForTests({
          ...getAppSettingsSnapshot(),
          language: locale,
        })
      }

      window.__QA_PREFERENCES__ = {
        open: (tab) => openPreferencesDialog(tab),
        close: () => closePreferencesDialog(),
        isOpen: () => isPreferencesDialogOpen(),
        getSetting: (path) => getSetting(path),
        readPersistedJson: () => {
          try {
            return localStorage.getItem(WEB_SETTINGS_KEY)
          } catch {
            return null
          }
        },
        getThemeMode: () => {
          const mode = document.documentElement.getAttribute('data-theme')
          return mode === 'light' || mode === 'dark' ? mode : null
        },
        getThemePreset: () => document.documentElement.getAttribute('data-theme-preset'),
      }

      setStatus('ready')
    })()

    return () => {
      cancelled = true
      closePreferencesDialog()
      delete window.__QA_PREFERENCES__
    }
  }, [locale])

  useEffect(() => subscribeThemeRuntime(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!eventMatchesAccelerator(event, 'Mod+,')) return
      event.preventDefault()
      openPreferencesDialog()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const workspaceRoot = useMemo(() => '/qa-vault', [])

  return (
    <div style={{ padding: 24, background: '#0f1115', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Preferences QA</h1>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-locale" style={{ color: '#94a3b8' }}>
        locale={locale}
      </p>
      <PreferencesDialog workspaceRoot={workspaceRoot} />
    </div>
  )
}

export function QaPreferencesPlayground() {
  const locale = resolveQaLocale()
  const bootstrap = useMemo(
    () => ({
      mergedMessages: getLocaleMessagesSnapshot(locale),
      enMessages: getEnMessagesSnapshot(),
      rawLocale: getLocaleRawSnapshot(locale),
      languageSetting: locale,
      effectiveLocale: locale,
    }),
    [locale],
  )

  return (
    <I18nProvider bootstrap={bootstrap}>
      <QaPreferencesInner locale={locale} />
    </I18nProvider>
  )
}
