import type { RefObject } from 'react'
import { useI18n } from '../../i18n'
import { useContextMenuKeyboardNav } from '../../lib/useContextMenuKeyboardNav'
import { useClampedMenuPosition } from '../../lib/useClampedMenuPosition'
import { FileContextMenuItem } from './FileContextMenuItem'
import type { TabContextMenuPick } from '../workspace/contextMenuTypes'

export function TabContextMenu({
  state,
  menuRef,
  hasExternalDrift = false,
  onPick,
}: {
  state: { x: number; y: number; path: string; index: number; total: number }
  menuRef: RefObject<HTMLDivElement | null>
  hasExternalDrift?: boolean
  onPick: (action: TabContextMenuPick, path: string, index: number) => void
}) {
  const { t } = useI18n()
  const { x, y, path, index, total } = state
  const openKey = `${x}:${y}:${path}:${index}:${total}:${hasExternalDrift ? '1' : '0'}`
  const { onKeyDown } = useContextMenuKeyboardNav(menuRef, openKey, { autoFocusOnOpen: false })
  const { x: menuX, y: menuY } = useClampedMenuPosition(menuRef, { x, y }, openKey)
  const hasLeft = index > 0
  const hasRight = index < total - 1
  const canCloseOthers = total > 1
  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('app.tabs.listMenuTitle')}
      tabIndex={-1}
      className="file-ctx-menu"
      style={{ left: menuX, top: menuY }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
    >
      {hasExternalDrift ? (
        <>
          <FileContextMenuItem
            icon="refresh"
            label={t('app.tabs.reloadFromDisk')}
            onClick={() => onPick('reloadFromDisk', path, index)}
          />
          <div className="file-ctx-sep" role="separator" />
        </>
      ) : null}
      <FileContextMenuItem icon="close" label={t('ctx.tab.close')} onClick={() => onPick('close', path, index)} />
      <FileContextMenuItem
        icon="files"
        label={t('ctx.tab.closeOthers')}
        disabled={!canCloseOthers}
        onClick={() => onPick('closeOthers', path, index)}
      />
      <FileContextMenuItem
        icon="chevron-left"
        label={t('ctx.tab.closeLeft')}
        disabled={!hasLeft}
        onClick={() => onPick('closeLeft', path, index)}
      />
      <FileContextMenuItem
        icon="chevron-right"
        label={t('ctx.tab.closeRight')}
        disabled={!hasRight}
        onClick={() => onPick('closeRight', path, index)}
      />
    </div>
  )
}
