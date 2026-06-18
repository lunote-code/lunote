import { attachDocumentFrontmatter } from '../editor/documentFrontmatterStore'
import { normalizeLineEndings } from '../lib/normalizeLineEndings'

export type DocumentHistoryDiffKind = 'same' | 'current' | 'snapshot' | 'both'

export type DocumentHistoryDiffRow = {
  lineNo: number
  current: string
  snapshot: string
  kind: DocumentHistoryDiffKind
}

function splitLines(text: string): string[] {
  return normalizeLineEndings(text).split('\n')
}

/** Merge detached YAML/tags into the live editor body before history compare. */
export function normalizeDocumentMarkdownForHistoryCompare(
  path: string,
  markdown: string,
  side: 'current' | 'snapshot',
): string {
  const normalized = normalizeLineEndings(markdown)
  if (!path || side === 'snapshot') return normalized
  return normalizeLineEndings(attachDocumentFrontmatter(path, normalized))
}

export function documentHistoryContentEquals(path: string, current: string, snapshot: string): boolean {
  return (
    normalizeDocumentMarkdownForHistoryCompare(path, current, 'current') ===
    normalizeDocumentMarkdownForHistoryCompare(path, snapshot, 'snapshot')
  )
}

export function buildDocumentHistoryDiffRowsForPath(
  path: string,
  current: string,
  snapshot: string,
): DocumentHistoryDiffRow[] {
  return buildDocumentHistoryDiffRows(
    normalizeDocumentMarkdownForHistoryCompare(path, current, 'current'),
    normalizeDocumentMarkdownForHistoryCompare(path, snapshot, 'snapshot'),
  )
}

export function buildDocumentHistoryDiffRows(current: string, snapshot: string): DocumentHistoryDiffRow[] {
  const currentLines = splitLines(current)
  const snapshotLines = splitLines(snapshot)
  const max = Math.max(currentLines.length, snapshotLines.length)
  const rows: DocumentHistoryDiffRow[] = []

  for (let i = 0; i < max; i += 1) {
    const currentLine = currentLines[i] ?? ''
    const snapshotLine = snapshotLines[i] ?? ''
    const kind: DocumentHistoryDiffKind =
      currentLine === snapshotLine
        ? 'same'
        : !currentLine && snapshotLine
          ? 'snapshot'
          : currentLine && !snapshotLine
            ? 'current'
            : 'both'

    rows.push({
      lineNo: i + 1,
      current: currentLine,
      snapshot: snapshotLine,
      kind,
    })
  }

  return rows
}
