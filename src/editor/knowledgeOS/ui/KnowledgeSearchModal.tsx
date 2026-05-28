import { SearchPanel } from './SearchPanel'
import { useI18n } from '../../../i18n'

type Props = {
  open: boolean
  query: string
  onQueryChange: (q: string) => void
  onClose: () => void
}

export function KnowledgeSearchModal({ open, query, onQueryChange, onClose }: Props) {
  const { t } = useI18n()
  if (!open) return null

  return (
    <div
      className="kos-search-modal-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        className="kos-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('knowledge.search.aria')}
        onClick={(e) => e.stopPropagation()}
      >
        <SearchPanel
          query={query}
          onQueryChange={onQueryChange}
          onHitOpened={onClose}
          autoFocus
        />
      </div>
    </div>
  )
}
