import type { RefObject } from 'react'
import { useI18n } from '../../i18n'
import type { TabContextMenuPick } from '../workspace/contextMenuTypes'

export function TabContextMenu({
  state,
  menuRef,
  onPick,
}: {
  state: { x: number; y: number; path: string; index: number; total: number }
  menuRef: RefObject<HTMLDivElement | null>
  onPick: (action: TabContextMenuPick, path: string, index: number) => void
}) {
  const { t } = useI18n()
  const { x, y, path, index, total } = state
  const hasLeft = index > 0
  const hasRight = index < total - 1
  const canCloseOthers = total > 1
  return (
    <div
      ref={menuRef}
      role="menu"
      className="file-ctx-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('close', path, index)}>
        {t('ctx.tab.close')}
      </button>
      <button
        type="button"
        role="menuitem"
        className="file-ctx-item"
        disabled={!canCloseOthers}
        onClick={() => onPick('closeOthers', path, index)}
      >
        {t('ctx.tab.closeOthers')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!hasLeft} onClick={() => onPick('closeLeft', path, index)}>
        {t('ctx.tab.closeLeft')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!hasRight} onClick={() => onPick('closeRight', path, index)}>
        {t('ctx.tab.closeRight')}
      </button>
    </div>
  )
}
