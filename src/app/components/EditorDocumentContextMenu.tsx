import type { RefObject } from 'react'
import { useI18n } from '../../i18n'
import { useContextMenuKeyboardNav } from '../../lib/useContextMenuKeyboardNav'
import { useClampedMenuPosition } from '../../lib/useClampedMenuPosition'
import type { EditorDocMenuPick, EditorDocMenuState } from '../workspace/contextMenuTypes'

export function EditorDocumentContextMenu({
  state,
  menuRef,
  diskFileReady,
  canRevealInOs,
  onPick,
}: {
  state: EditorDocMenuState
  menuRef: RefObject<HTMLDivElement | null>
  diskFileReady: boolean
  canRevealInOs: boolean
  onPick: (action: EditorDocMenuPick) => void
}) {
  const { t } = useI18n()
  const { x, y } = state
  const openKey = `${x}:${y}:${diskFileReady}:${canRevealInOs}`

  const { onKeyDown } = useContextMenuKeyboardNav(menuRef, openKey, {
    autoFocusOnOpen: false,
  })

  const { x: menuX, y: menuY } = useClampedMenuPosition(menuRef, { x, y }, openKey)

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className="file-ctx-menu"
      style={{ left: menuX, top: menuY }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
    >
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('cut')}>
        {t('ctx.editor.cut')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('copy')}>
        {t('ctx.editor.copy')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('paste')}>
        {t('ctx.editor.paste')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('openTab')}>
        {t('ctx.editor.openTab')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('save')}>
        {t('ctx.editor.save')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('rename')}>
        {t('ctx.editor.rename')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('revert')}>
        {t('ctx.editor.revert')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('copyPath')}>
        {t('ctx.editor.copyPath')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!canRevealInOs} onClick={() => onPick('reveal')}>
        {t('ctx.editor.reveal')}
      </button>
    </div>
  )
}
