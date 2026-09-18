import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { SettingsHelpPopover, SettingsInlineHelp } from '../../components/settings/SettingsHelpPopover'

type Props = {
  t: TranslateFn
}

export function AiApiKeySecurityCallout({ t }: Props) {
  const title = t('settings.ai.security.title')
  const body = t(
    isTauri() ? 'settings.ai.security.description' : 'settings.ai.security.descriptionBrowser',
  )

  return (
    <div className="settings-info-callout" role="note" data-testid="ai-api-key-security-callout">
      <SettingsInlineHelp
        className="settings-info-callout-title"
        label={title}
        help={<SettingsHelpPopover title={title} body={body} />}
      />
    </div>
  )
}
