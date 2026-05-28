import type { Node as PMNode } from 'prosemirror-model'

/** Press `documentKey` to remember the most recent ⌘/ successfully mapped (pm, cm). It is forbidden to use 0 / as a "hard" rollback at the end of the document.*/
const lastByDocumentKey = new Map<string, { pm: number; cm: number }>()

export function recordModeSwitchGoodAnchor(documentKey: string, pm: number, cm: number): void {
  if (!documentKey || !Number.isFinite(pm) || !Number.isFinite(cm)) return
  lastByDocumentKey.set(documentKey, { pm: Math.round(pm), cm: Math.round(cm) })
}

export function getModeSwitchGoodAnchor(documentKey: string): { pm: number; cm: number } | null {
  return lastByDocumentKey.get(documentKey) ?? null
}

/** CM subscripts are limited to `[0, mdLen]` (consistent with CodeMirror `doc` legal range)*/
export function clampCmToMarkdownLen(cm: number, mdLen: number): number {
  if (!Number.isFinite(mdLen) || mdLen <= 0) return 0
  return Math.max(0, Math.min(Math.round(cm), mdLen))
}

/**
 * Structural midpoint that has nothing to do with "beginning of text / end of text / 0": find a stable PM pos in the doc that can fall into TextSelection,
 * It is only used as a cold start when there is no lastGood yet, and is not used as a replacement for the user's editing position.
 */
export function stableStructuralPmHint(doc: PMNode): number {
  const max = doc.content.size
  if (!Number.isFinite(max) || max < 1) return 1
  if (!doc.childCount) return 1

  const midBlock = Math.max(0, Math.floor((doc.childCount - 1) / 2))
  let scan = 1
  for (let j = 0; j < midBlock; j += 1) scan += doc.child(j).nodeSize
  const block = doc.child(midBlock)
  const innerStart = scan + 1
  const innerEnd = scan + 1 + Math.max(0, block.content.size)
  let p = Math.min(Math.max(innerStart, Math.round((innerStart + innerEnd) / 2)), innerEnd)

  for (let tries = 0; tries < 48; tries += 1) {
    try {
      const $p = doc.resolve(p)
      if ($p.parent.isTextblock) {
        const s = $p.start()
        const e = $p.end()
        if (e > s) return Math.min(Math.max(p, s + 1), e - 1)
      }
    } catch {
      /* fall through */
    }
    if (p > innerStart) p -= 1
    else p = Math.min(innerEnd, innerStart + 1)
  }
  return Math.min(Math.max(1, innerStart), max)
}
