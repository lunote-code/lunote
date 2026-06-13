import type { RefObject } from 'react'
import { useI18n } from '../../i18n'
import { useClampedMenuPosition } from '../../lib/useClampedMenuPosition'
import { FileContextMenuItem } from './FileContextMenuItem'
import type { FileContextMenuPick, FileContextMenuState, FileContextTarget } from '../workspace/contextMenuTypes'

export function WorkspaceFileContextMenu({
  state,
  menuRef,
  onPick,
}: {
  state: FileContextMenuState
  menuRef: RefObject<HTMLDivElement | null>
  onPick: (action: FileContextMenuPick, ctx: FileContextTarget) => void
}) {
  const { t } = useI18n()
  const { x, y, path, isDirectory, variant, bulkDeletePaths } = state
  const bulkCount = bulkDeletePaths?.length ?? 0
  const ctx: FileContextTarget = { path, isDirectory, variant, bulkDeletePaths }
  const openKey = `${x}:${y}:${path}:${isDirectory}:${variant}`
  const { x: menuX, y: menuY } = useClampedMenuPosition(menuRef, { x, y }, openKey)
  if (variant === 'blank') {
    return (
      <div
        ref={menuRef}
        role="menu"
        className="file-ctx-menu"
        style={{ left: menuX, top: menuY }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <FileContextMenuItem icon="note-new" label={t('ctx.file.newFile')} onClick={() => onPick('newFile', ctx)} />
        <FileContextMenuItem
          icon="template"
          label={t('ctx.file.newFileFromTemplate')}
          onClick={() => onPick('newFileFromTemplate', ctx)}
        />
        <FileContextMenuItem icon="workspace" label={t('ctx.file.newFolder')} onClick={() => onPick('newFolder', ctx)} />
        <div className="file-ctx-sep" role="separator" />
        <FileContextMenuItem icon="copy" label={t('ctx.file.copyPath')} onClick={() => onPick('copyPath', ctx)} />
        <div className="file-ctx-sep" role="separator" />
        <FileContextMenuItem icon="reveal" label={t('ctx.file.reveal')} onClick={() => onPick('reveal', ctx)} />
      </div>
    )
  }
  return (
    <div
      ref={menuRef}
      role="menu"
      className="file-ctx-menu"
      style={{ left: menuX, top: menuY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!isDirectory ? (
        <FileContextMenuItem icon="note" label={t('ctx.file.open')} onClick={() => onPick('open', ctx)} />
      ) : null}
      {!isDirectory ? (
        <FileContextMenuItem icon="tab-new" label={t('ctx.file.openTab')} onClick={() => onPick('openTab', ctx)} />
      ) : null}
      {!isDirectory ? <div className="file-ctx-sep" role="separator" /> : null}
      <FileContextMenuItem icon="note-new" label={t('ctx.file.newFile')} onClick={() => onPick('newFile', ctx)} />
      <FileContextMenuItem
        icon="template"
        label={t('ctx.file.newFileFromTemplate')}
        onClick={() => onPick('newFileFromTemplate', ctx)}
      />
      <FileContextMenuItem icon="workspace" label={t('ctx.file.newFolder')} onClick={() => onPick('newFolder', ctx)} />
      <div className="file-ctx-sep" role="separator" />
      <FileContextMenuItem icon="rename" label={t('ctx.file.rename')} onClick={() => onPick('rename', ctx)} />
      <div className="file-ctx-sep" role="separator" />
      <FileContextMenuItem
        icon="delete"
        danger
        label={
          bulkCount > 1
            ? t('ctx.file.deleteMultiple', { count: bulkCount })
            : isDirectory
              ? t('ctx.file.deleteFolder')
              : t('ctx.file.delete')
        }
        onClick={() => onPick('delete', ctx)}
      />
      <div className="file-ctx-sep" role="separator" />
      <FileContextMenuItem icon="copy" label={t('ctx.file.copyPath')} onClick={() => onPick('copyPath', ctx)} />
      <div className="file-ctx-sep" role="separator" />
      <FileContextMenuItem icon="reveal" label={t('ctx.file.reveal')} onClick={() => onPick('reveal', ctx)} />
    </div>
  )
}
