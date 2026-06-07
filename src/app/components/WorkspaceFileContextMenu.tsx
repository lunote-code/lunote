import type { RefObject } from 'react'
import { useI18n } from '../../i18n'
import { useClampedMenuPosition } from '../../lib/useClampedMenuPosition'
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
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFile', ctx)}>
          {t('ctx.file.newFile')}
        </button>
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFileFromTemplate', ctx)}>
          {t('ctx.file.newFileFromTemplate')}
        </button>
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFolder', ctx)}>
          {t('ctx.file.newFolder')}
        </button>
        <div className="file-ctx-sep" role="separator" />
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('copyPath', ctx)}>
          {t('ctx.file.copyPath')}
        </button>
        <div className="file-ctx-sep" role="separator" />
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('reveal', ctx)}>
          {t('ctx.file.reveal')}
        </button>
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
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('open', ctx)}>
          {t('ctx.file.open')}
        </button>
      ) : null}
      {!isDirectory ? (
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('openTab', ctx)}>
          {t('ctx.file.openTab')}
        </button>
      ) : null}
      {!isDirectory ? <div className="file-ctx-sep" role="separator" /> : null}
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFile', ctx)}>
        {t('ctx.file.newFile')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFileFromTemplate', ctx)}>
        {t('ctx.file.newFileFromTemplate')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFolder', ctx)}>
        {t('ctx.file.newFolder')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('rename', ctx)}>
        {t('ctx.file.rename')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item file-ctx-item-danger" onClick={() => onPick('delete', ctx)}>
        {bulkCount > 1
          ? t('ctx.file.deleteMultiple', { count: bulkCount })
          : isDirectory
            ? t('ctx.file.deleteFolder')
            : t('ctx.file.delete')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('copyPath', ctx)}>
        {t('ctx.file.copyPath')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('reveal', ctx)}>
        {t('ctx.file.reveal')}
      </button>
    </div>
  )
}
