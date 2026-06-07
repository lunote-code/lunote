import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

import { LUNA_TEXT_COLOR_DEFAULT } from '../../editor/lunaTextColor'
import { hexToHsv, hsvToHex, hueToCss, type Hsv } from '../../lib/colorHsv'

type Props = {
  color: string
  onChange: (hex: string) => void
  ariaLabel: string
}

function readHsv(hex: string): Hsv {
  return hexToHsv(hex) ?? hexToHsv(LUNA_TEXT_COLOR_DEFAULT) ?? { h: 145, s: 0.42, v: 0.49 }
}

export function EditorHsvColorPicker({ color, onChange, ariaLabel }: Props) {
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const hsv = readHsv(color)

  const emit = useCallback(
    (next: Hsv) => {
      onChange(hsvToHex(next.h, next.s, next.v))
    },
    [onChange],
  )

  const onSvPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
      emit({ h: hsv.h, s, v })
    },
    [emit, hsv.h],
  )

  const onHuePointer = useCallback(
    (clientX: number) => {
      const el = hueRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      emit({ h: ratio * 360, s: hsv.s, v: hsv.v })
    },
    [emit, hsv.s, hsv.v],
  )

  const dragSv = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    onSvPointer(e.clientX, e.clientY)
    const move = (ev: PointerEvent) => onSvPointer(ev.clientX, ev.clientY)
    const up = () => {
      target.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const dragHue = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    onHuePointer(e.clientX)
    const move = (ev: PointerEvent) => onHuePointer(ev.clientX)
    const up = () => {
      target.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const svStyle = {
    '--picker-hue': hueToCss(hsv.h),
    '--sv-x': `${hsv.s * 100}%`,
    '--sv-y': `${(1 - hsv.v) * 100}%`,
    '--hue-x': `${(hsv.h / 360) * 100}%`,
  } as CSSProperties

  return (
    <div className="editor-format-color-picker" style={svStyle} role="group" aria-label={ariaLabel}>
      <div ref={svRef} className="editor-format-color-picker-sv" onPointerDown={dragSv}>
        <span className="editor-format-color-picker-sv-thumb" aria-hidden />
      </div>
      <div ref={hueRef} className="editor-format-color-picker-hue" onPointerDown={dragHue}>
        <span className="editor-format-color-picker-hue-thumb" aria-hidden />
      </div>
    </div>
  )
}
