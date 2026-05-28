import type { Node as PMNode } from '@tiptap/pm/model'
import type { Selection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'
import { inferRuntimeBlocksFromPmDoc, type LunaInferredBlock } from './lunaKernelBlockInference'

/**
 * Block inference diff analyzer — pure validation layer.
 *
 * Responsibility: Read-only comparison of `pmRefs` (PM forEach top-level structure) and `inferRuntimeBlocksFromPmDoc` (inference),
 * And output debug tags such as selections/table relationships/boundaries to find inconsistencies.
 *
 * Explicitly prohibited (to avoid evolving into dual-structural-system):
 * - You may not use an inferred or this report as the primary input for editing or serialization; you may not dispatch, fix docs, or rewrite selections or tables based on them.
 * - Do not introduce a second set of document models or "subject to diff" branching logic into this module.
 * - Only read-only detection and reporting fields are allowed to be enhanced; no consumer (command, sync, FSM) may rely on this layer as authoritative.
 *
 * The "true value" in `pmRefs` only means "PM child node enumeration aligned with forEach", and the authoritative editing state is still subject to PM EditorState.
 */

/** The top-level block reference obtained by PM `doc.forEach` is used for item-by-item comparison with the inferred list.*/
export type LunaPmTopLevelBlockRef = {
  index: number
  type: string
  startPos: number
  endPos: number
  nodeSize: number
}

export type LunaKernelBlockInferenceDiffReport = {
  pmRefs: LunaPmTopLevelBlockRef[]
  missingInInference: LunaPmTopLevelBlockRef[]
  missingInRefs: LunaInferredBlock[]
  mismatchedTypes: Array<{ index: number; pmType: string; inferredType: string }>
  boundaryDifferences: Array<{
    index: number
    pm: { startPos: number; endPos: number }
    inferred: { startPos: number; endPos: number }
  }>
  /** Infer that the adjacent block end on the chain is not connected to the next start (non-zero gap)*/
  inferredChainContinuity: Array<{
    afterIndex: number
    gap: number
    leftEnd: number
    rightStart: number
  }>
  selectionBounds: {
    anchor: number
    head: number
    anchorTopLevelIndex: number
    headTopLevelIndex: number
    spansMultipleTopLevelBlocks: boolean
    anchorOnSomeBlockBoundary: boolean
    headOnSomeBlockBoundary: boolean
    touchesBlockOuterBoundary: boolean
    anchorStrictlyInsideSomeTopLevelBlock: boolean
    headStrictlyInsideSomeTopLevelBlock: boolean
  }
  tableRelation: null | {
    hasTableContext: boolean
    tablePos: number
    mapHeight: number
    mapWidth: number
    /** The table occupies multiple rows in the TableMap sense (regardless of the "top-level block")*/
    tableSpansMultipleGridRows: boolean
    /**
     * Whether the selection anchor/head falls in different top-level doc sub-blocks (for example, from the paragraph before the table to the paragraph after the table).
     * Single table nodes are still one block; this mark indicates that the selection spans multiple top-level PM blocks vertically.
     */
    selectionSpansMultipleTopLevelBlocksWhileInOrNearTable: boolean
  }
}

/**
 * Use `doc.forEach` (PM internal offset accumulation for fragment) to collect top-level block references.
 */
export function collectPmTopLevelBlockRefs(doc: PMNode): LunaPmTopLevelBlockRef[] {
  const out: LunaPmTopLevelBlockRef[] = []
  doc.forEach((node, offset, index) => {
    const startPos = 1 + offset
    const endPos = startPos + node.nodeSize
    out.push({
      index,
      type: node.type.name,
      startPos,
      endPos,
      nodeSize: node.nodeSize,
    })
  })
  return out
}

function posOnAnyInferredOuterBoundary(blocks: LunaInferredBlock[], pos: number): boolean {
  for (const b of blocks) {
    if (pos === b.startPos || pos === b.endPos) return true
  }
  return false
}

function posStrictlyInsideSomeInferredBlock(blocks: LunaInferredBlock[], pos: number): boolean {
  for (const b of blocks) {
    if (pos > b.startPos && pos < b.endPos) return true
  }
  return false
}

function safeTopLevelIndex(doc: PMNode, pos: number): number {
  try {
    const max = doc.content.size + 1
    const p = Math.max(0, Math.min(pos, max))
    return doc.resolve(p).index(0)
  } catch {
    return -1
  }
}

function findTableContext(selection: Selection): {
  tablePos: number
  mapHeight: number
  mapWidth: number
} | null {
  const $from = selection.$from
  for (let d = $from.depth; d > 0; d -= 1) {
    const n = $from.node(d)
    if (n.type.spec.tableRole === 'table') {
      const map = TableMap.get(n)
      return {
        tablePos: $from.before(d),
        mapHeight: map.height,
        mapWidth: map.width,
      }
    }
  }
  return null
}

/**
 * Read-only: Compares PM's top-level forEach reference to the inferred block list, with selection/table relationship flags.
 */
export function analyzeBlockInferenceDiff(
  doc: PMNode,
  selection: Selection,
  inferredOverride?: LunaInferredBlock[],
): LunaKernelBlockInferenceDiffReport {
  const pmRefs = collectPmTopLevelBlockRefs(doc)
  const inferred = inferredOverride ?? inferRuntimeBlocksFromPmDoc(doc)

  const missingInInference: LunaPmTopLevelBlockRef[] = []
  const missingInRefs: LunaInferredBlock[] = []
  const mismatchedTypes: LunaKernelBlockInferenceDiffReport['mismatchedTypes'] = []
  const boundaryDifferences: LunaKernelBlockInferenceDiffReport['boundaryDifferences'] = []

  const nRef = pmRefs.length
  const nInf = inferred.length
  const nMin = Math.min(nRef, nInf)

  for (let i = 0; i < nMin; i += 1) {
    const r = pmRefs[i]
    const inf = inferred[i]
    if (r.type !== inf.type) {
      mismatchedTypes.push({ index: i, pmType: r.type, inferredType: inf.type })
    }
    if (r.startPos !== inf.startPos || r.endPos !== inf.endPos) {
      boundaryDifferences.push({
        index: i,
        pm: { startPos: r.startPos, endPos: r.endPos },
        inferred: { startPos: inf.startPos, endPos: inf.endPos },
      })
    }
  }
  if (nRef > nInf) {
    for (let i = nInf; i < nRef; i += 1) missingInInference.push(pmRefs[i])
  }
  if (nInf > nRef) {
    for (let i = nRef; i < nInf; i += 1) missingInRefs.push(inferred[i])
  }

  const inferredChainContinuity: LunaKernelBlockInferenceDiffReport['inferredChainContinuity'] = []
  for (let i = 0; i < inferred.length - 1; i += 1) {
    const left = inferred[i]
    const right = inferred[i + 1]
    const gap = right.startPos - left.endPos
    if (gap !== 0) {
      inferredChainContinuity.push({
        afterIndex: i,
        gap,
        leftEnd: left.endPos,
        rightStart: right.startPos,
      })
    }
  }

  const anchor = selection.anchor
  const head = selection.head
  const anchorTopLevelIndex = safeTopLevelIndex(doc, anchor)
  const headTopLevelIndex = safeTopLevelIndex(doc, head)
  const spansMultipleTopLevelBlocks =
    anchorTopLevelIndex >= 0 &&
    headTopLevelIndex >= 0 &&
    anchorTopLevelIndex !== headTopLevelIndex

  const anchorOnSomeBlockBoundary = posOnAnyInferredOuterBoundary(inferred, anchor)
  const headOnSomeBlockBoundary = posOnAnyInferredOuterBoundary(inferred, head)
  const touchesBlockOuterBoundary = anchorOnSomeBlockBoundary || headOnSomeBlockBoundary

  const tableCtx = findTableContext(selection)
  let tableRelation: LunaKernelBlockInferenceDiffReport['tableRelation'] = null
  if (tableCtx) {
    tableRelation = {
      hasTableContext: true,
      tablePos: tableCtx.tablePos,
      mapHeight: tableCtx.mapHeight,
      mapWidth: tableCtx.mapWidth,
      tableSpansMultipleGridRows: tableCtx.mapHeight > 1,
      selectionSpansMultipleTopLevelBlocksWhileInOrNearTable: spansMultipleTopLevelBlocks,
    }
  } else if (spansMultipleTopLevelBlocks) {
    tableRelation = {
      hasTableContext: false,
      tablePos: -1,
      mapHeight: 0,
      mapWidth: 0,
      tableSpansMultipleGridRows: false,
      selectionSpansMultipleTopLevelBlocksWhileInOrNearTable: true,
    }
  }

  return {
    pmRefs,
    missingInInference,
    missingInRefs,
    mismatchedTypes,
    boundaryDifferences,
    inferredChainContinuity,
    selectionBounds: {
      anchor,
      head,
      anchorTopLevelIndex,
      headTopLevelIndex,
      spansMultipleTopLevelBlocks,
      anchorOnSomeBlockBoundary,
      headOnSomeBlockBoundary,
      touchesBlockOuterBoundary,
      anchorStrictlyInsideSomeTopLevelBlock: posStrictlyInsideSomeInferredBlock(inferred, anchor),
      headStrictlyInsideSomeTopLevelBlock: posStrictlyInsideSomeInferredBlock(inferred, head),
    },
    tableRelation,
  }
}
