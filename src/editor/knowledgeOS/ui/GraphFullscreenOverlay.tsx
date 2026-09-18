import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../../../design-system/icons'
import { useI18n } from '../../../i18n'
import { useFocusTrap } from '../../../lib/useFocusTrap'
import { syncNoteGraphTopologyFromRoute } from '../noteGraphRuntime'
import { GraphPanel } from './GraphPanel'

type Props = {
  centerDocKey: string
  onClose: () => void
}

export function GraphFullscreenOverlay({ centerDocKey, onClose }: Props) {
  const { t } = useI18n()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null)

  useFocusTrap(true, overlayEl, {
    initialFocusRef: closeButtonRef,
    onEscape: () => {
      if (document.querySelector('[data-testid="kos-graph-preset-save-dialog"]')) return
      onClose()
    },
  })

  useLayoutEffect(() => {
    return () => {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    }
  }, [centerDocKey])

  return createPortal(
    <div
      ref={setOverlayEl}
      className="kos-graph-fullscreen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('knowledge.graph.fullscreenAria')}
      data-testid="kos-graph-fullscreen"
    >
      <div className="kos-graph-fullscreen-header">
        <p className="kos-graph-fullscreen-title">{t('knowledge.graph.fullscreenTitle')}</p>
        <button
          ref={closeButtonRef}
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
        <GraphPanel
          centerDocKey={centerDocKey}
          layoutVariant="fullscreen"
          topologyMode="global"
        />
      </div>
    </div>,
    document.body,
  )
}
