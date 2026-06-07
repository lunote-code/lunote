import { useI18n } from '../../../i18n'
import { handleVerticalResizeKeyDown } from '../../../lib/verticalResizeKeyboard'
import {
  SURFACE_RAIL_MAX_PX,
  SURFACE_RAIL_MIN_PX,
  getSurfaceSplitLayout,
} from '../layout/surfaceSplitLayoutRuntime'

const RAIL_WIDTH_STEP = 16

type Props = {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onRailWidthChange: (nextWidth: number) => void
}

export function KnowledgeSurfaceSplitHandle({ onPointerDown, onRailWidthChange }: Props) {
  const { t } = useI18n()
  const layout = getSurfaceSplitLayout()

  return (
    <div
      className="kos-surface-split-divider resize-handle resize-handle-knowledge"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('knowledge.resize.aria')}
      aria-valuemin={SURFACE_RAIL_MIN_PX}
      aria-valuemax={SURFACE_RAIL_MAX_PX}
      aria-valuenow={layout.railWidth}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        handleVerticalResizeKeyDown(event, {
          value: getSurfaceSplitLayout().railWidth,
          min: SURFACE_RAIL_MIN_PX,
          max: SURFACE_RAIL_MAX_PX,
          step: RAIL_WIDTH_STEP,
          onChange: onRailWidthChange,
        })
      }}
    />
  )
}
