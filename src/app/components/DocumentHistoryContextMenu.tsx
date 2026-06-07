import type { RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { clampPointToViewport } from '../../lib/contextMenuPosition'
import type { SemanticIconName } from '../../design-system/icons/iconRegistry'
import { Icon } from '../../design-system/icons/Icon'

export type DocumentHistoryContextMenuState = {
  x: number
  y: number
  target: 'surface' | 'entry'
  entryId?: string
}

type Props = {
  t: TranslateFn
  state: DocumentHistoryContextMenuState
  menuRef: RefObject<HTMLDivElement | null>
  creatingSnapshot: boolean
  restoreDisabled: boolean
  restoreEntryId: string
  onCreateSnapshot: () => void
  onRestore: (snapshotId: string) => void
  onDelete: (snapshotId: string) => void
  onCloseDialog: () => void
}

function ContextMenuItem({
  icon,
  label,
  disabled,
  danger,
  onClick,
}: {
  icon: SemanticIconName
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={['file-ctx-item', danger ? 'file-ctx-item-danger' : ''].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="file-ctx-item-leading" aria-hidden>
        <Icon name={icon} size="sm" tone={danger ? 'default' : 'muted'} stroke="regular" />
      </span>
      <span className="file-ctx-item-label">{label}</span>
    </button>
  )
}

export function DocumentHistoryContextMenu({
  t,
  state,
  menuRef,
  creatingSnapshot,
  restoreDisabled,
  restoreEntryId,
  onCreateSnapshot,
  onRestore,
  onDelete,
  onCloseDialog,
}: Props) {
  const { x, y, target, entryId } = state
  const restoreId = target === 'entry' && entryId ? entryId : restoreEntryId
  const canDelete = target === 'entry' && Boolean(entryId)

  return (
    <div
      ref={menuRef}
      role="menu"
      className="file-ctx-menu document-history-ctx-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ContextMenuItem
        icon="snapshot"
        label={creatingSnapshot ? t('app.history.dialog.creating') : t('menu.file.history.createSnapshot')}
        disabled={creatingSnapshot}
        onClick={onCreateSnapshot}
      />
      <ContextMenuItem
        icon="undo"
        label={t('app.history.dialog.restoreSnapshot')}
        disabled={restoreDisabled || !restoreId}
        onClick={() => {
          if (!restoreId || restoreDisabled) return
          onRestore(restoreId)
        }}
      />
      {canDelete ? (
        <>
          <div className="file-ctx-sep" role="separator" />
          <ContextMenuItem
            icon="delete"
            label={t('app.history.dialog.delete')}
            danger
            onClick={() => {
              if (!entryId) return
              onDelete(entryId)
            }}
          />
        </>
      ) : null}
      <div className="file-ctx-sep" role="separator" />
      <ContextMenuItem
        icon="close"
        label={t('app.history.dialog.close')}
        onClick={onCloseDialog}
      />
    </div>
  )
}

export function clampHistoryContextMenuPosition(x: number, y: number): { x: number; y: number } {
  return clampPointToViewport(x, y, 240, 220)
}
