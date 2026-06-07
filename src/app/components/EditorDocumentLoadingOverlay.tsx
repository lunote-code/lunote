import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  visible: boolean
}

export function EditorDocumentLoadingOverlay({ t, visible }: Props) {
  if (!visible) return null

  return (
    <div className="editor-document-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="editor-document-loading-spinner" aria-hidden />
      <span className="editor-document-loading-label">{t('app.editor.loading')}</span>
    </div>
  )
}
