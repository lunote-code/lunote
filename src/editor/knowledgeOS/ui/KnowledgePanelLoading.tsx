import { Icon } from '../../../design-system/icons'

type Props = {
  message: string
}

export function KnowledgePanelLoading({ message }: Props) {
  return (
    <div className="kos-panel-loading" role="status" aria-live="polite">
      <Icon name="refresh" size="md" tone="muted" className="kos-panel-loading-icon" />
      <p className="kos-panel-muted">{message}</p>
    </div>
  )
}
