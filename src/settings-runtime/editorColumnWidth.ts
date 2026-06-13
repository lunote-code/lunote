export const EDITOR_COLUMN_WIDTH_DEFAULT = 860

export const EDITOR_COLUMN_WIDTH_OPTIONS = [560, 720, 860, 960, 1080, 1200] as const

export type EditorColumnWidthPx = (typeof EDITOR_COLUMN_WIDTH_OPTIONS)[number]

const EDITOR_COLUMN_WIDTH_OPTION_SET = new Set<number>(EDITOR_COLUMN_WIDTH_OPTIONS)

export function normalizeEditorColumnWidth(raw: unknown): EditorColumnWidthPx {
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseInt(raw.trim(), 10)
        : NaN
  if (EDITOR_COLUMN_WIDTH_OPTION_SET.has(parsed)) {
    return parsed as EditorColumnWidthPx
  }
  return EDITOR_COLUMN_WIDTH_DEFAULT
}

export function resolveEffectiveEditorColumnWidth(raw: unknown): EditorColumnWidthPx {
  return normalizeEditorColumnWidth(raw)
}
