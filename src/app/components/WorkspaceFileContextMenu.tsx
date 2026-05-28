import type { RefObject } from 'react'
import { useI18n } from '../../i18n'
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
  const { x, y, path, isDirectory, variant } = state
  const ctx: FileContextTarget = { path, isDirectory, variant }
  if (variant === 'blank') {
    return (
      <div
        ref={menuRef}
        role="menu"
        className="file-ctx-menu"
        style={{ left: x, top: y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFile', ctx)}>
          {t('ctx.file.newFile')}
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
      style={{ left: x, top: y }}
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
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('newFolder', ctx)}>
        {t('ctx.file.newFolder')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('rename', ctx)}>
        {t('ctx.file.rename')}
      </button>
      {!isDirectory ? (
        <>
          <div className="file-ctx-sep" role="separator" />
          <button type="button" role="menuitem" className="file-ctx-item file-ctx-item-danger" onClick={() => onPick('delete', ctx)}>
            {t('ctx.file.delete')}
          </button>
        </>
      ) : null}
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
