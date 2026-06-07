import type {
  SemanticSlice,
  SemanticSliceKind,
} from './modeSwitchStructuralIRTypes'

export type PmSemTok = {
  text: string
  kind: SemanticSliceKind
  pmFrom: number
  pmToExclusive: number
}

export type MdSemTok = {
  text: string
  kind: SemanticSliceKind
  markdownFrom: number
  markdownTo: number
}

export function mergeAdjacentMdTokens(toks: readonly MdSemTok[]): MdSemTok[] {
  if (!toks.length) return []
  const merged: MdSemTok[] = [{ ...toks[0]! }]
  for (let i = 1; i < toks.length; i += 1) {
    const next = toks[i]!
    const last = merged[merged.length - 1]!
    const crossesHardBreakBoundary = last.text === '\n' || next.text === '\n'
    if (
      last.kind === next.kind &&
      last.markdownTo === next.markdownFrom &&
      !crossesHardBreakBoundary
    ) {
      merged[merged.length - 1] = {
        text: last.text + next.text,
        kind: last.kind,
        markdownFrom: last.markdownFrom,
        markdownTo: next.markdownTo,
      }
    } else {
      merged.push({ ...next })
    }
  }
  return merged
}

export function zipPmMdSemanticTokens(
  pm: readonly PmSemTok[],
  md: readonly MdSemTok[],
  semanticExtent: number,
): SemanticSlice[] | null {
  if (pm.length !== md.length) return null
  for (let i = 0; i < pm.length; i += 1) {
    if (pm[i]!.kind !== md[i]!.kind) return null
    if (pm[i]!.text !== md[i]!.text) return null
    const length = pm[i]!.text.length
    const markdownWidth = md[i]!.markdownTo - md[i]!.markdownFrom
    if (length !== markdownWidth) return null
  }
  const slices: SemanticSlice[] = []
  let base = 0
  for (let i = 0; i < pm.length; i += 1) {
    const p = pm[i]!
    const m = md[i]!
    const length = p.text.length
    slices.push({
      semanticFrom: base,
      semanticTo: base + length + 1,
      markdownFrom: m.markdownFrom,
      markdownTo: m.markdownTo,
      kind: p.kind,
      pmFrom: p.pmFrom,
      pmToExclusive: p.pmToExclusive,
    })
    base += length
  }
  if (base !== semanticExtent) return null
  return slices
}

export function repartitionPmTokensToMatchMd(
  pm: readonly PmSemTok[],
  md: readonly MdSemTok[],
): PmSemTok[] | null {
  const repartitioned: PmSemTok[] = []
  let pmIndex = 0
  let pmOffset = 0

  for (const mdTok of md) {
    let remaining = mdTok.text
    let segmentStart: number | null = null
    let segmentEnd: number | null = null

    while (remaining.length > 0) {
      const pmTok = pm[pmIndex]
      if (!pmTok || pmTok.kind !== mdTok.kind) return null

      const pmText = pmTok.text.slice(pmOffset)
      if (!pmText.length) {
        pmIndex += 1
        pmOffset = 0
        continue
      }

      const take = Math.min(remaining.length, pmText.length)
      const pmChunk = pmText.slice(0, take)
      const mdChunk = remaining.slice(0, take)
      if (pmChunk !== mdChunk) return null

      const chunkFrom = pmTok.pmFrom + pmOffset
      const chunkTo = chunkFrom + take
      if (segmentStart == null) segmentStart = chunkFrom
      segmentEnd = chunkTo

      remaining = remaining.slice(take)
      pmOffset += take
      if (pmOffset >= pmTok.text.length) {
        pmIndex += 1
        pmOffset = 0
      }
    }

    if (segmentStart == null || segmentEnd == null) return null
    repartitioned.push({
      text: mdTok.text,
      kind: mdTok.kind,
      pmFrom: segmentStart,
      pmToExclusive: segmentEnd,
    })
  }

  if (pmIndex < pm.length - 1) return null
  if (pmIndex === pm.length - 1 && pmOffset !== pm[pmIndex]!.text.length) return null
  return repartitioned
}

export function mergeAdjacentPmTokens(toks: PmSemTok[]): PmSemTok[] {
  if (!toks.length) return []
  const merged: PmSemTok[] = [{ ...toks[0]! }]
  for (let i = 1; i < toks.length; i += 1) {
    const next = toks[i]!
    const last = merged[merged.length - 1]!
    const crossesHardBreakBoundary = last.text === '\n' || next.text === '\n'
    if (
      last.kind === next.kind &&
      last.pmToExclusive === next.pmFrom &&
      !crossesHardBreakBoundary
    ) {
      merged[merged.length - 1] = {
        text: last.text + next.text,
        kind: last.kind,
        pmFrom: last.pmFrom,
        pmToExclusive: next.pmToExclusive,
      }
    } else {
      merged.push({ ...next })
    }
  }
  return merged
}
