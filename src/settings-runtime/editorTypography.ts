/** Document editor font size (px) adjustable range*/
export const EDITOR_FONT_SIZE_MIN = 1
export const EDITOR_FONT_SIZE_MAX = 60

/** CSS falls back to default when font size is not set (consistent with App.css / CM theme)*/
export const EDITOR_FONT_SIZE_FALLBACK_PX = 17

export function normalizeEditorFontSize(raw: unknown): number | undefined {
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseFloat(raw.trim())
        : NaN
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(EDITOR_FONT_SIZE_MIN, Math.min(EDITOR_FONT_SIZE_MAX, Math.round(parsed)))
}

/** Effective px size for display and zoom (unset → CSS fallback). */
export function resolveEffectiveEditorFontSize(raw: unknown): number {
  return normalizeEditorFontSize(raw) ?? EDITOR_FONT_SIZE_FALLBACK_PX
}
