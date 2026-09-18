import type { MutableRefObject } from 'react'

/** Capture the current mode-switch generation before async work (e.g. IME composition wait). */
export function captureModeSwitchGeneration(generationRef: MutableRefObject<number>): number {
  return generationRef.current
}

/** Invalidate in-flight visual↔source transitions (tab switch, workspace switch, cold open). */
export function bumpModeSwitchGeneration(generationRef: MutableRefObject<number>): number {
  generationRef.current += 1
  return generationRef.current
}

export function isModeSwitchStale(
  capturedGeneration: number,
  generationRef: MutableRefObject<number>,
): boolean {
  return generationRef.current !== capturedGeneration
}
