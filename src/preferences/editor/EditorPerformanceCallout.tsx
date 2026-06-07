import type { TranslateFn } from '../../i18n'
import { SettingsHelpPopover, SettingsInlineHelp } from '../../components/settings/SettingsHelpPopover'

type Props = {
  t: TranslateFn
}

export function EditorPerformanceCallout({ t }: Props) {
  const title = t('settings.editor.groups.performance.title')
  const body = t('settings.editor.groups.performance.description')

  return (
    <div className="settings-info-callout" role="note">
      <SettingsInlineHelp
        className="settings-info-callout-title"
        label={title}
        help={<SettingsHelpPopover title={title} body={body} />}
      />
    </div>
  )
}
