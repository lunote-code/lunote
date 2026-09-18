import type { RefObject } from 'react'
import { useI18n } from '../../i18n'
import { useContextMenuKeyboardNav } from '../../lib/useContextMenuKeyboardNav'
import { useClampedMenuPosition } from '../../lib/useClampedMenuPosition'
import type { EditorDocMenuPick, EditorDocMenuState } from '../workspace/contextMenuTypes'
import { FileContextMenuItem } from './FileContextMenuItem'

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
      <FileContextMenuItem icon="cut" label={t('ctx.editor.cut')} onClick={() => onPick('cut')} />
      <FileContextMenuItem icon="copy" label={t('ctx.editor.copy')} onClick={() => onPick('copy')} />
      <FileContextMenuItem icon="paste" label={t('ctx.editor.paste')} onClick={() => onPick('paste')} />
      <div className="file-ctx-sep" role="separator" />
      <FileContextMenuItem
        icon="tab-new"
        label={t('ctx.editor.openTab')}
        disabled={!diskFileReady}
        onClick={() => onPick('openTab')}
      />
      <FileContextMenuItem icon="save" label={t('ctx.editor.save')} onClick={() => onPick('save')} />
      <FileContextMenuItem
        icon="rename"
        label={t('ctx.editor.rename')}
        disabled={!diskFileReady}
        onClick={() => onPick('rename')}
      />
      <FileContextMenuItem
        icon="refresh"
        label={t('ctx.editor.revert')}
        disabled={!diskFileReady}
        onClick={() => onPick('revert')}
      />
      <div className="file-ctx-sep" role="separator" />
      <FileContextMenuItem
        icon="copy"
        label={t('ctx.editor.copyPath')}
        disabled={!diskFileReady}
        onClick={() => onPick('copyPath')}
      />
      <FileContextMenuItem
        icon="reveal"
        label={t('ctx.editor.reveal')}
        disabled={!canRevealInOs}
        onClick={() => onPick('reveal')}
      />
    </div>
  )
}
