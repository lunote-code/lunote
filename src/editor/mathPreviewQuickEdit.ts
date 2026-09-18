export const MATH_PREVIEW_QUICK_EDIT_DELAY_MS = 280

/** Cancel the delayed formula editor when the next pointer is outside the math block. */
export function shouldCancelMathPreviewQuickEdit(hostContainsTarget: boolean | null): boolean {
  return hostContainsTarget !== true
}
