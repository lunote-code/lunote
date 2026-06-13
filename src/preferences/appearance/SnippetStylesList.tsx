import type { TranslateFn } from '../../i18n'
import { ThemeStylesPanel } from './ThemeStylesPanel'

type SnippetEntry = { name: string }

type Props = {
  t: TranslateFn
  entries: readonly SnippetEntry[]
  activeNames: ReadonlySet<string>
  onToggle: (name: string) => void
}

export function SnippetStylesList({ t, entries, activeNames, onToggle }: Props) {
  const activeCount = entries.filter((entry) => activeNames.has(entry.name)).length
  const status =
    activeCount > 0
      ? t('settings.theme.cssSnippets.activeMessage', { count: String(activeCount) })
      : t('settings.theme.cssSnippets.inactiveMessage')

  return (
    <ThemeStylesPanel
      t={t}
      status={status}
      listId="prefs-snippet-styles-list"
      listAriaLabel={t('settings.theme.cssSnippets.manageTitle')}
      entries={entries}
      activeNames={activeNames}
      enableLabelKey="settings.theme.cssSnippets.enable"
      disableLabelKey="settings.theme.cssSnippets.disable"
      emptyMessage={t('settings.theme.cssSnippets.emptyCatalog')}
      onToggle={onToggle}
    />
  )
}
