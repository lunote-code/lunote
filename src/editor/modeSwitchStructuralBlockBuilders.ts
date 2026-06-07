import type { Node as PMNode } from 'prosemirror-model'

import { freezeModeSwitchLeafPath } from './modeSwitchLeafRow'
import { collectPmSemanticTokens } from './modeSwitchSemanticTokenizer'
import {
  type MdSemTok,
  mergeAdjacentPmTokens,
  type PmSemTok,
  repartitionPmTokensToMatchMd,
  zipPmMdSemanticTokens,
} from './modeSwitchSemanticZip'
import {
  assertNoSemanticFallback,
  assertSemanticSlicesCoverSemanticSpace,
  assertSemanticTokenDeterminism,
} from './modeSwitchStructuralIRInvariants'
import type { SemanticSlice, SemanticSliceKind } from './modeSwitchStructuralIRTypes'

type RawSegLike = {
  markdownFrom: number
  markdownTo: number
  bodyFrom: number
  bodyTo: number
}

type StrictSemanticCompileFailureArgs = {
  blockIndex: number
  rowKey?: string
  blockType: string
  semanticExtent: number
  segmentBase: number
  bodyRel: number
  bodySeg: string
  reason: string
  canonicalBuffer: string
  pmTok: readonly PmSemTok[]
  mdTok: readonly MdSemTok[] | null
}

function alignFenceBodyMarkdownSpan(
  canonicalBuffer: string,
  bodyFrom: number,
  bodyTo: number,
  semanticExtent: number,
): { markdownFrom: number; markdownTo: number } {
  let to = bodyTo
  while (to - bodyFrom > semanticExtent && to > bodyFrom && canonicalBuffer[to - 1] === '\n') {
    to -= 1
  }
  if (to - bodyFrom > semanticExtent) {
    to = bodyFrom + semanticExtent
  }
  return { markdownFrom: bodyFrom, markdownTo: to }
}

function alignBodyMarkdownSpan(
  canonicalBuffer: string,
  bodyFrom: number,
  bodyTo: number,
  semanticExtent: number,
): { markdownFrom: number; markdownTo: number } {
  if (semanticExtent <= 0) {
    return { markdownFrom: bodyFrom, markdownTo: bodyFrom }
  }
  let to = bodyTo
  while (to - bodyFrom > semanticExtent && to > bodyFrom && canonicalBuffer[to - 1] === '\n') {
    to -= 1
  }
  if (to - bodyFrom > semanticExtent) {
    to = bodyFrom + semanticExtent
  }
  return { markdownFrom: bodyFrom, markdownTo: to }
}

function buildLegacyFallbackArgs(args: {
  blockIndex: number
  rowKey?: string
  blockType: string
  cmStart: number
  cmEnd: number
  pmStart: number
  pmEnd: number
  semanticExtent: number
  semanticSlices: readonly SemanticSlice[]
}) {
  return {
    blockIndex: args.blockIndex,
    rowId: `legacy:${args.blockIndex}`,
    rowKey: `legacy:${args.blockIndex}`,
    blockPath: freezeModeSwitchLeafPath([args.blockIndex]),
    blockType: args.blockType,
    cmStart: args.cmStart,
    cmEnd: args.cmEnd,
    pmStart: args.pmStart,
    pmEnd: args.pmEnd,
    semanticExtent: args.semanticExtent,
    semanticSlices: args.semanticSlices,
  }
}

export function buildFenceSemanticSlices(args: {
  node: PMNode
  raw: RawSegLike
  canonicalBuffer: string
  semanticExtent: number
  pmStart: number
  pmEnd: number
  blockIndex: number
  assertionCtxBase: Record<string, unknown>
}): readonly SemanticSlice[] {
  const rawPm = collectPmSemanticTokens(args.node, args.pmStart)
  const merged = rawPm ? mergeAdjacentPmTokens(rawPm) : []
  const { pmFrom, pmToExclusive } = merged.length
    ? { pmFrom: merged[0]!.pmFrom, pmToExclusive: merged[merged.length - 1]!.pmToExclusive }
    : { pmFrom: args.pmStart, pmToExclusive: args.pmStart + 1 }
  const { markdownFrom, markdownTo } = alignFenceBodyMarkdownSpan(
    args.canonicalBuffer,
    args.raw.bodyFrom,
    args.raw.bodyTo,
    args.semanticExtent,
  )
  const fenceSlices = Object.freeze([
    Object.freeze({
      semanticFrom: 0,
      semanticTo: args.semanticExtent + 1,
      markdownFrom,
      markdownTo,
      kind: 'text' as const,
      pmFrom,
      pmToExclusive,
    }),
  ])
  if (import.meta.env.DEV) {
    assertSemanticSlicesCoverSemanticSpace(
      fenceSlices,
      args.semanticExtent,
      args.canonicalBuffer,
      args.assertionCtxBase,
    )
    assertSemanticTokenDeterminism(
      fenceSlices,
      args.semanticExtent,
      args.canonicalBuffer,
      args.assertionCtxBase,
    )
    assertNoSemanticFallback(
      buildLegacyFallbackArgs({
        blockIndex: args.blockIndex,
        blockType: args.node.type.name,
        cmStart: fenceSlices[0]!.markdownFrom,
        cmEnd: fenceSlices[0]!.markdownTo,
        pmStart: args.pmStart,
        pmEnd: args.pmEnd,
        semanticExtent: args.semanticExtent,
        semanticSlices: fenceSlices,
      }),
    )
  }
  return fenceSlices
}

export function buildAtomicContainerSemanticSlices(args: {
  node: PMNode
  raw: RawSegLike
  canonicalBuffer: string
  semanticExtent: number
  pmStart: number
  blockIndex: number
  rowKey?: string
  tokenizeMarkdownTableBodyToSemanticTokens: (
    bodySeg: string,
    baseAbs: number,
    inheritedPlainKind?: SemanticSliceKind,
  ) => MdSemTok[] | null
  throwStrictSemanticCompileFailure: (args: StrictSemanticCompileFailureArgs) => never
}): readonly SemanticSlice[] {
  const rawPm = collectPmSemanticTokens(args.node, args.pmStart)
  if (rawPm == null) {
    args.throwStrictSemanticCompileFailure({
      blockIndex: args.blockIndex,
      rowKey: args.rowKey,
      blockType: args.node.type.name,
      semanticExtent: args.semanticExtent,
      segmentBase: args.raw.markdownFrom,
      bodyRel: args.raw.bodyFrom - args.raw.markdownFrom,
      bodySeg: args.canonicalBuffer.slice(args.raw.bodyFrom, args.raw.bodyTo),
      reason: 'pm_semantic_token_collect_null',
      canonicalBuffer: args.canonicalBuffer,
      pmTok: [],
      mdTok: null,
    })
  }
  const pmTok = mergeAdjacentPmTokens(rawPm)
  const mdTok = args.tokenizeMarkdownTableBodyToSemanticTokens(
    args.canonicalBuffer.slice(args.raw.markdownFrom, args.raw.markdownTo),
    args.raw.markdownFrom,
    'text',
  )
  const selectedMdTok =
    mdTok != null
      ? (() => {
          const zipped = zipPmMdSemanticTokens(pmTok, mdTok, args.semanticExtent)
          if (zipped != null) return { pmTok, mdTok, zipped }
          const repartitionedPmTok = repartitionPmTokensToMatchMd(pmTok, mdTok)
          if (repartitionedPmTok != null) {
            const repartitionedZip = zipPmMdSemanticTokens(
              repartitionedPmTok,
              mdTok,
              args.semanticExtent,
            )
            if (repartitionedZip != null) {
              return { pmTok: repartitionedPmTok, mdTok, zipped: repartitionedZip }
            }
          }
          return null
        })()
      : null
  if (selectedMdTok == null) {
    args.throwStrictSemanticCompileFailure({
      blockIndex: args.blockIndex,
      rowKey: args.rowKey,
      blockType: args.node.type.name,
      semanticExtent: args.semanticExtent,
      segmentBase: args.raw.markdownFrom,
      bodyRel: args.raw.bodyFrom - args.raw.markdownFrom,
      bodySeg: args.canonicalBuffer.slice(args.raw.bodyFrom, args.raw.bodyTo),
      reason: 'strict_zip_failed_or_semantic_extent_mismatch',
      canonicalBuffer: args.canonicalBuffer,
      pmTok,
      mdTok,
    })
  }
  return Object.freeze(selectedMdTok.zipped.map((slice) => Object.freeze(slice)))
}

export function buildCollapsedAtomCarrierSemanticSlices(args: {
  node: PMNode
  raw: RawSegLike
  canonicalBuffer: string
  semanticExtent: number
  pmStart: number
  pmEnd: number
  blockIndex: number
  assertionCtxBase: Record<string, unknown>
}): readonly SemanticSlice[] {
  const source = String(
    (args.node.attrs as { source?: string } | null | undefined)?.source ?? 'unknown',
  )
  const alignedBody = alignBodyMarkdownSpan(
    args.canonicalBuffer,
    args.raw.bodyFrom,
    args.raw.bodyTo,
    args.semanticExtent,
  )
  const collapsedSlices = Object.freeze([
    Object.freeze({
      semanticFrom: 0,
      semanticTo: args.semanticExtent + 1,
      markdownFrom: alignedBody.markdownFrom,
      markdownTo: alignedBody.markdownTo,
      kind: (source === 'html' ? 'html' : 'text') as SemanticSliceKind,
      pmFrom: args.pmStart,
      pmToExclusive: args.pmStart + 1,
    }),
  ])
  if (import.meta.env.DEV) {
    assertSemanticSlicesCoverSemanticSpace(
      collapsedSlices,
      args.semanticExtent,
      args.canonicalBuffer,
      { ...args.assertionCtxBase, source },
    )
    assertNoSemanticFallback(
      buildLegacyFallbackArgs({
        blockIndex: args.blockIndex,
        blockType: args.node.type.name,
        cmStart: collapsedSlices[0]!.markdownFrom,
        cmEnd: collapsedSlices[0]!.markdownTo,
        pmStart: args.pmStart,
        pmEnd: args.pmEnd,
        semanticExtent: args.semanticExtent,
        semanticSlices: collapsedSlices,
      }),
    )
  }
  return collapsedSlices
}

export function buildZeroPayloadStructuralSemanticSlices(args: {
  node: PMNode
  raw: RawSegLike
  canonicalBuffer: string
  semanticExtent: number
  pmStart: number
  pmEnd: number
  blockIndex: number
  assertionCtxBase: Record<string, unknown>
}): readonly SemanticSlice[] {
  const structuralSlices = Object.freeze([
    Object.freeze({
      semanticFrom: 0,
      semanticTo: 1,
      markdownFrom: args.raw.markdownFrom,
      markdownTo: args.raw.markdownFrom,
      kind: 'text' as const,
      pmFrom: args.pmStart,
      pmToExclusive: args.pmStart + 1,
    }),
  ])
  if (import.meta.env.DEV) {
    assertSemanticSlicesCoverSemanticSpace(
      structuralSlices,
      args.semanticExtent,
      args.canonicalBuffer,
      args.assertionCtxBase,
    )
    assertSemanticTokenDeterminism(
      structuralSlices,
      args.semanticExtent,
      args.canonicalBuffer,
      args.assertionCtxBase,
    )
    assertNoSemanticFallback(
      buildLegacyFallbackArgs({
        blockIndex: args.blockIndex,
        blockType: args.node.type.name,
        cmStart: structuralSlices[0]!.markdownFrom,
        cmEnd: structuralSlices[0]!.markdownTo,
        pmStart: args.pmStart,
        pmEnd: args.pmEnd,
        semanticExtent: args.semanticExtent,
        semanticSlices: structuralSlices,
      }),
    )
  }
  return structuralSlices
}
