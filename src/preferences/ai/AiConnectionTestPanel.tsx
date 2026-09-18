import { useCallback, useState } from 'react'
import { SettingsButton, SettingsControl } from '../../components/settings'
import type { TranslateFn } from '../../i18n'
import { bindValue } from '../../settings-runtime/settingsBindings'
import { readAiSettingsFromForm } from '../../settings-runtime/aiSettings'
import {
  testAiConnection,
  type AiConnectionTestErrorCode,
  type AiConnectionTestResult,
} from '../../settings-runtime/aiConnectionTest'
import { writeStoredAiConnectionTest } from '../../settings-runtime/aiConnectionTestStorage'
import { PreferencesNotice } from '../PreferencesNotice'

type Props = {
  t: TranslateFn
}

type TestState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: AiConnectionTestResult }

const ERROR_MESSAGE_KEYS: Record<AiConnectionTestErrorCode, string> = {
  missing_api_key: 'settings.ai.testConnection.error.missingApiKey',
  missing_base_url: 'settings.ai.testConnection.error.missingBaseUrl',
  timeout: 'settings.ai.testConnection.error.timeout',
  network: 'settings.ai.testConnection.error.network',
  auth: 'settings.ai.testConnection.error.auth',
  http: 'settings.ai.testConnection.error.http',
  unknown: 'settings.ai.testConnection.error.unknown',
}

function readCurrentAiSettingsFromForm() {
  return readAiSettingsFromForm({
    provider: bindValue('ai.provider'),
    apiKey: bindValue('ai.apiKey'),
    baseUrl: bindValue('ai.baseUrl'),
    model: bindValue('ai.model'),
  })
}

export function AiConnectionTestPanel({ t }: Props) {
  const [state, setState] = useState<TestState>({ phase: 'idle' })

  const onTest = useCallback(async () => {
    setState({ phase: 'loading' })
    const settings = readCurrentAiSettingsFromForm()
    const result = await testAiConnection(settings)
    if (result.ok) {
      await writeStoredAiConnectionTest({
        ok: true,
        at: Date.now(),
        provider: settings.provider,
      })
    }
    setState({ phase: 'done', result })
  }, [])

  const loading = state.phase === 'loading'
  const result = state.phase === 'done' ? state.result : null

  return (
    <div className="settings-row prefs-ai-test-connection" data-testid="ai-connection-test">
      <div className="settings-row-copy" aria-hidden="true" />
      <SettingsControl>
        <div className="settings-stack">
          <div className="settings-inline-controls">
            <SettingsButton
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void onTest()}
              data-testid="ai-connection-test-button"
            >
              {loading ? t('settings.ai.testConnection.loading') : t('settings.ai.testConnection.button')}
            </SettingsButton>
          </div>
          {loading ? (
            <PreferencesNotice tone="status" role="status" ariaLive="polite">
              {t('settings.ai.testConnection.loading')}
            </PreferencesNotice>
          ) : null}
          {result?.ok ? (
            <PreferencesNotice tone="status" role="status" ariaLive="polite">
              {t('settings.ai.testConnection.success', { model: result.model })}
            </PreferencesNotice>
          ) : null}
          {result && !result.ok ? (
            <PreferencesNotice tone="error" role="alert">
              {t(ERROR_MESSAGE_KEYS[result.code], {
                detail: result.detail ?? '',
                status: result.detail ?? '',
              })}
            </PreferencesNotice>
          ) : null}
        </div>
      </SettingsControl>
    </div>
  )
}
