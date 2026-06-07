import type { ExternalDropZone } from '../workspace/externalFileDrag'
import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  visible: boolean
  zone: ExternalDropZone | null
}

export function WorkspaceExternalDropOverlay({ t, visible, zone }: Props) {
  if (!visible) return null

  const hintKey =
    zone === 'editor'
      ? 'app.drop.overlayEditor'
      : zone === 'sidebar'
        ? 'app.drop.overlaySidebar'
        : 'app.drop.overlayGeneric'

  return (
    <div className="workspace-external-drop-overlay" aria-hidden>
      <div className="workspace-external-drop-overlay-card">
        <p className="workspace-external-drop-overlay-title">{t('app.drop.overlayTitle')}</p>
        <p className="workspace-external-drop-overlay-hint">{t(hintKey)}</p>
      </div>
    </div>
  )
}
