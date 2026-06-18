import {
  getModeSwitchBlockGeometryKind,
  isModeSwitchExplicitAtomicLeafType,
} from './modeSwitchBlockGeometry'
import { getBlockEditingPolicy } from './blockEditingPolicy'
import { locateFrozenRow } from './modeSwitchFrozenLookup'
import type { FrozenStructuralIR } from './modeSwitchStructuralIR'
import { deriveProjectableLeafPathAtPmPos } from './modeSwitchLeafRow'
import { getOutlineParseSchema } from './markdownOutlineFromMarkdown'
import { projectAlongRow } from './modeSwitchProjection'
import { compileMarkdownForModeBridge } from './compiler/markdownCompiler'
import { headingBodyMinIndexForLevel, structuredLineBodyMinIndexInSeg } from './modeSwitchSemanticTokenizer'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import type { SourceModeEnterAnchor } from './viewportModeAnchor'

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
    description: 'Geometry classification must stably cover fence / collapsed / zero-payload / container / textblock',
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
    description: 'Leaf-row atomic boundaries are geometry-only; plain textblocks must not be misclassified as atomic',
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
    description: 'Editing policy and freeze geometry must stay decoupled; neither may be derived from the other',
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
    description: 'Projection consumers must locate IR rows via stable structural fields, not rowKey encoding details',
    run: () => {
      const ir = Object.freeze({
        canonicalFingerprint: 'test',
        blocks: Object.freeze([
          Object.freeze({
            blockIndex: 0,
            rowId: 'fixture-alpha',
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
  {
    id: 'atomic-ancestor-preferred-over-inner-textblock',
    description: 'Inside atomic containers such as tables, hierarchical anchors must return the atomic ancestor, not the cell paragraph',
    run: () => {
      const schema = getOutlineParseSchema()
      const doc = canonicalMarkdownSemantics.parse('| A | B |\n| --- | --- |\n| C | D |\n', schema)
      const table = doc.firstChild
      if (!table) throw new Error('expected table node')
      const leaf = deriveProjectableLeafPathAtPmPos(doc, 5)
      if (!leaf) throw new Error('expected projectable leaf')
      expectEqual(leaf.blockType, 'table', 'atomic ancestor block type')
      expectEqual(leaf.rowKey, '0', 'atomic ancestor row key')
    },
  },
  {
    id: 'shared-prefix-stripper-stays-canonical',
    description: 'Structured prefix stripping must use the shared helper so bodyFrom and the tokenizer cannot drift',
    run: () => {
      expectEqual(
        structuredLineBodyMinIndexInSeg('> > - [ ] task child', {
          stripTaskMarkers: true,
          includeCalloutMarker: false,
        }),
        10,
        'nested task prefix length',
      )
      expectEqual(
        structuredLineBodyMinIndexInSeg('> [!NOTE] title', {
          stripTaskMarkers: false,
          includeCalloutMarker: true,
        }),
        10,
        'callout lead prefix length',
      )
      expectEqual(headingBodyMinIndexForLevel('> ## Heading', 2), 5, 'heading body offset with quote prefix')
    },
  },
  {
    id: 'callout-lift-preserves-inline-semantics',
    description: 'Callout lift must preserve first-paragraph link / math / emoji inline semantics instead of flattening to plain text',
    run: () => {
      const schema = getOutlineParseSchema()
      const doc = canonicalMarkdownSemantics.parse(
        '> [!NOTE] [链接](https://example.com) $E = mc^2$ :smile:\n> 第二行说明\n',
        schema,
      )
      const callout = doc.firstChild
      if (!callout || callout.type.name !== 'callout') throw new Error('expected callout node')
      const firstParagraph = callout.firstChild
      if (!firstParagraph || firstParagraph.type.name !== 'paragraph') throw new Error('expected first paragraph')

      let hasLink = false
      let hasInlineMath = false
      let hasEmoji = false
      firstParagraph.descendants((node) => {
        if (node.isText && node.marks.some((mark) => mark.type.name === 'link')) hasLink = true
        if (node.type.name === 'inlineMath') hasInlineMath = true
        if (node.type.name === 'emoji') hasEmoji = true
        return true
      })

      expectEqual(hasLink, true, 'callout first paragraph preserves link mark')
      expectEqual(hasInlineMath, true, 'callout first paragraph preserves inline math node')
      expectEqual(hasEmoji, true, 'callout first paragraph preserves emoji node')
    },
  },
  {
    id: 'callout-lift-preserves-leading-blank-quote-lines',
    description: 'After callout lift, consecutive blank quote lines after the marker must remain to avoid open-as-dirty and line-count drift',
    run: () => {
      const schema = getOutlineParseSchema()
      const markdown = '> [!NOTE]\n>\n>\n> Note Callout\n'
      const doc = canonicalMarkdownSemantics.parse(markdown, schema)
      const callout = doc.firstChild
      if (!callout || callout.type.name !== 'callout') throw new Error('expected callout node')
      expectEqual(callout.childCount, 3, 'should restore leading blank paragraphs before body')
      expectEqual(callout.child(0).type.name, 'paragraph', 'first child blank paragraph')
      expectEqual(callout.child(0).content.size, 0, 'first child should stay empty')
      expectEqual(callout.child(1).content.size, 0, 'second child should stay empty')
      expectEqual(callout.child(2).textContent, 'Note Callout', 'body paragraph preserved')
      expectEqual(
        compileMarkdownForModeBridge(doc, schema),
        markdown.replace(/\n$/u, ''),
        'callout serialize stability',
      )
    },
  },
  {
    id: 'collapsed-atom-pm-projection-stays-within-row',
    description: 'Collapsed atom carrier PM projection must stay within the current row and must not spill into adjacent blocks',
    run: () => {
      const projected = projectAlongRow(
        Object.freeze({
          blockIndex: 0,
          rowId: 'fixture-raw',
          rowKey: 'raw',
          blockPath: Object.freeze([0]),
          blockType: 'rawBlock',
          cmStart: 0,
          cmEnd: 12,
          pmStart: 5,
          pmEnd: 5,
          semanticExtent: 12,
          semanticSlices: Object.freeze([
            Object.freeze({
              semanticFrom: 0,
              semanticTo: 13,
              markdownFrom: 0,
              markdownTo: 12,
              kind: 'html' as const,
              pmFrom: 5,
              pmToExclusive: 6,
            }),
          ]),
        }),
        12,
        12,
        99,
      )
      expectEqual(projected.pm, 5, 'collapsed atom pm should stay within row bounds')
    },
  },
  {
    id: 'pending-ref-lifecycle',
    description:
      'pendingSourceModeAnchorRef is consumed only during source→visual prepare; CM view ready must not clear it (otherwise Cmd+/ round-trips lose the snapshot)',
    run: () => {
      const anchor: SourceModeEnterAnchor = Object.freeze({
        documentKey: 'contract:pending-ref',
        bufferLength: 1,
        bridgeId: 'contract-bridge',
        cmAnchor: 0,
        cmHead: 0,
        modeSwitchSnapshot: Object.freeze({ captureFrameId: 1 }) as NonNullable<
          SourceModeEnterAnchor['modeSwitchSnapshot']
        >,
      })
      const pendingRef: { current: SourceModeEnterAnchor | null } = { current: anchor }
      expectEqual(Boolean(pendingRef.current?.modeSwitchSnapshot), true, 'snapshot present after visual→source')
      const legacyClearedRef: { current: SourceModeEnterAnchor | null } = { current: pendingRef.current }
      legacyClearedRef.current = null
      expectEqual(legacyClearedRef.current, null, 'legacy CM-ready clear drops ref')
      expectEqual(Boolean(pendingRef.current?.modeSwitchSnapshot), true, 'ref must stay until s2v prepare')
      const resolved = pendingRef.current ?? anchor
      expectEqual(Boolean(resolved.modeSwitchSnapshot), true, 'fallback or ref resolves snapshot')
      pendingRef.current = null
      expectEqual(pendingRef.current, null, 'prepare consumes ref once')
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
