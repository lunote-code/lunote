export type DocumentHistoryDiffKind = 'same' | 'current' | 'snapshot' | 'both'

export type DocumentHistoryDiffRow = {
  lineNo: number
  current: string
  snapshot: string
  kind: DocumentHistoryDiffKind
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
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
