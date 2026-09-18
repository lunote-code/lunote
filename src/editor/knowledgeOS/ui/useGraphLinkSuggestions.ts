import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../../../settings/appSettingsStore'
import { isAiConfigured } from '../../../settings-runtime/aiSettings'
import { resolveAiButtonEnabled } from '../../../settings-runtime/editorUiChrome'
import type { DocKey } from '../../knowledgeRuntime/types'
import { fetchGraphAiLinkSuggestions } from '../graphAiLinkSuggestions'
import {
  detectGraphGaps,
  graphGapsToLinkSuggestions,
  type GraphLinkSuggestionItem,
} from '../graphGapDetection'

const AI_PREFETCH_DELAY_MS = 400

function mergeSuggestions(
  heuristic: readonly GraphLinkSuggestionItem[],
  ai: readonly GraphLinkSuggestionItem[],
  limit = 8,
): GraphLinkSuggestionItem[] {
  const merged = [...heuristic]
  const seen = new Set(merged.map((item) => `${item.sourceDocKey}\0${item.targetDocKey}`))
  for (const item of ai) {
    const key = `${item.sourceDocKey}\0${item.targetDocKey}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged.slice(0, limit)
}

export type UseGraphLinkSuggestionsInput = {
  centerDocKey: DocKey | null
  visibleDocKeys: readonly DocKey[]
  isGlobalTopology: boolean
  graphRevision?: number
}

export type GraphLinkSuggestionsAiError = 'failed'

export type UseGraphLinkSuggestionsResult = {
  suggestions: GraphLinkSuggestionItem[]
  suggestionCount: number
  aiLoading: boolean
  aiConfigured: boolean
  aiPrefetchEnabled: boolean
  aiError: GraphLinkSuggestionsAiError | null
  dismissSuggestion: (id: string) => void
  refreshSuggestions: () => void
}

export function useGraphLinkSuggestions(
  input: UseGraphLinkSuggestionsInput,
): UseGraphLinkSuggestionsResult {
  const { centerDocKey, visibleDocKeys, isGlobalTopology, graphRevision = 0 } = input
  const visibleDocKeysKey = [...visibleDocKeys].sort().join('\0')
  const [aiConfigured, setAiConfigured] = useState(() => isAiConfigured(getAppSettingsSnapshot()))
  const [aiButtonEnabled, setAiButtonEnabled] = useState(() =>
    resolveAiButtonEnabled(getAppSettingsSnapshot().appearance?.ui),
  )
  const [aiSuggestions, setAiSuggestions] = useState<GraphLinkSuggestionItem[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<GraphLinkSuggestionsAiError | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set())
  const [refreshGen, setRefreshGen] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return subscribeAppSettings(() => {
      const snapshot = getAppSettingsSnapshot()
      setAiConfigured(isAiConfigured(snapshot))
      setAiButtonEnabled(resolveAiButtonEnabled(snapshot.appearance?.ui))
    })
  }, [])

  const aiPrefetchEnabled = aiConfigured && aiButtonEnabled

  useEffect(() => {
    setDismissedIds(new Set())
    setAiSuggestions([])
    setAiLoading(false)
    setAiError(null)
  }, [centerDocKey, isGlobalTopology, visibleDocKeysKey, refreshGen, aiPrefetchEnabled, graphRevision])

  const gaps = useMemo(() => {
    if (!centerDocKey) return []
    return detectGraphGaps({
      centerDocKey,
      visibleDocKeys,
      includeWorkspaceOrphans: isGlobalTopology,
      limit: 10,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleDocKeysKey tracks array content; ref changes every graph tick
  }, [centerDocKey, isGlobalTopology, visibleDocKeysKey, graphRevision])

  const heuristicSuggestions = useMemo(() => {
    if (!centerDocKey) return []
    return graphGapsToLinkSuggestions(gaps, {
      origin: 'heuristic',
      limit: 6,
      centerDocKey,
    })
  }, [centerDocKey, gaps])

  const suggestions = useMemo(() => {
    const merged = mergeSuggestions(heuristicSuggestions, aiSuggestions)
    if (dismissedIds.size === 0) return merged
    return merged.filter((item) => !dismissedIds.has(item.id))
  }, [aiSuggestions, dismissedIds, heuristicSuggestions])

  useEffect(() => {
    if (!centerDocKey || !aiPrefetchEnabled) {
      abortRef.current?.abort()
      setAiLoading(false)
      setAiError(null)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return
      setAiLoading(true)

      const gapSummary = gaps
        .slice(0, 6)
        .map((gap) => {
          const peer = gap.peerTitle ? ` ↔ ${gap.peerTitle}` : ''
          return `- ${gap.title}${peer}`
        })
        .join('\n')

      void fetchGraphAiLinkSuggestions({
        centerDocKey,
        gapSummary,
        signal: controller.signal,
      }).then((result) => {
        if (controller.signal.aborted) return
        setAiLoading(false)
        if (result.ok) {
          setAiError(null)
          setAiSuggestions(result.suggestions)
          return
        }
        if (result.code !== 'aborted') {
          setAiError('failed')
        }
      })
    }, AI_PREFETCH_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [aiPrefetchEnabled, centerDocKey, gaps, graphRevision, isGlobalTopology, refreshGen, visibleDocKeysKey])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const dismissSuggestion = useCallback((id: string) => {
    setDismissedIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const refreshSuggestions = useCallback(() => {
    setRefreshGen((gen) => gen + 1)
  }, [])

  return {
    suggestions,
    suggestionCount: suggestions.length,
    aiLoading,
    aiConfigured,
    aiPrefetchEnabled,
    aiError,
    dismissSuggestion,
    refreshSuggestions,
  }
}
