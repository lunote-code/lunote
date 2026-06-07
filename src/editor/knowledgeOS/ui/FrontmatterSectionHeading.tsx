import { SettingsHelpPopover } from '../../../components/settings'

type SectionHelp = {
  title: string
  body: string
}

type Props = {
  title: string
  help?: SectionHelp
}

/** Section title with click-to-reveal hint popover (`LunaHintPopover`). */
export function FrontmatterSectionHeading({ title, help }: Props) {
  return (
    <div className="kos-section-title-row">
      <h3 className="kos-section-title">{title}</h3>
      {help ? (
        <SettingsHelpPopover title={help.title} body={help.body} ariaLabel={help.title} />
      ) : null}
    </div>
  )
}
