import type { RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { clampPointToViewport } from '../../lib/contextMenuPosition'
import { FileContextMenuItem } from './FileContextMenuItem'

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
      <FileContextMenuItem
        icon="snapshot"
        label={creatingSnapshot ? t('app.history.dialog.creating') : t('menu.file.history.createSnapshot')}
        disabled={creatingSnapshot}
        onClick={onCreateSnapshot}
      />
      <FileContextMenuItem
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
          <FileContextMenuItem
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
      <FileContextMenuItem
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
