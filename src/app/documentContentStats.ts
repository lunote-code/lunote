import { normalizeLineEndings } from '../lib/normalizeLineEndings'

/** @deprecated Use `normalizeLineEndings` from `src/lib/normalizeLineEndings.ts`. */
export const normalizeDocumentStatsText = normalizeLineEndings

export type DocumentContentStats = {
  /** Non-whitespace character count (status bar "chars"). */
  chars: number
  /** Logical line count after EOL normalization. */
  lines: number
  /** ATX headings `#` … `######` at line start. */
  headings: number
}

/** Selection word count — Latin tokens plus individual CJK characters. */
export function countSelectionWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.match(/[\p{L}\p{N}]+|[\p{Script=Han}]/gu)?.length ?? 0
}

/** Status bar document stats — must stay aligned with the markdown surface being edited. */
export function computeDocumentContentStats(content: string): DocumentContentStats {
  const normalized = normalizeLineEndings(content)
  const plain = normalized.replace(/\s+/g, '')
  const headings = (normalized.match(/^#{1,6}\s+/gm) ?? []).length
  const lines = normalized.length === 0 ? 1 : Math.max(normalized.split('\n').length, 1)
  return {
    chars: plain.length,
    lines,
    headings,
  }
}
