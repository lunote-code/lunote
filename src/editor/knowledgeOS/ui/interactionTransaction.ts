/**
 * Knowledge OS - Externally stable API; internally uses IEM (intent → plan → execute).
 */
import type { DocKey, SearchHit, WikiLinkTarget } from '../../knowledgeRuntime/types'
import {
  dispatchBacklinkFocusNavigation,
  dispatchGraphFocusNavigation,
  dispatchOpenNoteNavigation,
} from '../../../navigation/navigationFactory'
import {
  recordNavigationSideEffect,
} from '../../../navigation/navigationEventValidator'
import type { NavigationClickIntent } from '../../navigation/clickIntentResolver'
import { resolveBacklinkTarget } from '../graphIndex'
import { requestNodeActivation } from '../graphNodeActivationRuntime'
import { setPendingGraphCenter } from '../graphNavigationRuntime'
import { resolveWikiTarget } from '../wikiLinkRuntime'
import {
  executeInteractionPlan,
  executeKnowledgeIntent,
  resetInteractionExecutorState,
  type InteractionIntent,
  type InteractionIntentSource,
  type InteractionIntentType,
} from './interactionModel'

export type InteractionTransactionType =
  | 'navigate'
  | 'hover'
  | 'hover_end'
  | 'focus'
  | 'selection'
  | 'workspace_restore'
  | 'open_search'

export type InteractionSource = InteractionIntentSource

export type InteractionTransaction = {
  type: InteractionTransactionType
  source: InteractionSource
  target?: WikiLinkTarget
  docKey?: DocKey
  absolutePath?: string
  searchHit?: SearchHit
  pointer?: { x: number; y: number }
  preserveSelection?: boolean
  suppressHover?: boolean
}

export type NavigationAuthority = 'metadata' | 'compiler' | 'graph' | 'suggestion' | 'heuristic' | 'unknown'
type MetadataNavigationAuthority = Extract<NavigationAuthority, 'metadata' | 'compiler' | 'graph'>
declare const NAV_TARGET_BRAND: unique symbol

export type MetadataResolvedTarget = WikiLinkTarget & {
  readonly authority: MetadataNavigationAuthority
  readonly [NAV_TARGET_BRAND]: 'MetadataResolvedTarget'
}

type NavigationAuthorityTarget = WikiLinkTarget & { authority: NavigationAuthority }

export function asMetadataResolvedTarget(
  target: WikiLinkTarget,
  authority: MetadataNavigationAuthority = 'metadata',
): MetadataResolvedTarget {
  return { ...target, authority } as MetadataResolvedTarget
}

export function assertNavigationAuthority(target: NavigationAuthorityTarget): asserts target is MetadataResolvedTarget {
  switch (target.authority) {
    case 'metadata':
    case 'compiler':
    case 'graph':
      return
    case 'suggestion':
      throw new Error('Navigation authority rejected: suggestion target cannot navigate')
    case 'heuristic':
      throw new Error('Navigation authority rejected: heuristic target cannot navigate')
    case 'unknown':
      throw new Error('Navigation authority rejected: unknown target cannot navigate')
    default: {
      const exhaustive: never = target.authority
      throw new Error(`Navigation authority rejected: unexpected authority ${String(exhaustive)}`)
    }
  }
}

type GraphClickNavigatePayload = {
  intent: NavigationClickIntent
  hit: { docKey: DocKey; heading?: string } | null
  traceId?: string
}

type BacklinkClickNavigatePayload = {
  intent: NavigationClickIntent
  target: MetadataResolvedTarget
  backlinkId?: string
  traceId?: string
}

type ClickNavigatePayload = GraphClickNavigatePayload | BacklinkClickNavigatePayload

function isAgentLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_AGENT_LOG__?: boolean }
  if (g.__KOS_AGENT_LOG__ === true) return true
  try {
    return localStorage.getItem('kos.agentLog') === '1'
  } catch {
    return false
  }
}

function mapSource(source: InteractionSource): InteractionIntentSource {
  return source === 'command' ? 'cmdk' : source
}

function mapType(type: InteractionTransactionType): InteractionIntentType {
  if (type === 'open_search') return 'search'
  return type
}

export function transactionToIntent(tx: InteractionTransaction): InteractionIntent {
  return {
    type: mapType(tx.type),
    source: mapSource(tx.source),
    target: tx.target,
    docKey: tx.docKey,
    absolutePath: tx.absolutePath,
    searchHit: tx.searchHit,
    pointer: tx.pointer,
    modifiers: {
      preserveSelection: tx.preserveSelection,
      suppressHover: tx.suppressHover,
    },
  }
}

function reportSucceeded(
  report: ReturnType<typeof executeInteractionPlan>,
  requireNavigate?: boolean,
): boolean {
  const navIdx = report.plan.steps.findIndex((s) => s.kind === 'navigate')
  if (navIdx >= 0) return report.results[navIdx]?.ok ?? false
  if (requireNavigate) return false
  return report.results.length === 0 || report.results.every((r) => r.ok)
}

/**
 * Build the intent and execute the IEM pipeline (no imperative dispatch chain).
 */
export function runKnowledgeInteraction(tx: InteractionTransaction): boolean {
  const report = executeKnowledgeIntent(transactionToIntent(tx))
  return reportSucceeded(report, tx.type === 'navigate' || tx.type === 'workspace_restore')
}

export {
  buildInteractionPlan,
  composeInteractions,
  executeInteractionPlan,
  executeKnowledgeIntent,
  executeKnowledgeIntents,
} from './interactionModel'
export type { InteractionIntent, InteractionPlan, InteractionStep } from './interactionModel'

export function dispatchKnowledgeNavigate(source: InteractionSource, target: MetadataResolvedTarget): boolean
export function dispatchKnowledgeNavigate(source: 'graph', payload: GraphClickNavigatePayload): boolean
export function dispatchKnowledgeNavigate(source: 'backlink', payload: BacklinkClickNavigatePayload): boolean
export function dispatchKnowledgeNavigate(
  source: InteractionSource,
  targetOrPayload: MetadataResolvedTarget | ClickNavigatePayload,
): boolean {
  if ('intent' in targetOrPayload) {
    const { intent } = targetOrPayload
    const traceId = targetOrPayload.traceId ?? `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    if (isAgentLogEnabled()) {
      // #region agent log
      console.debug('[navigation-intent]', { traceId, docKey: source === 'graph' ? (targetOrPayload as GraphClickNavigatePayload).hit?.docKey ?? null : source === 'backlink' ? (targetOrPayload as BacklinkClickNavigatePayload).target.docKey ?? null : null, resolvedPath: null, root: null, eventType: null, commandType: null, source, allowDispatch: intent.allowDispatch, reason: intent.reason })
      // #endregion
    }
    if (!intent.allowDispatch) return false

    const target =
      source === 'graph'
        ? asMetadataResolvedTarget({
          docKey: (targetOrPayload as GraphClickNavigatePayload).hit!.docKey,
          heading: (targetOrPayload as GraphClickNavigatePayload).hit!.heading,
        }, 'graph')
        : (targetOrPayload as BacklinkClickNavigatePayload).target
    assertNavigationAuthority(target)
    if (isAgentLogEnabled()) {
      // #region agent log
      console.debug('[navigation-intent-emitted]', { traceId, source, docKey: target.docKey, heading: target.heading ?? null, blockId: target.blockId ?? null, intentType: intent.type, reason: intent.reason })
      // #endregion
    }

    const navEvent = source === 'graph'
      ? dispatchGraphFocusNavigation(target.docKey, {
        heading: target.heading,
        blockId: target.blockId,
        alias: target.alias,
        intentType: intent.type,
        intentReason: intent.reason,
        traceId,
      })
      : dispatchBacklinkFocusNavigation(target.docKey, {
        heading: target.heading,
        blockId: target.blockId,
        alias: target.alias,
        intentType: intent.type,
        intentReason: intent.reason,
        traceId,
      })
    recordNavigationSideEffect(navEvent.id, {
      kind: 'dispatchKnowledgeNavigate',
      source: source === 'graph' ? 'graph' : source === 'backlink' ? 'backlink' : 'system',
      docKey: target.docKey,
      meta: {
        heading: target.heading,
        blockId: target.blockId,
      },
    })
    if (source === 'backlink') {
      const wikiResolved = resolveWikiTarget(target)
      if (wikiResolved.resolvedDocKey) {
        const backlinkId =
          source === 'backlink' ? (targetOrPayload as BacklinkClickNavigatePayload).backlinkId : undefined
        const resolved = backlinkId ? resolveBacklinkTarget(backlinkId) : null
        const nodeId = resolved?.nodeId ?? `page:${wikiResolved.resolvedDocKey}`
        requestNodeActivation(nodeId)
        setPendingGraphCenter(wikiResolved.resolvedDocKey, nodeId)
      }
    }
    return true
  }

  const target = targetOrPayload
  assertNavigationAuthority(target)
  const navEvent = dispatchOpenNoteNavigation(undefined, source === 'editor' || source === 'wiki' ? 'editor' : 'system', {
    docKey: target.docKey,
    interactionSource: source,
    heading: target.heading,
    blockId: target.blockId,
    alias: target.alias,
  })
  recordNavigationSideEffect(navEvent.id, {
    kind: 'dispatchKnowledgeNavigate',
    source: source === 'editor' || source === 'wiki' ? 'editor' : 'system',
    docKey: target.docKey,
    meta: { interactionSource: source },
  })
  return true
}

export function dispatchKnowledgeNavigateHit(
  source: InteractionSource,
  hit: SearchHit,
): boolean {
  dispatchOpenNoteNavigation(hit.absolutePath, source === 'search' ? 'search' : 'system', {
    docKey: hit.docKey,
    interactionSource: source,
  })
  return true
}

export function dispatchOpenKnowledgeSearch(): boolean {
  return runKnowledgeInteraction({ type: 'open_search', source: 'command' })
}

export function dispatchWikiHover(
  target: WikiLinkTarget | null,
  pointer: { x: number; y: number },
): void {
  if (!target) {
    runKnowledgeInteraction({ type: 'hover_end', source: 'wiki', pointer })
    return
  }
  runKnowledgeInteraction({ type: 'hover', source: 'wiki', target, pointer })
}

export function resetInteractionTransactionState(): void {
  resetInteractionExecutorState()
}
