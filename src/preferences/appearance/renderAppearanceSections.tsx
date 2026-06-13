import type { ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'
import type { SettingsActionHandler } from '../../settings-runtime/settingsBindings'
import type { GroupSetting } from '../../settings-runtime/settingsTypes'
import { ExportStylesList } from './ExportStylesList'
import { SnippetStylesList } from './SnippetStylesList'

type ThemeCatalogEntry = { name: string }

type Args = {
  t: TranslateFn
  group: GroupSetting
  activeSnippetNames: ReadonlySet<string>
  availableSnippets: readonly ThemeCatalogEntry[]
  activeExportStyleNames: ReadonlySet<string>
  availableExportStyles: readonly ThemeCatalogEntry[]
  onSettingAction: SettingsActionHandler
}

type AppearanceAfterSectionRenderer = (args: Args) => ReactNode

function renderSnippetStylesList(args: Args): ReactNode {
  return (
    <SnippetStylesList
      t={args.t}
      entries={args.availableSnippets}
      activeNames={args.activeSnippetNames}
      onToggle={(name) => void args.onSettingAction('theme.toggleCssSnippet', name)}
    />
  )
}

function renderExportStylesList(args: Args): ReactNode {
  return (
    <ExportStylesList
      t={args.t}
      entries={args.availableExportStyles}
      activeNames={args.activeExportStyleNames}
      onSettingAction={args.onSettingAction}
    />
  )
}

const APPEARANCE_AFTER_SECTION_RENDERERS: Record<string, AppearanceAfterSectionRenderer> = {
  'appearance.snippets': renderSnippetStylesList,
  'export.styles': renderExportStylesList,
}

export function renderAppearanceAfterSection({
  t,
  group,
  activeSnippetNames,
  availableSnippets,
  activeExportStyleNames,
  availableExportStyles,
  onSettingAction,
}: Args): ReactNode {
  const render = APPEARANCE_AFTER_SECTION_RENDERERS[group.id]
  return render
    ? render({
        t,
        group,
        activeSnippetNames,
        availableSnippets,
        activeExportStyleNames,
        availableExportStyles,
        onSettingAction,
      })
    : null
}
