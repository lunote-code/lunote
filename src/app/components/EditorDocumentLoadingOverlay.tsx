import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  visible: boolean
  /** i18n key for the status label */
  labelKey?: string
  /** Show an indeterminate progress bar under the label */
  showProgress?: boolean
  /** Stronger backdrop while cold-opening a document (e.g. encrypted disk read). */
  prominent?: boolean
}

export function EditorDocumentLoadingOverlay({
  t,
  visible,
  labelKey = 'app.editor.loading',
  showProgress = false,
  prominent = false,
}: Props) {
  if (!visible) return null

  return (
    <div
      className={`editor-document-loading${showProgress ? ' editor-document-loading--with-progress' : ''}${prominent ? ' editor-document-loading--prominent' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="editor-document-loading-overlay"
    >
      <span className="editor-document-loading-spinner" aria-hidden />
      <span className="editor-document-loading-label">{t(labelKey)}</span>
      {showProgress ? (
        <div
          className="editor-document-loading-progress"
          role="progressbar"
          aria-label={t(labelKey)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="editor-document-loading-progress-bar" />
        </div>
      ) : null}
    </div>
  )
}
