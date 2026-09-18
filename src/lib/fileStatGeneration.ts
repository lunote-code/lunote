import type { MutableRefObject } from 'react'

/** Capture file-stat cache generation before async statNoteFile calls. */
export function captureFileStatGeneration(generationRef: MutableRefObject<number>): number {
  return generationRef.current
}

/** Invalidate in-flight file stat writes after workspace switch or cache clear. */
export function bumpFileStatGeneration(generationRef: MutableRefObject<number>): number {
  generationRef.current += 1
  return generationRef.current
}

export function isFileStatGenerationStale(
  capturedGeneration: number,
  generationRef: MutableRefObject<number>,
): boolean {
  return generationRef.current !== capturedGeneration
}
