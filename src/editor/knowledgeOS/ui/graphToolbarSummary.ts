import type { NoteGraphFilterPreference } from '../graphFilterPreference'

type SummaryInput = {
  isGlobal: boolean
  depth: number
  nodeCount: number
  edgeCount: number
  filters: NoteGraphFilterPreference
  t: (key: string, params?: Record<string, string | number>) => string
}

export function buildGraphToolbarSubtitle(input: SummaryInput): string {
  const { isGlobal, depth, nodeCount, edgeCount, filters, t } = input
  const tagSuffix = filters.filterTag ? ` · #${filters.filterTag}` : ''
  if (isGlobal) {
    return `${t('knowledge.graph.globalHint', { nodeCount, edgeCount })}${tagSuffix}`
  }
  return `${t('knowledge.graph.hint', { depth, nodeCount, edgeCount })}${tagSuffix}`
}

export function buildGraphMoreMenuSummary(input: SummaryInput): string {
  const { isGlobal, depth, filters, t } = input
  const directionKey =
    filters.edgeDirection === 'incoming'
      ? 'knowledge.graph.directionIncomingShort'
      : filters.edgeDirection === 'outgoing'
        ? 'knowledge.graph.directionOutgoingShort'
        : 'knowledge.graph.directionAllShort'
  const parts = [
    isGlobal ? t('knowledge.graph.globalTitle') : t('knowledge.graph.hintShort', { depth }),
    t(directionKey),
  ]
  if (filters.showUnresolved) parts.push(t('knowledge.graph.filterUnresolvedShort'))
  if (filters.showHeadingNodes) parts.push(t('knowledge.graph.filterHeadingNodesShort'))
  if (filters.alwaysShowLabels) parts.push(t('knowledge.graph.filterAlwaysShowLabelsShort'))
  if (filters.filterTag) parts.push(`#${filters.filterTag}`)
  if (filters.colorByTag) parts.push(t('knowledge.graph.filterColorByTagShort'))
  return parts.join(' · ')
}
