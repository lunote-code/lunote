import type { TranslateFn } from '../../i18n'
import { ThemeFileList } from './ThemeFileList'

type Entry = { name: string }

type Props = {
  t: TranslateFn
  status: string
  listId: string
  listAriaLabel: string
  entries: readonly Entry[]
  activeNames: ReadonlySet<string>
  enableLabelKey: string
  disableLabelKey: string
  onToggle: (name: string) => void
  emptyMessage?: string
}

export function ThemeStylesPanel({
  t,
  status,
  listId,
  listAriaLabel,
  entries,
  activeNames,
  enableLabelKey,
  disableLabelKey,
  onToggle,
  emptyMessage,
}: Props) {
  return (
    <div className="prefs-theme-extension-block">
      <p className="prefs-theme-extension-status" role="status">
        {status}
      </p>
      {entries.length === 0 ? (
        emptyMessage ? (
          <p className="prefs-snippet-list-empty" role="status">
            {emptyMessage}
          </p>
        ) : null
      ) : (
        <ThemeFileList
          t={t}
          listId={listId}
          listAriaLabel={listAriaLabel}
          entries={entries}
          activeNames={activeNames}
          enableLabelKey={enableLabelKey}
          disableLabelKey={disableLabelKey}
          onToggle={onToggle}
        />
      )}
    </div>
  )
}
