import { useEffect } from 'react'

import '../App.css'
import App from './AppRoot'
import { I18nProvider } from '../i18n'
import { getLocaleMessagesSnapshot, getLocaleRawSnapshot, getEnMessagesSnapshot } from '../i18n/localeRegistry'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { QA_APP_ROOT_OUTLINE_WINDOW_FLAG } from './qa/qaAppRootOutlineHarness'

if (typeof globalThis !== 'undefined') {
  ;(globalThis as { [QA_APP_ROOT_OUTLINE_WINDOW_FLAG]?: boolean })[QA_APP_ROOT_OUTLINE_WINDOW_FLAG] =
    true
}

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_APP_ROOT_OUTLINE__?: {
      ready: () => boolean
      activePath: () => string | null
      getOutlineTitles: () => string[]
      getMarkdownOutlineTitles: () => string[]
    }
  }
}

export default function QaAppRootOutlinePlayground() {
  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
    return () => {
      delete (globalThis as { [QA_APP_ROOT_OUTLINE_WINDOW_FLAG]?: boolean })[
        QA_APP_ROOT_OUTLINE_WINDOW_FLAG
      ]
      delete window.__QA_APP_ROOT_OUTLINE__
    }
  }, [])

  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <p data-testid="qa-ready">AppRoot outline QA</p>
      <App />
    </I18nProvider>
  )
}
