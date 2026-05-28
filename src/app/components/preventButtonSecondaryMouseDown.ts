import type { MouseEvent as ReactMouseEvent } from 'react'

export function preventButtonSecondaryMouseDown(e: ReactMouseEvent): void {
  if (e.button === 2) e.preventDefault()
}
