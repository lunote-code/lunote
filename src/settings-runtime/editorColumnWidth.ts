export const EDITOR_COLUMN_WIDTH_DEFAULT = 860

export const EDITOR_COLUMN_WIDTH_OPTIONS = [720, 860, 960] as const

export type EditorColumnWidthPx = (typeof EDITOR_COLUMN_WIDTH_OPTIONS)[number]

export function normalizeEditorColumnWidth(raw: unknown): EditorColumnWidthPx {
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseInt(raw.trim(), 10)
        : NaN
  if (parsed === 720 || parsed === 960) return parsed
  return EDITOR_COLUMN_WIDTH_DEFAULT
}

export function resolveEffectiveEditorColumnWidth(raw: unknown): EditorColumnWidthPx {
  return normalizeEditorColumnWidth(raw)
}
