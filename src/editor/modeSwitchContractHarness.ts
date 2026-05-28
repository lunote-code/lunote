import {
  getModeSwitchBlockGeometryKind,
  isModeSwitchExplicitAtomicLeafType,
} from './modeSwitchBlockGeometry'
import { getBlockEditingPolicy } from './blockEditingPolicy'
import { locateFrozenRow } from './modeSwitchFrozenLookup'
import type { FrozenStructuralIR } from './modeSwitchStructuralIR'

export type ModeSwitchContractCase = {
  readonly id: string
  readonly description: string
  readonly run: () => void
}

export type ModeSwitchContractResult = {
  readonly id: string
  readonly description: string
  readonly ok: boolean
  readonly reason: string | null
}

function expectEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const MODE_SWITCH_CONTRACT_CASES: readonly ModeSwitchContractCase[] = Object.freeze([
  {
    id: 'geometry-kind-mapping',
    description: '几何分类应稳定覆盖 fence / collapsed / zero-payload / container / textblock',
    run: () => {
      expectEqual(getModeSwitchBlockGeometryKind('codeBlock'), 'atomic_fence', 'codeBlock geometry')
      expectEqual(getModeSwitchBlockGeometryKind('mermaidBlock'), 'collapsed_atom_carrier', 'mermaid geometry')
      expectEqual(getModeSwitchBlockGeometryKind('rawBlock'), 'collapsed_atom_carrier', 'rawBlock geometry')
      expectEqual(getModeSwitchBlockGeometryKind('blockMath'), 'collapsed_atom_carrier', 'blockMath geometry')
      expectEqual(
        getModeSwitchBlockGeometryKind('linkReferenceDef'),
        'collapsed_atom_carrier',
        'linkReferenceDef geometry',
      )
      expectEqual(getModeSwitchBlockGeometryKind('tocDirective'), 'collapsed_atom_carrier', 'tocDirective geometry')
      expectEqual(getModeSwitchBlockGeometryKind('horizontalRule'), 'zero_payload_structural', 'horizontalRule geometry')
      expectEqual(getModeSwitchBlockGeometryKind('table'), 'atomic_container', 'table geometry')
      expectEqual(getModeSwitchBlockGeometryKind('paragraph'), 'textblock', 'paragraph geometry')
    },
  },
  {
    id: 'explicit-atomic-leaf-boundary',
    description: 'leaf-row 原子收口只由 geometry 控制，普通 textblock 不应被误判为 atomic',
    run: () => {
      expectEqual(isModeSwitchExplicitAtomicLeafType('codeBlock'), true, 'codeBlock atomic leaf')
      expectEqual(isModeSwitchExplicitAtomicLeafType('table'), true, 'table atomic leaf')
      expectEqual(isModeSwitchExplicitAtomicLeafType('horizontalRule'), true, 'horizontalRule atomic leaf')
      expectEqual(isModeSwitchExplicitAtomicLeafType('paragraph'), false, 'paragraph atomic leaf')
      expectEqual(isModeSwitchExplicitAtomicLeafType('heading'), false, 'heading atomic leaf')
    },
  },
  {
    id: 'editing-policy-separate-from-geometry',
    description: '编辑策略与 freeze geometry 必须保持解耦，不能互相直接推导',
    run: () => {
      const codeBlock = getBlockEditingPolicy('codeBlock')
      expectEqual(getModeSwitchBlockGeometryKind('codeBlock'), 'atomic_fence', 'codeBlock geometry')
      expectEqual(codeBlock.primaryPreference, 'visual_preferred', 'codeBlock preference')
      expectEqual(codeBlock.sourceIslandCandidate, true, 'codeBlock source island')

      const table = getBlockEditingPolicy('table')
      expectEqual(getModeSwitchBlockGeometryKind('table'), 'atomic_container', 'table geometry')
      expectEqual(table.primaryPreference, 'visual_preferred', 'table preference')
      expectEqual(table.sourceIslandCandidate, false, 'table source island')

      const linkReferenceDef = getBlockEditingPolicy('linkReferenceDef')
      expectEqual(
        getModeSwitchBlockGeometryKind('linkReferenceDef'),
        'collapsed_atom_carrier',
        'linkReferenceDef geometry',
      )
      expectEqual(linkReferenceDef.primaryPreference, 'source_preferred', 'linkReferenceDef preference')
      expectEqual(linkReferenceDef.sourceIslandCandidate, false, 'linkReferenceDef source island')

      const tocDirective = getBlockEditingPolicy('tocDirective')
      expectEqual(getModeSwitchBlockGeometryKind('tocDirective'), 'collapsed_atom_carrier', 'tocDirective geometry')
      expectEqual(tocDirective.primaryPreference, 'source_preferred', 'tocDirective preference')
      expectEqual(tocDirective.sourceIslandCandidate, false, 'tocDirective source island')
    },
  },
  {
    id: 'frozen-row-lookup-separate-from-rowkey-encoding',
    description: 'projection 消费层应通过稳定结构字段定位 IR row，而不是依赖 rowKey 编码细节',
    run: () => {
      const ir = Object.freeze({
        canonicalFingerprint: 'test',
        blocks: Object.freeze([
          Object.freeze({
            blockIndex: 0,
            rowKey: 'alpha-row',
            blockPath: Object.freeze([2, 1]),
            blockType: 'paragraph',
            cmStart: 0,
            cmEnd: 3,
            pmStart: 1,
            pmEnd: 4,
            semanticExtent: 3,
            semanticSlices: Object.freeze([
              Object.freeze({
                semanticFrom: 0,
                semanticTo: 4,
                markdownFrom: 0,
                markdownTo: 3,
                pmFrom: 1,
                pmToExclusive: 4,
                kind: 'text' as const,
              }),
            ]),
          }),
        ]),
      }) satisfies FrozenStructuralIR

      expectEqual(locateFrozenRow(ir, { rowKey: 'alpha-row' }).resolution, 'row_key', 'lookup by rowKey')
      expectEqual(
        locateFrozenRow(ir, { blockIndex: 0, blockPath: [2, 1] }).resolution,
        'block_path',
        'lookup by blockPath',
      )
      expectEqual(locateFrozenRow(ir, { blockIndex: 0 }).resolution, 'block_index', 'lookup by blockIndex')
      expectEqual(locateFrozenRow(ir, { rowKey: '2.1' }).resolution, 'missing', 'rowKey encoding should not leak')
    },
  },
]) satisfies readonly ModeSwitchContractCase[]

function evaluateCase(testCase: ModeSwitchContractCase): ModeSwitchContractResult {
  try {
    testCase.run()
    return Object.freeze({
      id: testCase.id,
      description: testCase.description,
      ok: true,
      reason: null,
    })
  } catch (error) {
    return Object.freeze({
      id: testCase.id,
      description: testCase.description,
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}

export function runModeSwitchContractSuite(): readonly ModeSwitchContractResult[] {
  return Object.freeze(MODE_SWITCH_CONTRACT_CASES.map((testCase) => evaluateCase(testCase)))
}

export function assertModeSwitchContractSuite(): {
  readonly results: readonly ModeSwitchContractResult[]
  readonly failures: readonly ModeSwitchContractResult[]
} {
  const results = runModeSwitchContractSuite()
  const failures = results.filter((result) => !result.ok)
  if (failures.length > 0) {
    throw new Error(formatModeSwitchContractSummary(results))
  }
  return Object.freeze({ results, failures: Object.freeze(failures) })
}

export function formatModeSwitchContractSummary(results: readonly ModeSwitchContractResult[]): string {
  const passed = results.filter((result) => result.ok).length
  const failed = results.length - passed
  const lines = [`[mode-switch][contract] passed=${passed} failed=${failed}`]
  for (const result of results) {
    lines.push(`- ${result.id} ${result.ok ? 'ok' : `fail: ${result.reason ?? 'unknown'}`}`)
  }
  return lines.join('\n')
}
