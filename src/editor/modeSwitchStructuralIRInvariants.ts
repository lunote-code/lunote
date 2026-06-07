import type { FrozenGeometryRow, SemanticSlice } from './modeSwitchStructuralIRTypes'

type PmSemTok = {
  text: string
  kind: FrozenGeometryRow['semanticSlices'][number]['kind']
  pmFrom: number
  pmToExclusive: number
}

type MdSemTok = {
  text: string
  kind: FrozenGeometryRow['semanticSlices'][number]['kind']
  markdownFrom: number
  markdownTo: number
}

function normalizeCanonicalPayloadForSemanticText(payload: string, semanticText: string): string {
  if (payload === '\\' && semanticText === '\n') return '\n'
  return payload
}

/** DEV: PM/Markdown semantic token streams must be identical token-by-token before zipping (except for freeze proven invariants, which are asserted again).*/
export function assertStrictSemanticTokenParity(
  pm: readonly PmSemTok[],
  md: readonly MdSemTok[],
  semanticExtent: number,
  canonicalBuffer: string,
): void {
  if (!import.meta.env.DEV) return
  const fail = (msg: string, extra?: Record<string, unknown>) => {
    console.error('[mode-switch] assertStrictSemanticTokenParity', msg, extra)
    throw new Error(`[mode-switch] ${msg}`)
  }
  if (pm.length !== md.length) {
    fail('PM / Markdown token count mismatch', { pmLen: pm.length, mdLen: md.length })
  }
  let join = 0
  for (let i = 0; i < pm.length; i += 1) {
    const p = pm[i]!
    const m = md[i]!
    if (p.kind !== m.kind) fail('token kind mismatch', { i, p, m })
    if (p.text !== m.text) fail('token text mismatch', { i, p, m })
    const L = p.text.length
    const mdw = m.markdownTo - m.markdownFrom
    if (L !== mdw) fail('token payload length mismatch', { i, L, mdw, p, m })
    join += L
    if (m.markdownFrom > m.markdownTo) fail('invalid markdown span', { i, m })
    if (i > 0) {
      const prev = md[i - 1]!
      if (m.markdownFrom < prev.markdownTo) {
        fail('markdown token payloads overlap', { i, prev, m })
      }
    }
    if (L > 0) {
      const pay = normalizeCanonicalPayloadForSemanticText(
        canonicalBuffer.slice(m.markdownFrom, m.markdownTo),
        p.text,
      )
      if (pay !== p.text) fail('canonical payload !== PM token text', { i, pay, p })
    }
  }
  if (join !== semanticExtent) {
    fail('joined token text length !== semanticExtent', { join, semanticExtent })
  }
}

/**
 * DEV: Verify that `semanticSlices` is a piecewise monotonic coverage of [0, semanticExtent] (failure throw).
 */
export function assertSemanticSlicesCoverSemanticSpace(
  slices: readonly SemanticSlice[],
  semanticExtent: number,
  canonicalBuffer: string,
  ctx?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return
  const safeStringify = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const fail = (msg: string, extra?: Record<string, unknown>) => {
    console.error('[mode-switch] assertSemanticSlicesCoverSemanticSpace', msg, extra)
    console.error(
      '[mode-switch] assertSemanticSlicesCoverSemanticSpace detail',
      safeStringify({
        msg,
        semanticExtent,
        expectedSemanticToExclusive: semanticExtent + 1,
        actualSemanticToExclusive: slices[slices.length - 1]?.semanticTo ?? null,
        sliceCount: slices.length,
        slices: slices.map((s, i) => ({
          i,
          semanticFrom: s.semanticFrom,
          semanticTo: s.semanticTo,
          markdownFrom: s.markdownFrom,
          markdownTo: s.markdownTo,
          markdownLen: s.markdownTo - s.markdownFrom,
          pmFrom: s.pmFrom,
          pmToExclusive: s.pmToExclusive,
          pmLen: s.pmToExclusive - s.pmFrom,
          kind: s.kind,
        })),
        ctx: ctx ?? null,
        extra: extra ?? null,
      }),
    )
    throw new Error(`[mode-switch] ${msg}`)
  }
  const canonicalLen = canonicalBuffer.length
  if (!slices.length) fail('empty semanticSlices')
  if (slices[0]!.semanticFrom !== 0) fail('slices must start at semantic 0', { first: slices[0] })
  if (slices[slices.length - 1]!.semanticTo !== semanticExtent + 1) {
    fail('slices must end at semanticExtent + 1 (exclusive)', {
      last: slices[slices.length - 1],
      semanticExtent,
      slices,
      ...ctx,
    })
  }
  for (let i = 0; i < slices.length; i += 1) {
    const s = slices[i]!
    if (s.semanticFrom >= s.semanticTo) fail('semanticFrom >= semanticTo (exclusive)', { i, s })
    if (s.markdownFrom > s.markdownTo) fail('markdownFrom > markdownTo', { i, s })
    if (canonicalLen > 0 && (s.markdownFrom < 0 || s.markdownTo > canonicalLen)) {
      fail('markdown slice out of canonical buffer', { i, s, canonicalLen })
    }
    if (i > 0) {
      const p = slices[i - 1]!
      if (s.semanticFrom !== p.semanticTo - 1) {
        fail('semantic slices not boundary-overlapped by one semantic unit', { i, prev: p, cur: s })
      }
      if (s.markdownFrom < p.markdownTo) {
        fail('markdown slices not monotone / overlap', { i, prev: p, cur: s })
      }
    }
  }
}

/**
 * DEV: frozen semantic token numerical invariant (payload length ↔ semantic half-open width ↔ PM span; payload total length ↔ semanticExtent).
 */
export function assertSemanticTokenDeterminism(
  slices: readonly SemanticSlice[],
  semanticExtent: number,
  canonicalBuffer: string,
  ctx?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return
  const safeStringify = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const fail = (msg: string, extra?: Record<string, unknown>) => {
    console.error('[mode-switch] assertSemanticTokenDeterminism', msg, extra)
    console.error(
      '[mode-switch] assertSemanticTokenDeterminism detail',
      safeStringify({
        msg,
        semanticExtent,
        sliceCount: slices.length,
        slices: slices.map((s, i) => ({
          i,
          semanticFrom: s.semanticFrom,
          semanticTo: s.semanticTo,
          markdownFrom: s.markdownFrom,
          markdownTo: s.markdownTo,
          markdownLen: s.markdownTo - s.markdownFrom,
          pmFrom: s.pmFrom,
          pmToExclusive: s.pmToExclusive,
          pmLen: s.pmToExclusive - s.pmFrom,
          kind: s.kind,
          markdownPreview:
            s.markdownTo > s.markdownFrom
              ? canonicalBuffer.slice(s.markdownFrom, Math.min(s.markdownTo, s.markdownFrom + 120))
              : '',
        })),
        ctx: ctx ?? null,
        extra: extra ?? null,
      }),
    )
    throw new Error(`[mode-switch] ${msg}`)
  }
  for (let i = 0; i < slices.length; i += 1) {
    const s = slices[i]!
    const semW = s.semanticTo - s.semanticFrom
    if (semW < 1) fail('empty semantic span', { i, s })
    const L = s.markdownTo - s.markdownFrom
    if (L !== semW - 1) {
      if (!(L === 0 && semW === 1)) {
        fail('markdown payload length !== semantic intra width - 1', { i, s, semW, L, ...ctx })
      }
    }
    const pmW = s.pmToExclusive - s.pmFrom
    if (L > 0 && (pmW < 1 || pmW > L)) {
      fail('PM span outside supported range for markdown payload', { i, s, pmW, L })
    }
    if (L === 0 && semW === 1 && pmW > 1) {
      fail('degenerate semantic token has oversized PM span', { i, s, pmW })
    }
    if (L > 0) {
      const pay = canonicalBuffer.slice(s.markdownFrom, s.markdownTo)
      if (pay.length !== L) fail('canonical slice length mismatch', { i, s })
    }
  }
  let sumL = 0
  for (const s of slices) {
    sumL += s.markdownTo - s.markdownFrom
  }
  if (sumL !== semanticExtent) {
    fail('sum of markdown payloads !== semanticExtent', { sumL, semanticExtent, slices, ...ctx })
  }
}

/**
 * DEV: Disable legacy "wide range" fallback; and verify that the markdown payload width ↔ semantic half-width of each token is consistent.
 */
export function assertNoSemanticFallback(row: FrozenGeometryRow): void {
  if (!import.meta.env.DEV) return
  const { semanticSlices: slices, cmStart, cmEnd, semanticExtent } = row
  for (let i = 0; i < slices.length; i += 1) {
    const s = slices[i]!
    const semW = s.semanticTo - s.semanticFrom
    const L = s.markdownTo - s.markdownFrom
    if (L !== semW - 1 && !(L === 0 && semW === 1)) {
      throw new Error(
        `[mode-switch] assertNoSemanticFallback: markdown payload vs semantic intra width mismatch (slice ${i})`,
      )
    }
  }
  let sumL = 0
  for (const s of slices) {
    sumL += s.markdownTo - s.markdownFrom
  }
  if (sumL !== semanticExtent) {
    throw new Error('[mode-switch] assertNoSemanticFallback: sum(markdown payload) !== semanticExtent')
  }
  if (slices.length === 1) {
    const s0 = slices[0]!
    const L = s0.markdownTo - s0.markdownFrom
    const rowSpan = cmEnd - cmStart
    if (L === rowSpan && L > semanticExtent + 2) {
      throw new Error(
        '[mode-switch] assertNoSemanticFallback: suspicious wide single-slice markdown span (legacy heuristic fallback)',
      )
    }
  }
}
