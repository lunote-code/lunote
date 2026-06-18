import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../../../design-system/icons'
import { useI18n } from '../../../i18n'
import { GraphPanel } from './GraphPanel'

type Props = {
  centerDocKey: string
  onClose: () => void
}

export function GraphFullscreenOverlay({ centerDocKey, onClose }: Props) {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      className="kos-graph-fullscreen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('knowledge.graph.fullscreenAria')}
      data-testid="kos-graph-fullscreen"
    >
      <div className="kos-graph-fullscreen-header">
        <p className="kos-graph-fullscreen-title">{t('knowledge.graph.fullscreenTitle')}</p>
        <button
          type="button"
          className="kos-graph-fullscreen-close"
          aria-label={t('knowledge.graph.fullscreenClose')}
          data-testid="kos-graph-fullscreen-close"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="kos-graph-fullscreen-body">
        <GraphPanel centerDocKey={centerDocKey} layoutVariant="fullscreen" />
      </div>
    </div>,
    document.body,
  )
}
