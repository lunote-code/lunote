import { useRef, type RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { WorkspaceTemplateSelect } from '../../templates/workspaceTemplateSelect'
import { useImeCompositionGuard } from '../../lib/keyboardIme'
import { useFocusTrap } from '../../lib/useFocusTrap'
import type { RenameDialogState } from '../workspace/types'

type Props = {
  t: TranslateFn
  renameDialog: RenameDialogState | null
  renameInputValue: string
  renameError: string
  renameSubmitting: boolean
  renameInputRef: RefObject<HTMLInputElement | null>
  onRenameInputChange: (value: string) => void
  onRenameSubmit: () => void
  onRenameClose: () => void
  onRenameTemplateChange: (templatePath: string) => void
}

export function AppRenameDialog({
  t,
  renameDialog,
  renameInputValue,
  renameError,
  renameSubmitting,
  renameInputRef,
  onRenameInputChange,
  onRenameSubmit,
  onRenameClose,
  onRenameTemplateChange,
}: Props) {
  const renameIme = useImeCompositionGuard()
  const renameDialogRef = useRef<HTMLDivElement | null>(null)
  const renameCancelButtonRef = useRef<HTMLButtonElement | null>(null)

  useFocusTrap(Boolean(renameDialog), renameDialogRef.current, {
    initialFocus: renameInputRef.current ?? renameCancelButtonRef.current,
    onEscape: renameSubmitting ? undefined : onRenameClose,
  })

  if (!renameDialog) return null

  return (
    <div
      className="about-modal-backdrop"
      role="presentation"
      onClick={renameSubmitting ? undefined : onRenameClose}
    >
      <div
        ref={renameDialogRef}
        className="about-modal rename-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rename-title" className="about-modal-title">
          {renameDialog.mode === 'newFolder'
            ? t('ctx.file.newFolder')
            : renameDialog.mode === 'newNote' || renameDialog.mode === 'newNoteFromTemplate'
              ? t('app.dialog.noteNewTitle')
              : renameDialog.isDirectory
                ? t('app.rename.folderTitle')
                : t('app.rename.fileTitle')}
        </h2>
        <p className="about-modal-desc">
          {renameDialog.mode === 'newFolder'
            ? t('app.dialog.folderNew')
            : renameDialog.mode === 'newNote'
              ? t('app.dialog.noteNewHint')
              : renameDialog.mode === 'newNoteFromTemplate'
                ? t('app.dialog.noteNewFromTemplateHint')
                : t('app.rename.hint')}
        </p>
        {renameDialog.mode === 'newNoteFromTemplate' ? (
          <label className="rename-modal-field">
            <span className="rename-modal-field-label">{t('app.dialog.noteTemplateLabel')}</span>
            <WorkspaceTemplateSelect
              rootDir={renameDialog.root}
              value={renameDialog.templatePath ?? 'Templates/Default.md'}
              disabled={renameSubmitting}
              ariaLabel={t('app.dialog.noteTemplateLabel')}
              t={t}
              onValueChange={onRenameTemplateChange}
            />
          </label>
        ) : null}
        <label className="rename-modal-field">
          {renameDialog.mode === 'newNote' || renameDialog.mode === 'newNoteFromTemplate' ? (
            <span className="rename-modal-field-label">{t('app.dialog.noteNameLabel')}</span>
          ) : null}
          <input
            ref={renameInputRef}
            className="rename-modal-input"
            value={renameInputValue}
            placeholder={
              renameDialog.mode === 'newNote' || renameDialog.mode === 'newNoteFromTemplate'
                ? t('app.dialog.noteNewPlaceholder', { default: t('app.defaults.newNoteStem') })
                : undefined
            }
            onChange={(e) => onRenameInputChange(e.target.value)}
            onCompositionStart={renameIme.onCompositionStart}
            onCompositionEnd={renameIme.onCompositionEnd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (renameIme.shouldIgnoreEnter(e) || renameSubmitting) return
                void onRenameSubmit()
              }
              if (e.key === 'Escape' && !renameSubmitting) onRenameClose()
            }}
          />
        </label>
        {renameError ? <p className="rename-modal-error">{renameError}</p> : null}
        <div
          className={
            renameDialog.mode === 'newNoteFromTemplate'
              ? 'rename-modal-actions rename-modal-actions-single'
              : 'rename-modal-actions'
          }
        >
          <button
            ref={renameCancelButtonRef}
            type="button"
            className="about-modal-close rename-modal-cancel"
            disabled={renameSubmitting}
            onClick={onRenameClose}
          >
            {t('app.rename.cancel')}
          </button>
          <button
            type="button"
            className="about-modal-close"
            disabled={renameSubmitting}
            onClick={() => void onRenameSubmit()}
          >
            {renameSubmitting ? t('app.rename.submitting') : t('app.rename.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
