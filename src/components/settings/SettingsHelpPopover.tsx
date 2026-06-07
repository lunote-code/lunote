import { LunaHintPopover, type LunaHintPopoverProps } from '../LunaHintPopover'
import { resolveSettingsHelpPortalRoot } from './settingsHelpPortal'
import type { ReactNode } from 'react'

export type SettingsHelpPopoverProps = Omit<LunaHintPopoverProps, 'resolvePortalRoot'>

/** Settings-scoped wrapper: portals into open preferences dialog when present. */
export function SettingsHelpPopover(props: SettingsHelpPopoverProps) {
  return <LunaHintPopover {...props} resolvePortalRoot={resolveSettingsHelpPortalRoot} />
}

type InlineHelpProps = {
  label: ReactNode
  help: ReactNode
  className?: string
}

export function SettingsInlineHelp({ label, help, className = 'settings-label-with-help' }: InlineHelpProps) {
  return (
    <span className={className}>
      <span>{label}</span>
      {help}
    </span>
  )
}

type LabelWithHelpProps = {
  label: string
  help: ReactNode
}

export function SettingsLabelWithHelp({ label, help }: LabelWithHelpProps) {
  return <SettingsInlineHelp label={label} help={help} />
}
