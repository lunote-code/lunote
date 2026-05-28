import { useI18n } from '../../../i18n'

type Props = {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function KnowledgeSurfaceSplitHandle({ onPointerDown }: Props) {
  const { t } = useI18n()
  return (
    <div
      className="kos-surface-split-divider resize-handle resize-handle-knowledge"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('knowledge.resize.aria')}
      onPointerDown={onPointerDown}
    />
  )
}
