import type { Node as PMNode } from '@tiptap/pm/model'
import { TableMap } from '@tiptap/pm/tables'
import type { LunaInferredBlock } from './lunaKernelBlockInference'
import type { LunaKernelBlockInferenceDiffReport } from './lunaKernelBlockInferenceDiff'

/** Lightweight shape aligned with `LunaKernelPmTableSlice` to avoid circular references from `lunaKernelDebugSnapshot`.*/
export type KernelContractTableSlice = {
  tablePos: number
  mapWidth: number
  mapHeight: number
  nodeType: string
  attrs: Record<string, unknown>
}

/**
 * Kernel Contract verification layer: only "rule description + dev-time read-only check", not the executor, not the state machine, not the second model.
 *
 * - Does not participate in transaction / selection / table mutation, does not overwrite PM based on the results or prevent editing.
 * - Does not replace inference/diff; only superimposes lightweight rule reporting on existing snapshot data.
 * - Not called in production builds (gated by the caller `import.meta.env.DEV`); this module function remains a pure function to facilitate single testing.
 */

export type KernelContractViolation = {
  code: string
  message: string
  detail?: unknown
}

export type KernelContractValidationResult = {
  blockViolations: KernelContractViolation[]
  selectionViolations: KernelContractViolation[]
  tableViolations: KernelContractViolation[]
  summary: 'pass' | 'warning' | 'fail'
}

export type KernelContractValidationInput = {
  doc: PMNode
  inferredBlocks: LunaInferredBlock[]
  blockInferenceDiff: LunaKernelBlockInferenceDiffReport
  table: KernelContractTableSlice | null
  selection: { anchor: number; head: number }
}

function push(
  list: KernelContractViolation[],
  code: string,
  message: string,
  detail?: unknown,
): void {
  list.push(detail !== undefined ? { code, message, detail } : { code, message })
}

/**
 * Pure function: based on PM doc + existing inference/diff slices to output contract alarms (no editor reading, no dispatch).
 */
export function validateKernelContract(input: KernelContractValidationInput): KernelContractValidationResult {
  const { doc, inferredBlocks, blockInferenceDiff, table, selection } = input
  const blockViolations: KernelContractViolation[] = []
  const selectionViolations: KernelContractViolation[] = []
  const tableViolations: KernelContractViolation[] = []

  const { missingInInference, missingInRefs, mismatchedTypes, boundaryDifferences, inferredChainContinuity, selectionBounds } =
    blockInferenceDiff

  for (const r of missingInInference) {
    push(blockViolations, 'BLOCK_MISSING_IN_INFERENCE', 'PM top-level block missing from inference list', r)
  }
  for (const inf of missingInRefs) {
    push(blockViolations, 'BLOCK_MISSING_IN_PM_REFS', 'Inferred block missing from PM forEach refs', inf)
  }
  for (const m of mismatchedTypes) {
    push(blockViolations, 'BLOCK_TYPE_MISMATCH', `Index ${m.index}: PM type ${m.pmType} != inferred ${m.inferredType}`, m)
  }
  for (const b of boundaryDifferences) {
    push(blockViolations, 'BLOCK_BOUNDARY_MISMATCH', `Index ${b.index}: PM vs inferred start/end mismatch`, b)
  }
  for (const c of inferredChainContinuity) {
    push(blockViolations, 'BLOCK_CHAIN_DISCONTINUITY', `Gap after inferred block index ${c.afterIndex}: gap=${c.gap}`, c)
  }

  if (inferredBlocks.length > 0) {
    const first = inferredBlocks[0]
    if (first.startPos !== 1) {
      push(blockViolations, 'BLOCK_FIRST_START_NOT_ONE', `First inferred block startPos should be 1, got ${first.startPos}`)
    }
    const last = inferredBlocks[inferredBlocks.length - 1]
    const expectedLastEnd = doc.nodeSize - 1
    if (last.endPos !== expectedLastEnd) {
      push(
        blockViolations,
        'BLOCK_LAST_END_MISMATCH',
        `Last block endPos should be doc.nodeSize-1=${expectedLastEnd}, got ${last.endPos}`,
        { last, docNodeSize: doc.nodeSize },
      )
    }
  }

  const maxPos = doc.nodeSize
  for (const label of ['anchor', 'head'] as const) {
    const pos = selection[label]
    if (!Number.isFinite(pos) || pos < 0 || pos > maxPos) {
      push(selectionViolations, 'SELECTION_OUT_OF_DOC_RANGE', `${label}=${pos} outside PM range [0, ${maxPos}]`)
    }
  }
  try {
    doc.resolve(selection.anchor)
    doc.resolve(selection.head)
  } catch (e) {
    push(selectionViolations, 'SELECTION_RESOLVE_FAILED', 'Selection anchor/head failed to resolve', e)
  }

  if (selectionBounds.spansMultipleTopLevelBlocks) {
    push(
      selectionViolations,
      'SELECTION_SPANS_MULTIPLE_TOP_LEVEL',
      'Selection anchor/head in different top-level doc blocks (report only, not necessarily invalid)',
      selectionBounds,
    )
  }

  if (table) {
    let nodeAfter: PMNode | null = null
    try {
      const $p = doc.resolve(table.tablePos)
      nodeAfter = $p.nodeAfter
    } catch (e) {
      push(tableViolations, 'TABLE_RESOLVE_FAILED', `Cannot resolve doc at tablePos=${table.tablePos}`, e)
    }
    if (nodeAfter) {
      if (nodeAfter.type.spec.tableRole !== 'table') {
        push(tableViolations, 'TABLE_NODE_NOT_TABLE', 'nodeAfter at tablePos is not a table role', {
          type: nodeAfter.type.name,
          tablePos: table.tablePos,
        })
      } else {
        const map = TableMap.get(nodeAfter)
        if (map.width !== table.mapWidth || map.height !== table.mapHeight) {
          push(
            tableViolations,
            'TABLE_MAP_SLICE_DIVERGE',
            'Snapshot map size does not match current PM node TableMap',
            { slice: { w: table.mapWidth, h: table.mapHeight }, live: { w: map.width, h: map.height } },
          )
        }
        if (nodeAfter.childCount !== map.height) {
          push(
            tableViolations,
            'TABLE_ROW_COUNT_MISMATCH',
            `table.childCount=${nodeAfter.childCount} != TableMap.height=${map.height}`,
            { childCount: nodeAfter.childCount, mapHeight: map.height },
          )
        }
        if (map.width * map.height !== map.map.length) {
          push(tableViolations, 'TABLE_MAP_INTERNAL_INCONSISTENT', 'TableMap width×height != map array length', {
            width: map.width,
            height: map.height,
            mapLen: map.map.length,
          })
        }
        if (map.problems != null && map.problems.length > 0) {
          push(tableViolations, 'TABLE_MAP_REPORTED_PROBLEMS', 'TableMap has problems (report only)', map.problems)
        }
      }
    } else if (!tableViolations.some((v) => v.code === 'TABLE_RESOLVE_FAILED')) {
      push(tableViolations, 'TABLE_NODE_ABSENT', 'No nodeAfter at tablePos', { tablePos: table.tablePos })
    }
  }

  const failCodes = new Set([
    'BLOCK_MISSING_IN_INFERENCE',
    'BLOCK_MISSING_IN_PM_REFS',
    'BLOCK_CHAIN_DISCONTINUITY',
    'BLOCK_FIRST_START_NOT_ONE',
    'BLOCK_LAST_END_MISMATCH',
    'SELECTION_OUT_OF_DOC_RANGE',
    'SELECTION_RESOLVE_FAILED',
    'TABLE_RESOLVE_FAILED',
    'TABLE_NODE_NOT_TABLE',
    'TABLE_NODE_ABSENT',
    'TABLE_MAP_SLICE_DIVERGE',
    'TABLE_ROW_COUNT_MISMATCH',
    'TABLE_MAP_INTERNAL_INCONSISTENT',
  ])

  const warnOnlyCodes = new Set([
    'BLOCK_TYPE_MISMATCH',
    'BLOCK_BOUNDARY_MISMATCH',
    'SELECTION_SPANS_MULTIPLE_TOP_LEVEL',
    'TABLE_MAP_REPORTED_PROBLEMS',
  ])

  const all = [...blockViolations, ...selectionViolations, ...tableViolations]
  const hasFail = all.some((v) => failCodes.has(v.code))
  const hasWarn = all.some((v) => warnOnlyCodes.has(v.code))

  let summary: KernelContractValidationResult['summary'] = 'pass'
  if (hasFail) summary = 'fail'
  else if (hasWarn || all.length > 0) summary = 'warning'

  return { blockViolations, selectionViolations, tableViolations, summary }
}
