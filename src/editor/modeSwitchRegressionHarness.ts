import { deriveHierarchicalSelectionFromPm } from './modeSwitchHierarchical'
import { getOutlineParseSchema } from './markdownOutlineFromMarkdown'
import {
  locateFrozenRow,
  type FrozenRowLookupResolutionKind,
} from './modeSwitchFrozenLookup'
import {
  compareModeSwitchRestoreDistance,
  type ModeSwitchRestoreDistanceKind,
} from './modeSwitchQualitySignals'
import {
  MODE_SWITCH_PRODUCTION_REGRESSION_CASES,
  type ModeSwitchRegressionCase,
  type ModeSwitchRegressionExpectation,
  type ModeToggleRegressionExpectation,
} from './modeSwitchRegressionCases'
import { isModeSwitchFreezeError } from './modeSwitchFreezeFailure'
import { freezeModeSwitchSnapshot, freezeReturningToVisualSnapshot } from './modeSwitchSnapshot'
import { modeSwitchPlainTextFingerprint } from './modeSwitchFingerprint'
import { deriveHierarchicalFromCmSelection, semanticAnchorToPm, cmPosToSemanticAnchor } from './modeSwitchSemanticProjection'
import { buildFrozenStructuralIR, type FrozenStructuralIR } from './modeSwitchStructuralIR'
import { decideModeToggleCommandAction, type ModeToggleCommandActionKind } from './modeToggleCommandSemantics'
import type { ModeSwitchPrepareResultKind } from './viewportModeAnchor'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import { joinMarkdownWithFrontmatter } from './documentFrontmatter'
import {
  bodyOffsetToSourceOffset,
  computeLeadingFrontmatterPrefixLength,
  sourceSelectionToBodySelection,
} from './documentFrontmatterOffsets'

export {
  MODE_SWITCH_PRODUCTION_REGRESSION_CASES,
  MODE_SWITCH_REGRESSION_CASES,
  MODE_SWITCH_STRICT_CONTRACT_REGRESSION_CASES,
} from './modeSwitchRegressionCases'

declare global {
  interface Window {
    __runModeSwitchRegressionGate__?: () => ReturnType<typeof summarizeModeSwitchRegressionCorpus>
    __assertModeSwitchRegressionGate__?: () => ReturnType<typeof assertModeSwitchRegressionCorpus>
  }
}

export type ModeSwitchRegressionStageResult = {
  readonly kind: ModeSwitchPrepareResultKind
  readonly reason: string | null
  readonly distance: ModeSwitchRestoreDistanceKind | null
  readonly lookupResolution: FrozenRowLookupResolutionKind | null
}

export type ModeToggleRegressionStageKind =
  | ModeToggleCommandActionKind
  | 'not_applicable'
  | 'hard_fail'

export type ModeToggleRegressionStageResult = {
  readonly kind: ModeToggleRegressionStageKind
  readonly reason: string | null
}

export type ModeSwitchRegressionMismatchStage =
  | keyof ModeSwitchRegressionExpectation
  | 'commandSlash.visualIdle'
  | 'commandSlash.visualLocalActive'

export type ModeSwitchRegressionEvaluation = {
  readonly id: string
  readonly description: string
  readonly expected: ModeSwitchRegressionExpectation
  readonly commandSlash: ModeToggleRegressionExpectation
  readonly visualToSource: ModeSwitchRegressionStageResult
  readonly sourceToVisualStrict: ModeSwitchRegressionStageResult
  readonly sourceToVisualDegraded: ModeSwitchRegressionStageResult
  readonly commandSlashVisualIdle: ModeToggleRegressionStageResult
  readonly commandSlashVisualLocalActive: ModeToggleRegressionStageResult
}

export type ModeSwitchRegressionMismatch = {
  readonly id: string
  readonly stage: ModeSwitchRegressionMismatchStage
  readonly expected: ModeSwitchPrepareResultKind | ModeToggleRegressionStageKind
  readonly actual: ModeSwitchPrepareResultKind | ModeToggleRegressionStageKind
  readonly reason: string | null
}

export type ModeSwitchRegressionProgressEvent = {
  readonly index: number
  readonly total: number
  readonly id: string
  readonly description: string
}

export type ModeSwitchRegressionEvaluationOptions = {
  readonly onCaseStart?: (event: ModeSwitchRegressionProgressEvent) => void
  readonly onCaseDone?: (event: ModeSwitchRegressionProgressEvent) => void
  readonly onStageStart?: (event: ModeSwitchRegressionProgressEvent & { readonly stage: string }) => void
  readonly onStageDone?: (event: ModeSwitchRegressionProgressEvent & { readonly stage: string }) => void
  readonly onDetail?: (line: string) => void
}

export type ModeSwitchArchitectureDecision = {
  readonly recommendation: 'stay_dual_editor_with_islands' | 'consider_deeper_runtime_unification'
  readonly rationale: readonly string[]
}

/** Primary quality signals for Cmd+/ mode switch (not confounded by the 3-stage test matrix). */
export type ModeSwitchRegressionQualityMetrics = {
  readonly caseCount: number
  /** visualToSource + sourceToVisualStrict both strict — the normal Cmd+/ round-trip path. */
  readonly roundTripStrictCount: number
  readonly roundTripStrictRate: number
  /** Each case intentionally exercises sourceToVisualDegraded (cold path without snapshot). */
  readonly intentionalDegradedStageCount: number
  readonly contractPassRate: number
}

export type ModeSwitchRegressionTrendSnapshot = {
  readonly version: 2
  readonly caseCount: number
  readonly totalStageCount: number
  /** @deprecated Structural ratio from the 3-stage matrix (≈67% when every case expects 2 strict + 1 degraded). Prefer roundTripStrictRate. */
  readonly strictSuccessCount: number
  /** @deprecated See strictSuccessCount — not a user-facing degradation rate. */
  readonly degradedSuccessCount: number
  readonly hardFailCount: number
  readonly strictSuccessRate: number
  readonly degradedSuccessRate: number
  readonly hardFailRate: number
  readonly roundTripStrictCount: number
  readonly roundTripStrictRate: number
  readonly intentionalDegradedStageCount: number
  readonly contractPassRate: number
  readonly commandHardFailCount: number
  readonly commandLocalOpenRate: number | null
  readonly commandLocalCloseRate: number | null
  readonly restoreDistanceCounts: Readonly<Record<ModeSwitchRestoreDistanceKind, number>>
  readonly lookupResolutionCounts: Readonly<Record<FrozenRowLookupResolutionKind, number>>
  readonly mismatchCount: number
  readonly architectureRecommendation: ModeSwitchArchitectureDecision['recommendation']
}

export type ModeSwitchRegressionTrendComparison = {
  readonly baseline: ModeSwitchRegressionTrendSnapshot
  readonly current: ModeSwitchRegressionTrendSnapshot
  readonly regressions: readonly string[]
  readonly improvements: readonly string[]
}

export type ModeSwitchRegressionTrendHistoryEntry = {
  readonly label: string
  readonly recordedAt: string | null
  readonly snapshot: ModeSwitchRegressionTrendSnapshot
}

export type ModeSwitchRegressionTrendHistory = {
  readonly version: 1
  readonly entries: readonly ModeSwitchRegressionTrendHistoryEntry[]
}

type ModeSwitchRegressionTrendStatus = 'regressed' | 'improved' | 'stable'

type ModeSwitchRegressionHistoryStageMeta = {
  readonly stage: string
  readonly note: string | null
}

type ModeSwitchP2GateSummary = {
  readonly stage: 'metrics' | 'decision-gate'
  readonly status: 'ready' | 'pending'
  readonly rationale: readonly string[]
  readonly recommendation: string | null
}

type ModeSwitchP2GateInput = {
  readonly results: readonly ModeSwitchRegressionEvaluation[]
  readonly totalStageCount: number
  readonly qualityMetrics: ModeSwitchRegressionQualityMetrics
  readonly hardFailRate: number
  readonly hardFailCount: number
  readonly commandHardFailCount: number
  readonly lookupResolutionCounts: Readonly<Record<FrozenRowLookupResolutionKind, number>>
  readonly mismatchCount: number
  readonly architectureDecision: ModeSwitchArchitectureDecision
}

function collectModeSwitchRegressionQualityMetrics(
  results: readonly ModeSwitchRegressionEvaluation[],
  mismatchCount: number,
): ModeSwitchRegressionQualityMetrics {
  const caseCount = results.length
  const roundTripStrictCount = results.filter(
    (result) =>
      result.visualToSource.kind === 'strict_success' &&
      result.sourceToVisualStrict.kind === 'strict_success',
  ).length
  return Object.freeze({
    caseCount,
    roundTripStrictCount,
    roundTripStrictRate: caseCount > 0 ? roundTripStrictCount / caseCount : 0,
    intentionalDegradedStageCount: caseCount,
    contractPassRate: mismatchCount === 0 ? 1 : 0,
  })
}

type LegacyModeSwitchRegressionTrendSnapshot = Omit<
  ModeSwitchRegressionTrendSnapshot,
  'version' | 'roundTripStrictCount' | 'roundTripStrictRate' | 'intentionalDegradedStageCount' | 'contractPassRate'
> & {
  readonly version?: 1 | 2
  readonly roundTripStrictCount?: number
  readonly roundTripStrictRate?: number
  readonly intentionalDegradedStageCount?: number
  readonly contractPassRate?: number
}

function normalizeModeSwitchRegressionTrendSnapshot(
  snapshot: LegacyModeSwitchRegressionTrendSnapshot,
): ModeSwitchRegressionTrendSnapshot {
  if (snapshot.version === 2 && typeof snapshot.roundTripStrictRate === 'number') {
    return snapshot as ModeSwitchRegressionTrendSnapshot
  }
  const caseCount = snapshot.caseCount
  const roundTripStrictCount =
    typeof snapshot.roundTripStrictCount === 'number' ? snapshot.roundTripStrictCount : caseCount
  const roundTripStrictRate =
    typeof snapshot.roundTripStrictRate === 'number'
      ? snapshot.roundTripStrictRate
      : caseCount > 0
        ? roundTripStrictCount / caseCount
        : 0
  return Object.freeze({
    ...snapshot,
    version: 2,
    roundTripStrictCount,
    roundTripStrictRate,
    intentionalDegradedStageCount:
      typeof snapshot.intentionalDegradedStageCount === 'number'
        ? snapshot.intentionalDegradedStageCount
        : caseCount,
    contractPassRate:
      typeof snapshot.contractPassRate === 'number'
        ? snapshot.contractPassRate
        : snapshot.mismatchCount === 0
          ? 1
          : 0,
  })
}

type ModeSwitchRegressionHistoryStageSummary = {
  readonly stage: string
  readonly entryCount: number
  readonly latestLabel: string
  readonly notes: readonly string[]
  readonly expectedNotes: readonly string[]
  readonly missingNotes: readonly string[]
}

const MODE_SWITCH_HISTORY_STAGE_PRESETS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  p2: Object.freeze(['ir-scope', 'metrics', 'decision-gate']),
})

function modeSwitchRegressionHistoryPresetCommand(stage: string, note: string): string {
  return `npm run regression:mode-switch:history:${normalizeModeSwitchHistoryLabelSegment(stage)}:${normalizeModeSwitchHistoryLabelSegment(note)}`
}

function evaluateModeSwitchP2GateSummaries(summary: ModeSwitchP2GateInput): readonly ModeSwitchP2GateSummary[] {
  const metricsRationale: string[] = []
  const quality = summary.qualityMetrics
  if (summary.results.length === 0) metricsRationale.push('No regression cases; comparable metrics cannot be formed.')
  if (!Number.isFinite(quality.roundTripStrictRate)) metricsRationale.push('roundTripStrictRate is unavailable.')
  if (!Number.isFinite(summary.hardFailRate)) metricsRationale.push('hardFailRate is unavailable.')
  if (summary.totalStageCount <= 0) metricsRationale.push('Total stage count is 0; metrics are invalid.')
  const metricsSummary = Object.freeze({
    stage: 'metrics' as const,
    status: (metricsRationale.length === 0 ? 'ready' : 'pending') as 'ready' | 'pending',
    rationale: Object.freeze(
      metricsRationale.length === 0
        ? [
            `roundTripStrict=${quality.roundTripStrictCount}/${quality.caseCount}(${(quality.roundTripStrictRate * 100).toFixed(1)}%)`,
            `contractPass=${(quality.contractPassRate * 100).toFixed(1)}% mismatches=${summary.mismatchCount}`,
            `hardFail=${(summary.hardFailRate * 100).toFixed(1)}% intentionalDegradedStages=${quality.intentionalDegradedStageCount}`,
          ]
        : metricsRationale,
    ),
    recommendation: null,
  })

  const decisionRationale: string[] = []
  if (metricsSummary.status !== 'ready') decisionRationale.push('Metrics stage is not ready yet.')
  if (summary.hardFailCount > 0) decisionRationale.push('Hard fails remain.')
  if (summary.commandHardFailCount > 0) decisionRationale.push('Command hard fails remain.')
  if (summary.mismatchCount > 0) decisionRationale.push('Regression mismatches remain.')
  if (summary.lookupResolutionCounts.block_index > 0 || summary.lookupResolutionCounts.missing > 0) {
    decisionRationale.push('Row lookup still falls back to block_index / missing.')
  }
  const decisionReady = decisionRationale.length === 0
  const decisionSummary = Object.freeze({
    stage: 'decision-gate' as const,
    status: (decisionReady ? 'ready' : 'pending') as 'ready' | 'pending',
    rationale: Object.freeze(
      decisionReady
        ? summary.architectureDecision.rationale
        : decisionRationale,
    ),
    recommendation: summary.architectureDecision.recommendation,
  })

  return Object.freeze([metricsSummary, decisionSummary])
}

function normalizeModeSwitchHistoryLabelSegment(value: string | null | undefined, fallback = 'checkpoint'): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function compactModeSwitchHistoryTimestamp(isoLike: string | null | undefined): string {
  const source = String(isoLike ?? '')
  const digits = source.replace(/\D+/g, '')
  if (digits.length >= 12) return digits.slice(0, 12)
  return digits || 'undated'
}

function parseModeSwitchRegressionHistoryLabel(label: string): ModeSwitchRegressionHistoryStageMeta {
  if (label === 'baseline') {
    return Object.freeze({ stage: 'baseline', note: null })
  }
  const parts = label.split('-').filter(Boolean)
  if (parts.length === 0) {
    return Object.freeze({ stage: 'unknown', note: null })
  }
  if (parts.length >= 3 && /^\d+$/u.test(parts[1] ?? '') && /^\d{8,}$/u.test(parts[parts.length - 1] ?? '')) {
    const note = parts.slice(2, -1).join('-') || null
    return Object.freeze({ stage: parts[0]!, note })
  }
  if (parts.length >= 2 && /^\d+$/u.test(parts[1] ?? '')) {
    const note = parts.slice(2).join('-') || null
    return Object.freeze({ stage: parts[0]!, note })
  }
  return Object.freeze({
    stage: parts[0]!,
    note: parts.slice(1).join('-') || null,
  })
}

function stageResultFromError(error: unknown): ModeSwitchRegressionStageResult {
  if (isModeSwitchFreezeError(error)) {
    return {
      kind: 'hard_fail',
      reason: String(error.detail.reason ?? error.message),
      distance: null,
      lookupResolution: null,
    }
  }
  return {
    kind: 'hard_fail',
    reason: error instanceof Error ? error.message : String(error),
    distance: null,
    lookupResolution: null,
  }
}

type RegressionFrontmatterContext = {
  readonly bodyMarkdown: string
  readonly fullSourceMarkdown: string
  readonly frontmatterPrefixLength: number
}

function regressionFrontmatterContext(
  regressionCase: ModeSwitchRegressionCase,
): RegressionFrontmatterContext | null {
  if (!regressionCase.leadingFrontmatter) return null
  const bodyMarkdown = regressionCase.markdown
  const fullSourceMarkdown = joinMarkdownWithFrontmatter(
    bodyMarkdown,
    regressionCase.leadingFrontmatter,
    false,
  )
  return {
    bodyMarkdown,
    fullSourceMarkdown,
    frontmatterPrefixLength: computeLeadingFrontmatterPrefixLength(fullSourceMarkdown),
  }
}

function pickRegressionCmPos(markdown: string): number {
  if (!markdown.length) return 0
  const texty = markdown.search(/[\p{L}\p{N}]/u)
  if (texty >= 0) return texty
  const visible = markdown.search(/\S/u)
  if (visible >= 0) return visible
  return 0
}

function stageResultFromCommandError(error: unknown): ModeToggleRegressionStageResult {
  return {
    kind: 'hard_fail',
    reason: error instanceof Error ? error.message : String(error),
  }
}

function lookupResolutionForAnchor(
  ir: FrozenStructuralIR | null | undefined,
  anchor:
    | { readonly blockIndex: number; readonly rowKey: string; readonly blockPath: readonly number[] }
    | null
    | undefined,
): FrozenRowLookupResolutionKind | null {
  if (!ir || !anchor) return null
  return locateFrozenRow(ir, anchor).resolution
}

function inferRegressionBlockTypeFromMarkdown(markdown: string): string | null {
  const trimmed = markdown.trim()
  if (!trimmed) return null
  if (/^```+\s*mermaid\b/iu.test(trimmed)) return 'mermaidBlock'
  if (/^```+\s*luna-raw\b/iu.test(trimmed)) return 'rawBlock'
  if (/^```+/u.test(trimmed)) return 'codeBlock'
  if (/^\$\$(?:\n|$)/u.test(trimmed)) return 'blockMath'
  if (/^<!--[\s\S]*-->$/u.test(trimmed)) return 'rawBlock'
  if (/^\[\^[^\]\s][^\]]*\]:/u.test(trimmed)) return 'footnoteDef'
  if (/^\[[^\]]+\]:\s+/u.test(trimmed)) return 'linkReferenceDef'
  if (/^\[toc\]$/iu.test(trimmed)) return 'tocDirective'
  return null
}

function deriveRegressionActiveBlockType(markdown: string): { blockType: string | null; cmPos: number } {
  const inferred = inferRegressionBlockTypeFromMarkdown(markdown)
  const cmPos = pickRegressionCmPos(markdown)
  if (inferred) return { blockType: inferred, cmPos }
  const schema = getOutlineParseSchema()
  const doc = canonicalMarkdownSemantics.parse(markdown, schema)
  let blockType: string | null = null
  doc.descendants((node) => {
    if (!node.isBlock || node.type.name === 'doc') return true
    blockType = node.type.name
    return false
  })
  return { blockType: blockType ?? doc.firstChild?.type.name ?? null, cmPos }
}

function evaluateVisualToSourceStrict(markdown: string, options: ModeSwitchRegressionEvaluationOptions = {}): {
  kind: 'strict_success'
  snapshot: ReturnType<typeof freezeModeSwitchSnapshot>
  cmPos: number
} | {
  kind: 'hard_fail'
  error: unknown
  cmPos: number
} {
  const cmPos = pickRegressionCmPos(markdown)
  try {
    options.onDetail?.('visualToSource.parse')
    const schema = getOutlineParseSchema()
    const doc = canonicalMarkdownSemantics.parse(markdown, schema)
    options.onDetail?.('visualToSource.buildFrozenStructuralIR')
    const provisionalIR = buildFrozenStructuralIR({
      canonicalBuffer: markdown,
      hierarchical: null,
      doc,
      onDetail: options.onDetail,
    })
    options.onDetail?.('visualToSource.semanticAnchorToPm')
    const pmPos = semanticAnchorToPm(
      cmPosToSemanticAnchor(cmPos, provisionalIR),
      provisionalIR,
      markdown.length,
      Math.max(1, doc.content.size),
    )
    options.onDetail?.('visualToSource.freezeModeSwitchSnapshot')
    const snapshot = freezeModeSwitchSnapshot({
      captureFrameId: 0,
      documentKey: `regression:${modeSwitchPlainTextFingerprint(markdown)}`,
      hierarchical: {
        bufferHash: '',
        anchor: deriveHierarchicalSelectionFromPm(doc, pmPos),
        head: deriveHierarchicalSelectionFromPm(doc, pmPos),
      },
      doc,
      schema,
      sourceMode: 'visual',
      identityMarkdown: markdown,
    })
    return { kind: 'strict_success', snapshot, cmPos }
  } catch (error) {
    if (isModeSwitchFreezeError(error)) {
      options.onDetail?.(
        `visualToSource.freezeError reason=${String(error.detail.reason ?? 'unknown')} pmJoinLen=${String(error.detail.pmJoinLen ?? 'n/a')} mdJoinLen=${String(error.detail.mdJoinLen ?? 'n/a')} bodySeg=${JSON.stringify(String(error.detail.bodySegPreview ?? ''))}`,
      )
    }
    return { kind: 'hard_fail', error, cmPos }
  }
}

function evaluateSourceToVisualDegraded(
  markdown: string,
  cmPos: number,
  frontmatter: RegressionFrontmatterContext | null = null,
): ModeSwitchRegressionStageResult {
  try {
    const bodyMarkdown = frontmatter?.bodyMarkdown ?? markdown
    const bodyCmPos = (() => {
      if (!frontmatter) return cmPos
      const sourcePos = bodyOffsetToSourceOffset(
        cmPos,
        frontmatter.frontmatterPrefixLength,
        frontmatter.fullSourceMarkdown.length,
      )
      return sourceSelectionToBodySelection(
        sourcePos,
        sourcePos,
        frontmatter.frontmatterPrefixLength,
        bodyMarkdown.length,
      ).bodyAnchor
    })()
    const schema = getOutlineParseSchema()
    const doc = canonicalMarkdownSemantics.parse(bodyMarkdown, schema)
    const provisionalIR = buildFrozenStructuralIR({
      canonicalBuffer: bodyMarkdown,
      hierarchical: null,
      doc,
    })
    const hierarchical = deriveHierarchicalFromCmSelection(bodyCmPos, bodyCmPos, provisionalIR)
    semanticAnchorToPm(
      cmPosToSemanticAnchor(bodyCmPos, provisionalIR),
      provisionalIR,
      bodyMarkdown.length,
      Math.max(1, doc.content.size),
    )
    return {
      kind: 'degraded_success',
      reason: hierarchical.anchor.rowKey ?? null,
      distance: compareModeSwitchRestoreDistance(hierarchical.anchor, hierarchical.anchor),
      lookupResolution: lookupResolutionForAnchor(provisionalIR, hierarchical.anchor),
    }
  } catch (error) {
    return stageResultFromError(error)
  }
}

function evaluateSourceToVisualStrict(
  visualResult: ReturnType<typeof evaluateVisualToSourceStrict>,
  frontmatter: RegressionFrontmatterContext | null = null,
): ModeSwitchRegressionStageResult {
  if (visualResult.kind !== 'strict_success') {
    return {
      kind: 'hard_fail',
      reason: 'missing_strict_snapshot',
      distance: null,
      lookupResolution: null,
    }
  }
  try {
    const bodyMarkdown = visualResult.snapshot.canonicalBuffer
    const bodySel = (() => {
      if (!frontmatter) {
        return { bodyAnchor: visualResult.cmPos, bodyHead: visualResult.cmPos }
      }
      const sourcePos = bodyOffsetToSourceOffset(
        visualResult.cmPos,
        frontmatter.frontmatterPrefixLength,
        frontmatter.fullSourceMarkdown.length,
      )
      return sourceSelectionToBodySelection(
        sourcePos,
        sourcePos,
        frontmatter.frontmatterPrefixLength,
        bodyMarkdown.length,
      )
    })()
    const restored = freezeReturningToVisualSnapshot(visualResult.snapshot, {
      markdown: bodyMarkdown,
      anchor: bodySel.bodyAnchor,
      head: bodySel.bodyHead,
    })
    return {
      kind: 'strict_success',
      reason: null,
      distance: compareModeSwitchRestoreDistance(
        visualResult.snapshot.hierarchical?.anchor ?? null,
        restored.hierarchical?.anchor ?? null,
      ),
      lookupResolution: lookupResolutionForAnchor(
        restored.frozenStructuralIR,
        restored.hierarchical?.anchor ?? null,
      ),
    }
  } catch (error) {
    return stageResultFromError(error)
  }
}

function evaluateCommandSlashVisualIdle(markdown: string): ModeToggleRegressionStageResult {
  try {
    const { blockType } = deriveRegressionActiveBlockType(markdown)
    return {
      kind: decideModeToggleCommandAction({
        mainPaneMode: 'visual',
        activeBlockType: blockType,
        hasActiveLocalSourceIsland: false,
      }),
      reason: blockType,
    }
  } catch (error) {
    return stageResultFromCommandError(error)
  }
}

function evaluateCommandSlashVisualLocalActive(markdown: string): ModeToggleRegressionStageResult {
  try {
    const { blockType } = deriveRegressionActiveBlockType(markdown)
    const visualIdle = decideModeToggleCommandAction({
      mainPaneMode: 'visual',
      activeBlockType: blockType,
      hasActiveLocalSourceIsland: false,
    })
    if (visualIdle !== 'open_local_source_island') {
      return {
        kind: 'not_applicable',
        reason: blockType,
      }
    }
    return {
      kind: decideModeToggleCommandAction({
        mainPaneMode: 'visual',
        activeBlockType: blockType,
        hasActiveLocalSourceIsland: true,
      }),
      reason: blockType,
    }
  } catch (error) {
    return stageResultFromCommandError(error)
  }
}

export function evaluateModeSwitchRegressionCase(
  regressionCase: ModeSwitchRegressionCase,
  options: ModeSwitchRegressionEvaluationOptions = {},
  progressEvent?: ModeSwitchRegressionProgressEvent,
): ModeSwitchRegressionEvaluation {
  const stageEvent = (stage: string) =>
    progressEvent
      ? Object.freeze({
          ...progressEvent,
          stage,
        })
      : null

  const frontmatterCtx = regressionFrontmatterContext(regressionCase)

  const visualToSourceStart = stageEvent('visualToSource')
  if (visualToSourceStart) options.onStageStart?.(visualToSourceStart)
  const visualToSource = evaluateVisualToSourceStrict(regressionCase.markdown, options)
  if (visualToSourceStart) options.onStageDone?.(visualToSourceStart)
  const sourceToVisualStrictStart = stageEvent('sourceToVisualStrict')
  if (sourceToVisualStrictStart) options.onStageStart?.(sourceToVisualStrictStart)
  const sourceToVisualStrict = evaluateSourceToVisualStrict(visualToSource, frontmatterCtx)
  if (sourceToVisualStrictStart) options.onStageDone?.(sourceToVisualStrictStart)
  const sourceToVisualDegradedStart = stageEvent('sourceToVisualDegraded')
  if (sourceToVisualDegradedStart) options.onStageStart?.(sourceToVisualDegradedStart)
  const sourceToVisualDegraded = evaluateSourceToVisualDegraded(
    regressionCase.markdown,
    visualToSource.cmPos,
    frontmatterCtx,
  )
  if (sourceToVisualDegradedStart) options.onStageDone?.(sourceToVisualDegradedStart)
  const commandSlashVisualIdleStart = stageEvent('commandSlash.visualIdle')
  if (commandSlashVisualIdleStart) options.onStageStart?.(commandSlashVisualIdleStart)
  const commandSlashVisualIdle = evaluateCommandSlashVisualIdle(regressionCase.markdown)
  if (commandSlashVisualIdleStart) options.onStageDone?.(commandSlashVisualIdleStart)
  const commandSlashVisualLocalActiveStart = stageEvent('commandSlash.visualLocalActive')
  if (commandSlashVisualLocalActiveStart) options.onStageStart?.(commandSlashVisualLocalActiveStart)
  const commandSlashVisualLocalActive = evaluateCommandSlashVisualLocalActive(regressionCase.markdown)
  if (commandSlashVisualLocalActiveStart) options.onStageDone?.(commandSlashVisualLocalActiveStart)
  return Object.freeze({
    id: regressionCase.id,
    description: regressionCase.description,
    expected: regressionCase.expected,
    commandSlash: regressionCase.commandSlash,
    visualToSource:
      visualToSource.kind === 'strict_success'
        ? ({
            kind: 'strict_success',
            reason: null,
            distance: null,
            lookupResolution: lookupResolutionForAnchor(
              visualToSource.snapshot.frozenStructuralIR,
              visualToSource.snapshot.hierarchical?.anchor ?? null,
            ),
          } satisfies ModeSwitchRegressionStageResult)
        : stageResultFromError(visualToSource.error),
    sourceToVisualStrict,
    sourceToVisualDegraded,
    commandSlashVisualIdle,
    commandSlashVisualLocalActive,
  })
}

export function evaluateModeSwitchRegressionCorpus(
  cases: readonly ModeSwitchRegressionCase[] = MODE_SWITCH_PRODUCTION_REGRESSION_CASES,
  options: ModeSwitchRegressionEvaluationOptions = {},
): readonly ModeSwitchRegressionEvaluation[] {
  const results: ModeSwitchRegressionEvaluation[] = []
  const total = cases.length
  for (let index = 0; index < total; index += 1) {
    const regressionCase = cases[index]!
    const event = Object.freeze({
      index: index + 1,
      total,
      id: regressionCase.id,
      description: regressionCase.description,
    })
    options.onCaseStart?.(event)
    const result = evaluateModeSwitchRegressionCase(regressionCase, options, event)
    results.push(result)
    options.onCaseDone?.(event)
  }
  return Object.freeze(results)
}

export function collectModeSwitchRegressionMismatches(
  results: readonly ModeSwitchRegressionEvaluation[],
): readonly ModeSwitchRegressionMismatch[] {
  const mismatches: ModeSwitchRegressionMismatch[] = []
  for (const result of results) {
    const actualByStage: Record<keyof ModeSwitchRegressionExpectation, ModeSwitchRegressionStageResult> = {
      visualToSource: result.visualToSource,
      sourceToVisualStrict: result.sourceToVisualStrict,
      sourceToVisualDegraded: result.sourceToVisualDegraded,
    }
    ;(Object.keys(result.expected) as Array<keyof ModeSwitchRegressionExpectation>).forEach((stage) => {
      const expected = result.expected[stage]
      const actual = actualByStage[stage]
      if (expected !== actual.kind) {
        mismatches.push({
          id: result.id,
          stage,
          expected,
          actual: actual.kind,
          reason: actual.reason,
        })
      }
    })
    if (result.commandSlash.visualIdle !== result.commandSlashVisualIdle.kind) {
      mismatches.push({
        id: result.id,
        stage: 'commandSlash.visualIdle',
        expected: result.commandSlash.visualIdle,
        actual: result.commandSlashVisualIdle.kind,
        reason: result.commandSlashVisualIdle.reason,
      })
    }
    const expectedLocalActive = result.commandSlash.visualLocalActive ?? 'not_applicable'
    if (expectedLocalActive !== result.commandSlashVisualLocalActive.kind) {
      mismatches.push({
        id: result.id,
        stage: 'commandSlash.visualLocalActive',
        expected: expectedLocalActive,
        actual: result.commandSlashVisualLocalActive.kind,
        reason: result.commandSlashVisualLocalActive.reason,
      })
    }
  }
  return Object.freeze(mismatches)
}

function collectModeSwitchRegressionQualityFailures(
  results: readonly ModeSwitchRegressionEvaluation[],
): readonly string[] {
  const failures: string[] = []
  for (const result of results) {
    for (const [stageName, stage] of [
      ['visualToSource', result.visualToSource],
      ['sourceToVisualStrict', result.sourceToVisualStrict],
      ['sourceToVisualDegraded', result.sourceToVisualDegraded],
    ] as const) {
      if (stage.kind === 'hard_fail') {
        failures.push(`${result.id}:${stageName} hard_fail reason=${stage.reason ?? 'null'}`)
      }
      if (stage.distance === 'unrelated') {
        failures.push(`${result.id}:${stageName} restoreDistance=unrelated`)
      }
      if (stage.lookupResolution === 'missing') {
        failures.push(`${result.id}:${stageName} lookupResolution=missing`)
      }
    }
  }
  return Object.freeze(failures)
}

export function assertModeSwitchRegressionCorpus(
  cases: readonly ModeSwitchRegressionCase[] = MODE_SWITCH_PRODUCTION_REGRESSION_CASES,
  options: ModeSwitchRegressionEvaluationOptions = {},
): {
  readonly results: readonly ModeSwitchRegressionEvaluation[]
  readonly mismatches: readonly ModeSwitchRegressionMismatch[]
} {
  const results = evaluateModeSwitchRegressionCorpus(cases, options)
  const mismatches = collectModeSwitchRegressionMismatches(results)
  const qualityFailures = collectModeSwitchRegressionQualityFailures(results)
  if (mismatches.length > 0 || qualityFailures.length > 0) {
    throw new Error(
      [
        formatModeSwitchRegressionMismatchReport(mismatches),
        qualityFailures.length > 0
          ? ['[mode-switch][regression] quality gate failures:', ...qualityFailures.map((line) => `- ${line}`)].join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
  return Object.freeze({ results, mismatches })
}

function evaluateModeSwitchArchitectureDecision(input: {
  readonly hardFailRate: number
  readonly commandHardFailCount: number
  readonly restoreDistanceCounts: Readonly<Record<ModeSwitchRestoreDistanceKind, number>>
  readonly lookupResolutionCounts: Readonly<Record<FrozenRowLookupResolutionKind, number>>
  readonly mismatchCount: number
}): ModeSwitchArchitectureDecision {
  const rationale: string[] = []
  if (input.hardFailRate > 0) {
    rationale.push('Hard fails remain, so the structural bridge is not fully stable yet.')
  }
  if (input.commandHardFailCount > 0) {
    rationale.push('Command semantics still have hard fails; the local source-island path is not stable enough.')
  }
  if (input.restoreDistanceCounts.unrelated > 0) {
    rationale.push('Restore landed on an unrelated block; structural anchors are insufficient for current switch quality.')
  }
  if (input.restoreDistanceCounts.nearby_block > 0) {
    rationale.push('Restore still hits nearby blocks, indicating reliance on conservative neighbor fallback.')
  }
  if (input.lookupResolutionCounts.block_index > 0 || input.lookupResolutionCounts.missing > 0) {
    rationale.push('Runtime row lookup already falls back to block_index / missing; frozen structural identity is not stable enough.')
  }
  if (input.mismatchCount > 0) {
    rationale.push('Regression expectations still diverge from actual results; broader architecture refactors should wait.')
  }
  if (rationale.length === 0) {
    return Object.freeze({
      recommendation: 'stay_dual_editor_with_islands',
      rationale: Object.freeze([
        'No hard fails or command-level failures; the dual-editor + source-island approach still holds.',
        'Restore distance stays within the same leaf row / block path; no rush to push deeper single-engine convergence.',
      ]),
    })
  }
  return Object.freeze({
    recommendation: 'consider_deeper_runtime_unification',
    rationale: Object.freeze(rationale),
  })
}

export function summarizeModeSwitchRegressionCorpus(
  cases: readonly ModeSwitchRegressionCase[] = MODE_SWITCH_PRODUCTION_REGRESSION_CASES,
  options: ModeSwitchRegressionEvaluationOptions = {},
): {
  readonly totalStageCount: number
  readonly strictSuccessCount: number
  readonly degradedSuccessCount: number
  readonly hardFailCount: number
  readonly strictSuccessRate: number
  readonly degradedSuccessRate: number
  readonly hardFailRate: number
  readonly qualityMetrics: ModeSwitchRegressionQualityMetrics
  readonly commandHardFailCount: number
  readonly commandLocalOpenRate: number | null
  readonly commandLocalCloseRate: number | null
  readonly restoreDistanceCounts: Readonly<Record<ModeSwitchRestoreDistanceKind, number>>
  readonly lookupResolutionCounts: Readonly<Record<FrozenRowLookupResolutionKind, number>>
  readonly mismatchCount: number
  readonly architectureDecision: ModeSwitchArchitectureDecision
  readonly p2GateSummaries: readonly ModeSwitchP2GateSummary[]
  readonly mismatches: readonly ModeSwitchRegressionMismatch[]
  readonly results: readonly ModeSwitchRegressionEvaluation[]
} {
  const results = evaluateModeSwitchRegressionCorpus(cases, options)
  const mismatches = collectModeSwitchRegressionMismatches(results)
  const qualityMetrics = collectModeSwitchRegressionQualityMetrics(results, mismatches.length)
  const totalStageCount = results.length * 3
  let strictSuccessCount = 0
  let degradedSuccessCount = 0
  let hardFailCount = 0
  let commandHardFailCount = 0
  let commandLocalOpenTotal = 0
  let commandLocalOpenSuccess = 0
  let commandLocalCloseTotal = 0
  let commandLocalCloseSuccess = 0
  const restoreDistanceCounts: Record<ModeSwitchRestoreDistanceKind, number> = {
    same_leaf_row: 0,
    same_block_path: 0,
    nearby_block: 0,
    unrelated: 0,
    unknown: 0,
  }
  const lookupResolutionCounts: Record<FrozenRowLookupResolutionKind, number> = {
    row_id: 0,
    row_key: 0,
    block_path: 0,
    block_index: 0,
    missing: 0,
  }
  for (const result of results) {
    for (const stage of [
      result.visualToSource,
      result.sourceToVisualStrict,
      result.sourceToVisualDegraded,
    ] as const) {
      if (stage.kind === 'strict_success') strictSuccessCount += 1
      else if (stage.kind === 'degraded_success') degradedSuccessCount += 1
      else hardFailCount += 1
    }
    for (const stage of [result.commandSlashVisualIdle, result.commandSlashVisualLocalActive] as const) {
      if (stage.kind === 'hard_fail') commandHardFailCount += 1
    }
    if (result.commandSlash.visualIdle === 'open_local_source_island') {
      commandLocalOpenTotal += 1
      if (result.commandSlashVisualIdle.kind === 'open_local_source_island') {
        commandLocalOpenSuccess += 1
      }
    }
    if (result.commandSlash.visualLocalActive === 'close_local_source_island') {
      commandLocalCloseTotal += 1
      if (result.commandSlashVisualLocalActive.kind === 'close_local_source_island') {
        commandLocalCloseSuccess += 1
      }
    }
    for (const distance of [
      result.sourceToVisualStrict.distance,
      result.sourceToVisualDegraded.distance,
    ] as const) {
      if (distance) restoreDistanceCounts[distance] += 1
    }
    for (const resolution of [
      result.visualToSource.lookupResolution,
      result.sourceToVisualStrict.lookupResolution,
      result.sourceToVisualDegraded.lookupResolution,
    ] as const) {
      if (resolution) lookupResolutionCounts[resolution] += 1
    }
  }
  const strictSuccessRate = totalStageCount > 0 ? strictSuccessCount / totalStageCount : 0
  const degradedSuccessRate = totalStageCount > 0 ? degradedSuccessCount / totalStageCount : 0
  const hardFailRate = totalStageCount > 0 ? hardFailCount / totalStageCount : 0
  const commandLocalOpenRate =
    commandLocalOpenTotal > 0 ? commandLocalOpenSuccess / commandLocalOpenTotal : null
  const commandLocalCloseRate =
    commandLocalCloseTotal > 0 ? commandLocalCloseSuccess / commandLocalCloseTotal : null
  const architectureDecision = evaluateModeSwitchArchitectureDecision({
    hardFailRate,
    commandHardFailCount,
    restoreDistanceCounts,
    lookupResolutionCounts,
    mismatchCount: mismatches.length,
  })
  const p2GateSummaries = evaluateModeSwitchP2GateSummaries({
    results,
    totalStageCount,
    qualityMetrics,
    hardFailRate,
    hardFailCount,
    commandHardFailCount,
    lookupResolutionCounts: Object.freeze({ ...lookupResolutionCounts }),
    mismatchCount: mismatches.length,
    architectureDecision,
  })
  return Object.freeze({
    totalStageCount,
    strictSuccessCount,
    degradedSuccessCount,
    hardFailCount,
    strictSuccessRate,
    degradedSuccessRate,
    hardFailRate,
    qualityMetrics,
    commandHardFailCount,
    commandLocalOpenRate,
    commandLocalCloseRate,
    restoreDistanceCounts: Object.freeze({ ...restoreDistanceCounts }),
    lookupResolutionCounts: Object.freeze({ ...lookupResolutionCounts }),
    mismatchCount: mismatches.length,
    architectureDecision,
    p2GateSummaries,
    mismatches,
    results,
  })
}

export function formatModeSwitchRegressionMismatchReport(
  mismatches: readonly ModeSwitchRegressionMismatch[],
): string {
  if (mismatches.length === 0) return '[mode-switch][regression] no mismatches'
  return [
    '[mode-switch][regression] mismatches detected:',
    ...mismatches.map(
      (mismatch) =>
        `- ${mismatch.id}:${mismatch.stage} expected=${mismatch.expected} actual=${mismatch.actual} reason=${mismatch.reason ?? 'null'}`,
    ),
  ].join('\n')
}

export function formatModeSwitchRegressionSummary(
  summary: ReturnType<typeof summarizeModeSwitchRegressionCorpus>,
): string {
  const percent = (value: number | null): string => {
    if (value == null) return 'n/a'
    return `${(value * 100).toFixed(1)}%`
  }
  const distance = summary.restoreDistanceCounts
  const lookup = summary.lookupResolutionCounts
  const quality = summary.qualityMetrics
  return [
    `[mode-switch][regression] cases=${quality.caseCount} roundTripStrict=${quality.roundTripStrictCount}/${quality.caseCount}(${percent(quality.roundTripStrictRate)}) contractPass=${percent(quality.contractPassRate)} mismatches=${summary.mismatchCount} hardFail=${summary.hardFailCount}/${summary.totalStageCount}(${percent(summary.hardFailRate)}) commandHardFail=${summary.commandHardFailCount}`,
    `[mode-switch][regression] stageMatrix strict=${summary.strictSuccessCount}/${summary.totalStageCount}(${percent(summary.strictSuccessRate)}) degraded=${summary.degradedSuccessCount}/${summary.totalStageCount}(${percent(summary.degradedSuccessRate)} intentional cold-path contract)`,
    `[mode-switch][regression] commandLocal open=${percent(summary.commandLocalOpenRate)} close=${percent(summary.commandLocalCloseRate)} restoreDistance sameLeaf=${distance.same_leaf_row} sameBlock=${distance.same_block_path} nearby=${distance.nearby_block} unrelated=${distance.unrelated} unknown=${distance.unknown}`,
    `[mode-switch][regression] rowLookup rowId=${lookup.row_id} rowKey=${lookup.row_key} blockPath=${lookup.block_path} blockIndex=${lookup.block_index} missing=${lookup.missing}`,
    ...summary.p2GateSummaries.flatMap((gate) => [
      `[mode-switch][p2-gate] stage=${gate.stage} status=${gate.status} recommendation=${gate.recommendation ?? 'n/a'}`,
      ...gate.rationale.map((line) => `  reason: ${line}`),
    ]),
    `[mode-switch][regression] architectureDecision=${summary.architectureDecision.recommendation}`,
    ...summary.architectureDecision.rationale.map((line) => `  reason: ${line}`),
    ...summary.results.map(
      (result) =>
        `- ${result.id} v2s=${result.visualToSource.kind}:${result.visualToSource.lookupResolution ?? 'n/a'} s2v.strict=${result.sourceToVisualStrict.kind}:${result.sourceToVisualStrict.distance ?? 'n/a'}:${result.sourceToVisualStrict.lookupResolution ?? 'n/a'} s2v.degraded=${result.sourceToVisualDegraded.kind}:${result.sourceToVisualDegraded.distance ?? 'n/a'}:${result.sourceToVisualDegraded.lookupResolution ?? 'n/a'} cmd.idle=${result.commandSlashVisualIdle.kind} cmd.local=${result.commandSlashVisualLocalActive.kind}`,
    ),
  ].join('\n')
}

export function createModeSwitchRegressionTrendSnapshot(
  summary: ReturnType<typeof summarizeModeSwitchRegressionCorpus>,
): ModeSwitchRegressionTrendSnapshot {
  const quality = summary.qualityMetrics
  return Object.freeze({
    version: 2,
    caseCount: summary.results.length,
    totalStageCount: summary.totalStageCount,
    strictSuccessCount: summary.strictSuccessCount,
    degradedSuccessCount: summary.degradedSuccessCount,
    hardFailCount: summary.hardFailCount,
    strictSuccessRate: summary.strictSuccessRate,
    degradedSuccessRate: summary.degradedSuccessRate,
    hardFailRate: summary.hardFailRate,
    roundTripStrictCount: quality.roundTripStrictCount,
    roundTripStrictRate: quality.roundTripStrictRate,
    intentionalDegradedStageCount: quality.intentionalDegradedStageCount,
    contractPassRate: quality.contractPassRate,
    commandHardFailCount: summary.commandHardFailCount,
    commandLocalOpenRate: summary.commandLocalOpenRate,
    commandLocalCloseRate: summary.commandLocalCloseRate,
    restoreDistanceCounts: Object.freeze({ ...summary.restoreDistanceCounts }),
    lookupResolutionCounts: Object.freeze({ ...summary.lookupResolutionCounts }),
    mismatchCount: summary.mismatchCount,
    architectureRecommendation: summary.architectureDecision.recommendation,
  })
}

export function compareModeSwitchRegressionTrend(
  baselineInput: LegacyModeSwitchRegressionTrendSnapshot,
  currentInput: LegacyModeSwitchRegressionTrendSnapshot,
): ModeSwitchRegressionTrendComparison {
  const baseline = normalizeModeSwitchRegressionTrendSnapshot(baselineInput)
  const current = normalizeModeSwitchRegressionTrendSnapshot(currentInput)
  const regressions: string[] = []
  const improvements: string[] = []

  if (current.roundTripStrictRate < baseline.roundTripStrictRate) {
    regressions.push(
      `roundTripStrictRate ${(baseline.roundTripStrictRate * 100).toFixed(1)}% -> ${(current.roundTripStrictRate * 100).toFixed(1)}%`,
    )
  } else if (current.roundTripStrictRate > baseline.roundTripStrictRate) {
    improvements.push(
      `roundTripStrictRate ${(baseline.roundTripStrictRate * 100).toFixed(1)}% -> ${(current.roundTripStrictRate * 100).toFixed(1)}%`,
    )
  }

  if (current.contractPassRate < baseline.contractPassRate) {
    regressions.push(
      `contractPassRate ${(baseline.contractPassRate * 100).toFixed(1)}% -> ${(current.contractPassRate * 100).toFixed(1)}%`,
    )
  } else if (current.contractPassRate > baseline.contractPassRate) {
    improvements.push(
      `contractPassRate ${(baseline.contractPassRate * 100).toFixed(1)}% -> ${(current.contractPassRate * 100).toFixed(1)}%`,
    )
  }

  if (current.hardFailRate > baseline.hardFailRate) {
    regressions.push(
      `hardFailRate ${(baseline.hardFailRate * 100).toFixed(1)}% -> ${(current.hardFailRate * 100).toFixed(1)}%`,
    )
  } else if (current.hardFailRate < baseline.hardFailRate) {
    improvements.push(
      `hardFailRate ${(baseline.hardFailRate * 100).toFixed(1)}% -> ${(current.hardFailRate * 100).toFixed(1)}%`,
    )
  }

  if (current.mismatchCount > baseline.mismatchCount) {
    regressions.push(`mismatchCount ${baseline.mismatchCount} -> ${current.mismatchCount}`)
  } else if (current.mismatchCount < baseline.mismatchCount) {
    improvements.push(`mismatchCount ${baseline.mismatchCount} -> ${current.mismatchCount}`)
  }

  if (current.lookupResolutionCounts.block_index > baseline.lookupResolutionCounts.block_index) {
    regressions.push(
      `rowLookup.blockIndex ${baseline.lookupResolutionCounts.block_index} -> ${current.lookupResolutionCounts.block_index}`,
    )
  } else if (current.lookupResolutionCounts.block_index < baseline.lookupResolutionCounts.block_index) {
    improvements.push(
      `rowLookup.blockIndex ${baseline.lookupResolutionCounts.block_index} -> ${current.lookupResolutionCounts.block_index}`,
    )
  }

  if (current.lookupResolutionCounts.missing > baseline.lookupResolutionCounts.missing) {
    regressions.push(
      `rowLookup.missing ${baseline.lookupResolutionCounts.missing} -> ${current.lookupResolutionCounts.missing}`,
    )
  } else if (current.lookupResolutionCounts.missing < baseline.lookupResolutionCounts.missing) {
    improvements.push(
      `rowLookup.missing ${baseline.lookupResolutionCounts.missing} -> ${current.lookupResolutionCounts.missing}`,
    )
  }

  if (current.restoreDistanceCounts.nearby_block > baseline.restoreDistanceCounts.nearby_block) {
    regressions.push(
      `restoreDistance.nearby ${baseline.restoreDistanceCounts.nearby_block} -> ${current.restoreDistanceCounts.nearby_block}`,
    )
  } else if (current.restoreDistanceCounts.nearby_block < baseline.restoreDistanceCounts.nearby_block) {
    improvements.push(
      `restoreDistance.nearby ${baseline.restoreDistanceCounts.nearby_block} -> ${current.restoreDistanceCounts.nearby_block}`,
    )
  }

  if (current.restoreDistanceCounts.unrelated > baseline.restoreDistanceCounts.unrelated) {
    regressions.push(
      `restoreDistance.unrelated ${baseline.restoreDistanceCounts.unrelated} -> ${current.restoreDistanceCounts.unrelated}`,
    )
  } else if (current.restoreDistanceCounts.unrelated < baseline.restoreDistanceCounts.unrelated) {
    improvements.push(
      `restoreDistance.unrelated ${baseline.restoreDistanceCounts.unrelated} -> ${current.restoreDistanceCounts.unrelated}`,
    )
  }

  return Object.freeze({
    baseline,
    current,
    regressions: Object.freeze(regressions),
    improvements: Object.freeze(improvements),
  })
}

export function formatModeSwitchRegressionTrendComparison(
  comparison: ModeSwitchRegressionTrendComparison,
  label = 'trend',
): string {
  const status: ModeSwitchRegressionTrendStatus =
    comparison.regressions.length > 0
      ? 'regressed'
      : comparison.improvements.length > 0
        ? 'improved'
        : 'stable'
  const lines = [
    `[mode-switch][${label}] status=${status} baselineCases=${comparison.baseline.caseCount} currentCases=${comparison.current.caseCount}`,
  ]
  if (comparison.improvements.length > 0) {
    lines.push(...comparison.improvements.map((entry) => `  improved: ${entry}`))
  }
  if (comparison.regressions.length > 0) {
    lines.push(...comparison.regressions.map((entry) => `  regressed: ${entry}`))
  }
  if (comparison.improvements.length === 0 && comparison.regressions.length === 0) {
    lines.push('  stable: key quality metrics unchanged from baseline')
  }
  return lines.join('\n')
}

function summarizeModeSwitchRegressionTrendComparison(
  comparison: ModeSwitchRegressionTrendComparison,
): { status: ModeSwitchRegressionTrendStatus; highlights: readonly string[] } {
  const status: ModeSwitchRegressionTrendStatus =
    comparison.regressions.length > 0
      ? 'regressed'
      : comparison.improvements.length > 0
        ? 'improved'
        : 'stable'
  const highlights =
    status === 'regressed'
      ? comparison.regressions
      : status === 'improved'
        ? comparison.improvements
        : (['key quality metrics unchanged'] as const)
  return Object.freeze({
    status,
    highlights: Object.freeze([...highlights]),
  })
}

export function appendModeSwitchRegressionTrendHistory(
  history: ModeSwitchRegressionTrendHistory | null | undefined,
  entry: ModeSwitchRegressionTrendHistoryEntry,
  maxEntries = 20,
): ModeSwitchRegressionTrendHistory {
  const priorEntries = history?.version === 1 ? history.entries : []
  const nextEntries = [...priorEntries, Object.freeze({ ...entry, snapshot: Object.freeze({ ...entry.snapshot }) })]
  const clampedEntries = nextEntries.slice(Math.max(0, nextEntries.length - Math.max(1, maxEntries)))
  return Object.freeze({
    version: 1,
    entries: Object.freeze(clampedEntries),
  })
}

export function buildModeSwitchRegressionHistoryLabel(args: {
  history: ModeSwitchRegressionTrendHistory | null | undefined
  explicitLabel?: string | null
  stage?: string | null
  note?: string | null
  recordedAt?: string | null
}): string {
  const explicitLabel = String(args.explicitLabel ?? '').trim()
  if (explicitLabel) {
    return normalizeModeSwitchHistoryLabelSegment(explicitLabel, 'checkpoint')
  }
  const entries = args.history?.version === 1 ? args.history.entries : []
  const stage = normalizeModeSwitchHistoryLabelSegment(args.stage, 'checkpoint')
  const sequence = String(
    entries.filter((entry) => entry.label !== 'baseline').length + 1,
  ).padStart(3, '0')
  const note = normalizeModeSwitchHistoryLabelSegment(args.note, '')
  const timestamp = compactModeSwitchHistoryTimestamp(args.recordedAt)
  return [stage, sequence, note || null, timestamp].filter(Boolean).join('-')
}

export function formatModeSwitchRegressionHistoryLabelHint(args: {
  history: ModeSwitchRegressionTrendHistory | null | undefined
  nextLabel: string
}): string {
  const entryCount = args.history?.version === 1 ? args.history.entries.length : 0
  return [
    `[mode-switch][history-hint] entries=${entryCount} nextLabel=${args.nextLabel}`,
    '  hint: use --history-label to override, or --history-stage/--history-note to generate milestone labels',
  ].join('\n')
}

export function formatModeSwitchRegressionTrendHistory(
  history: ModeSwitchRegressionTrendHistory | null | undefined,
): string {
  if (!history || history.entries.length === 0) {
    return '[mode-switch][history] empty'
  }
  const recent = history.entries.slice(Math.max(0, history.entries.length - 5))
  return [
    `[mode-switch][history] entries=${history.entries.length} showing=${recent.length}`,
    ...recent.map((entry) => {
      const snapshot = normalizeModeSwitchRegressionTrendSnapshot(entry.snapshot)
      return `- ${entry.label} recordedAt=${entry.recordedAt ?? 'n/a'} roundTripStrict=${(snapshot.roundTripStrictRate * 100).toFixed(1)}% contractPass=${(snapshot.contractPassRate * 100).toFixed(1)}% hardFail=${(snapshot.hardFailRate * 100).toFixed(1)}% rowLookupMissing=${snapshot.lookupResolutionCounts.missing} nearby=${snapshot.restoreDistanceCounts.nearby_block} arch=${snapshot.architectureRecommendation}`
    }),
  ].join('\n')
}

export function formatModeSwitchRegressionTrendHistoryTimeline(
  history: ModeSwitchRegressionTrendHistory | null | undefined,
  maxTransitions = 4,
): string {
  if (!history || history.entries.length <= 1) {
    return '[mode-switch][history-timeline] empty'
  }
  const transitions: string[] = []
  for (let i = 1; i < history.entries.length; i += 1) {
    const previous = history.entries[i - 1]!
    const current = history.entries[i]!
    const comparison = compareModeSwitchRegressionTrend(previous.snapshot, current.snapshot)
    const summary = summarizeModeSwitchRegressionTrendComparison(comparison)
    const headline = summary.highlights.slice(0, 2).join('; ')
    transitions.push(`- ${previous.label} -> ${current.label} status=${summary.status} ${headline}`)
  }
  const recentTransitions = transitions.slice(Math.max(0, transitions.length - Math.max(1, maxTransitions)))
  return [
    `[mode-switch][history-timeline] transitions=${transitions.length} showing=${recentTransitions.length}`,
    ...recentTransitions,
  ].join('\n')
}

function collectModeSwitchRegressionHistoryStageSummaries(
  history: ModeSwitchRegressionTrendHistory | null | undefined,
): readonly ModeSwitchRegressionHistoryStageSummary[] {
  if (!history || history.entries.length === 0) return Object.freeze([])

  const stageMap = new Map<string, { entryCount: number; latestLabel: string; notes: string[] }>()
  for (const entry of history.entries) {
    const meta = parseModeSwitchRegressionHistoryLabel(entry.label)
    const existing = stageMap.get(meta.stage) ?? {
      entryCount: 0,
      latestLabel: entry.label,
      notes: [],
    }
    existing.entryCount += 1
    existing.latestLabel = entry.label
    if (meta.note && !existing.notes.includes(meta.note)) existing.notes.push(meta.note)
    stageMap.set(meta.stage, existing)
  }

  return Object.freeze(
    Array.from(stageMap.entries()).map(([stage, value]) => {
      const expectedNotes = MODE_SWITCH_HISTORY_STAGE_PRESETS[stage] ?? []
      const missingNotes = expectedNotes.filter((note) => !value.notes.includes(note))
      return Object.freeze({
        stage,
        entryCount: value.entryCount,
        latestLabel: value.latestLabel,
        notes: Object.freeze([...value.notes]),
        expectedNotes: Object.freeze([...expectedNotes]),
        missingNotes: Object.freeze([...missingNotes]),
      })
    }),
  )
}

export function formatModeSwitchRegressionHistoryStageCoverage(
  history: ModeSwitchRegressionTrendHistory | null | undefined,
): string {
  const stageSummaries = collectModeSwitchRegressionHistoryStageSummaries(history)
  if (stageSummaries.length === 0) {
    return '[mode-switch][history-stages] empty'
  }

  return [
    `[mode-switch][history-stages] stages=${stageSummaries.length}`,
    ...stageSummaries.map((summary) => {
      const notes = summary.notes.length > 0 ? summary.notes.join(',') : 'none'
      if (summary.expectedNotes.length === 0) {
        return `- ${summary.stage} entries=${summary.entryCount} latest=${summary.latestLabel} notes=${notes}`
      }
      return `- ${summary.stage} entries=${summary.entryCount} latest=${summary.latestLabel} notes=${notes} coverage=${summary.notes.length}/${summary.expectedNotes.length} missing=${summary.missingNotes.join(',') || 'none'}`
    }),
  ].join('\n')
}

export function formatModeSwitchRegressionHistoryStageGuidance(
  history: ModeSwitchRegressionTrendHistory | null | undefined,
  regressionSummary?: ReturnType<typeof summarizeModeSwitchRegressionCorpus> | null,
): string {
  const stageSummaries = collectModeSwitchRegressionHistoryStageSummaries(history)
  if (stageSummaries.length === 0) {
    return '[mode-switch][history-guidance] empty'
  }
  const actionable = stageSummaries.filter((stageSummary) => stageSummary.expectedNotes.length > 0)
  if (actionable.length === 0) {
    return '[mode-switch][history-guidance] no staged milestones configured'
  }
  return [
    '[mode-switch][history-guidance] next milestones:',
    ...actionable.map((stageSummary) => {
      if (stageSummary.missingNotes.length === 0) {
        return `- ${stageSummary.stage} complete latest=${stageSummary.latestLabel}`
      }
      const nextNote = stageSummary.missingNotes[0]!
      const command = modeSwitchRegressionHistoryPresetCommand(stageSummary.stage, nextNote)
      if (stageSummary.stage !== 'p2' || !regressionSummary) {
        return `- ${stageSummary.stage} next=${nextNote} command=${command}`
      }
      const gate = regressionSummary.p2GateSummaries.find((entry) => entry.stage === nextNote)
      if (!gate) {
        return `- ${stageSummary.stage} next=${nextNote} command=${command}`
      }
      return `- ${stageSummary.stage} next=${nextNote} gate=${gate.status} recommendation=${gate.recommendation ?? 'n/a'} command=${command} reason=${gate.rationale[0] ?? 'n/a'}`
    }),
  ].join('\n')
}

export function formatModeSwitchRegressionHistoryPresets(): string {
  const lines = ['[mode-switch][history-presets] available:']
  for (const [stage, notes] of Object.entries(MODE_SWITCH_HISTORY_STAGE_PRESETS)) {
    for (const note of notes) {
      lines.push(`  ${modeSwitchRegressionHistoryPresetCommand(stage, note)}`)
    }
  }
  return lines.join('\n')
}

export function installModeSwitchRegressionGateDevtools(): void {
  if (!import.meta.env.DEV) return
  const scope = globalThis as typeof globalThis & Window
  if (scope.__runModeSwitchRegressionGate__ && scope.__assertModeSwitchRegressionGate__) return
  scope.__runModeSwitchRegressionGate__ = () => {
    const summary = summarizeModeSwitchRegressionCorpus()
    console.info(formatModeSwitchRegressionSummary(summary))
    if (summary.mismatchCount > 0) {
      console.warn(formatModeSwitchRegressionMismatchReport(summary.mismatches))
    }
    return summary
  }
  scope.__assertModeSwitchRegressionGate__ = () => {
    const assertion = assertModeSwitchRegressionCorpus()
    console.info(formatModeSwitchRegressionSummary(summarizeModeSwitchRegressionCorpus()))
    return assertion
  }
}
