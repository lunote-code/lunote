import { Icon } from '../../design-system/icons/Icon'

const LIST_PLACEHOLDER_COUNT = 3
const PREVIEW_LINE_COUNT = 5

type ListSkeletonProps = {
  label: string
  sidebarWidth: number
}

export function DocumentHistoryListLoadingSkeleton({ label, sidebarWidth }: ListSkeletonProps) {
  return (
    <div className="document-history-split document-history-split--loading" aria-busy="true">
      <aside className="document-history-sidebar" style={{ width: sidebarWidth }}>
        <div className="document-history-list document-history-list-loading" role="status" aria-live="polite">
          <p className="document-history-loading-status">
            <Icon name="refresh" size="sm" tone="muted" className="document-history-loading-icon" />
            <span>{label}</span>
          </p>
          {Array.from({ length: LIST_PLACEHOLDER_COUNT }, (_, index) => (
            <div key={index} className="document-history-entry document-history-entry--placeholder">
              <div className="document-history-entry-main">
                <span className="document-history-loading-line document-history-loading-line--time" aria-hidden />
                <span className="document-history-loading-line document-history-loading-line--title" aria-hidden />
                <span className="document-history-loading-line document-history-loading-line--meta" aria-hidden />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div className="document-history-split-handle document-history-split-handle--placeholder" aria-hidden />
      <section className="document-history-preview-panel">
        <DocumentHistoryPreviewLoadingSkeleton label={label} />
      </section>
    </div>
  )
}

type PreviewSkeletonProps = {
  label: string
}

export function DocumentHistoryPreviewLoadingSkeleton({ label }: PreviewSkeletonProps) {
  return (
    <div className="document-history-preview-body preview-pane">
      <div className="document-history-preview-loading" role="status" aria-live="polite" aria-busy="true">
        <p className="document-history-loading-status">
          <Icon name="refresh" size="sm" tone="muted" className="document-history-loading-icon" />
          <span>{label}</span>
        </p>
        <div className="document-history-preview-skeleton" aria-hidden>
          <span className="document-history-loading-line document-history-loading-line--preview-title" />
          {Array.from({ length: PREVIEW_LINE_COUNT }, (_, index) => {
            const modifiers =
              index === PREVIEW_LINE_COUNT - 2 ? 'medium' : index === PREVIEW_LINE_COUNT - 1 ? 'short' : ''
            return (
              <span
                key={index}
                className={`document-history-loading-line document-history-loading-line--preview${modifiers ? ` ${modifiers}` : ''}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
