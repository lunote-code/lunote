import { useEffect, useState } from 'react'

import '../App.css'
import { I18nProvider, useI18n, type I18nBootstrap } from '../i18n'
import {
  ensureLocaleRawLoaded,
  getEnMessagesSnapshot,
  isUiLocaleId,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { TemplatePickerDialog } from '../templates/TemplatePickerDialog'
import type { WorkspaceTemplateEntry } from '../templates/templateCatalog'

const QA_TEMPLATES: WorkspaceTemplateEntry[] = [
  {
    relativePath: 'Templates/Default.md',
    fileName: 'Default.md',
    displayName: 'Default',
    isRecent: false,
    recentRank: null,
  },
  {
    relativePath: 'Templates/Daily.md',
    fileName: 'Daily.md',
    displayName: 'Daily',
    isRecent: true,
    recentRank: 0,
  },
  {
    relativePath: 'Templates/Weekly.md',
    fileName: 'Weekly.md',
    displayName: 'Weekly Review',
    isRecent: false,
    recentRank: null,
  },
]

function resolveQaLocale(): UiLocaleId {
  const raw = new URLSearchParams(window.location.search).get('locale')
  return raw && isUiLocaleId(raw) ? raw : 'en'
}

declare global {
  interface Window {
    __QA_TEMPLATE_PICKER__?: {
      isOpen: () => boolean
      getActiveDescendantId: () => string | null
      focusOutside: () => void
    }
  }
}

function QaTemplatePickerInner({ locale }: { locale: UiLocaleId }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(true)

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: locale })
  }, [locale])

  useEffect(() => {
    window.__QA_TEMPLATE_PICKER__ = {
      isOpen: () => open,
      getActiveDescendantId: () =>
        document.querySelector<HTMLInputElement>('.template-picker-search input')?.getAttribute('aria-activedescendant') ??
        null,
      focusOutside: () => {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<button type="button" id="qa-template-picker-outside">Outside</button>',
        )
        document.getElementById('qa-template-picker-outside')?.focus()
      },
    }
    return () => {
      delete window.__QA_TEMPLATE_PICKER__
      document.getElementById('qa-template-picker-outside')?.remove()
    }
  }, [open])

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <p data-testid="qa-ready">Template picker QA</p>
      <p data-testid="qa-locale">locale={locale}</p>
      <TemplatePickerDialog
        open={open}
        rootDir="/qa-vault"
        title="Choose template"
        description="Pick a template for testing focus trap behavior."
        currentValue="Templates/Default.md"
        initialTemplates={QA_TEMPLATES}
        onClose={() => setOpen(false)}
        onConfirm={async () => {}}
        t={t}
      />
    </div>
  )
}

export function QaTemplatePickerPlayground() {
  const locale = resolveQaLocale()
  const [bootstrap, setBootstrap] = useState<I18nBootstrap | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const enMessages = getEnMessagesSnapshot()
      const rawLocale = locale === 'en' ? enMessages : await ensureLocaleRawLoaded(locale)
      if (cancelled) return
      setBootstrap({
        mergedMessages: locale === 'en' ? enMessages : { ...enMessages, ...rawLocale },
        enMessages,
        rawLocale,
        languageSetting: locale,
        effectiveLocale: locale,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [locale])

  if (!bootstrap) {
    return (
      <div style={{ padding: 24, minHeight: '100vh' }}>
        <p data-testid="qa-ready">Template picker QA</p>
        <p data-testid="qa-status">booting</p>
      </div>
    )
  }

  return (
    <I18nProvider bootstrap={bootstrap}>
      <QaTemplatePickerInner locale={locale} />
    </I18nProvider>
  )
}
