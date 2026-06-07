import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

type VerticalResizeKeyboardOptions = {
  value: number
  min: number
  max: number
  step?: number
  largeStep?: number
  onChange: (next: number) => void
}

export function handleVerticalResizeKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  options: VerticalResizeKeyboardOptions,
): void {
  const step = options.step ?? 16
  const largeStep = options.largeStep ?? step * 4
  let delta: number
  if (event.key === 'ArrowLeft') delta = -step
  else if (event.key === 'ArrowRight') delta = step
  else if (event.key === 'Home') {
    event.preventDefault()
    options.onChange(options.min)
    return
  } else if (event.key === 'End') {
    event.preventDefault()
    options.onChange(options.max)
    return
  } else if (event.key === 'PageDown') delta = -largeStep
  else if (event.key === 'PageUp') delta = largeStep
  else return

  event.preventDefault()
  const next = Math.max(options.min, Math.min(options.max, options.value + delta))
  options.onChange(next)
}
