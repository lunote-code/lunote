import { useEffect, useId, useRef, useState } from 'react'

import { useFocusTrap } from '../../../lib/useFocusTrap'
import { useI18n } from '../../../i18n'
import { SearchPanel } from './SearchPanel'

type Props = {
  open: boolean
  query: string
  onQueryChange: (q: string) => void
  onClose: () => void
}

export function KnowledgeSearchModal({ open, query, onQueryChange, onClose }: Props) {
  const { t } = useI18n()
  const hintId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null)

  useFocusTrap(open, dialogEl, {
    onEscape: onClose,
    initialFocusRef: searchInputRef,
  })

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={setDialogEl}
        className="command-palette global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('knowledge.search.aria')}
        onClick={(e) => e.stopPropagation()}
      >
        <SearchPanel
          ref={searchInputRef}
          variant="modal"
          query={query}
          onQueryChange={onQueryChange}
          onHitOpened={onClose}
          scopeHintId={hintId}
        />
      </div>
    </div>
  )
}
