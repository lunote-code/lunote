import { normalizeLineEndings } from './normalizeLineEndings'

export type ThreeWayLineKind = 'same' | 'local' | 'disk' | 'both'

export type ThreeWayMergeRow = {
  lineNo: number
  base: string
  local: string
  disk: string
  kind: ThreeWayLineKind
}

function splitLines(text: string): string[] {
  return normalizeLineEndings(text).split('\n')
}

/**
 * Line-aligned base/local/disk for saving conflicting inline three-way comparisons.
 * base is usually kernel's last saved text (common ancestor approximation).
 */
export function buildThreeWayMergeRows(
  base: string,
  local: string,
  disk: string,
): ThreeWayMergeRow[] {
  const b = splitLines(base)
  const l = splitLines(local)
  const d = splitLines(disk)
  const max = Math.max(b.length, l.length, d.length)
  const rows: ThreeWayMergeRow[] = []

  for (let i = 0; i < max; i += 1) {
    const baseLine = b[i] ?? ''
    const localLine = l[i] ?? ''
    const diskLine = d[i] ?? ''
    let kind: ThreeWayLineKind = 'same'
    if (localLine === diskLine && localLine === baseLine) {
      kind = 'same'
    } else if (localLine !== diskLine) {
      if (localLine === baseLine) kind = 'disk'
      else if (diskLine === baseLine) kind = 'local'
      else kind = 'both'
    } else if (localLine !== baseLine) {
      kind = 'both'
    }
    rows.push({
      lineNo: i + 1,
      base: baseLine,
      local: localLine,
      disk: diskLine,
      kind,
    })
  }
  return rows
}
