import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../i18n'
import { openPreferencesDialog } from '../../../preferences/preferencesDialogStore'
import type { DocKey } from '../../knowledgeRuntime/types'
import { createGraphWikiLink } from '../graphLinkCreationRuntime'
import type { GraphLinkSuggestionItem } from '../graphGapDetection'
import { syncNoteGraphTopologyFromRoute, syncNoteGraphTopologyGlobal } from '../noteGraphRuntime'
import type { GraphLinkSuggestionsAiError } from './useGraphLinkSuggestions'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigate,
} from './interactionTransaction'

type Props = {
  centerDocKey: DocKey
  isGlobalTopology: boolean
  suggestions: readonly GraphLinkSuggestionItem[]
  aiLoading: boolean
  aiConfigured: boolean
  aiPrefetchEnabled: boolean
  aiError: GraphLinkSuggestionsAiError | null
  onDismissSuggestion: (id: string) => void
  onSuggestionsChanged: () => void
  onClose: () => void
}

const LINK_FEEDBACK_CLEAR_MS = 3000

export function GraphDiscoveryPanel({
  centerDocKey,
  isGlobalTopology,
  suggestions,
  aiLoading,
  aiConfigured,
  aiPrefetchEnabled,
  aiError,
  onDismissSuggestion,
  onSuggestionsChanged,
  onClose,
}: Props) {
  const { t } = useI18n()
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null)
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!linkFeedback) return
    const timer = window.setTimeout(() => setLinkFeedback(null), LINK_FEEDBACK_CLEAR_MS)
    return () => window.clearTimeout(timer)
  }, [linkFeedback])

  const refreshGraph = useCallback(() => {
    if (isGlobalTopology) {
      syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
    } else {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    }
  }, [centerDocKey, isGlobalTopology])

  const onAddLink = useCallback(
    async (item: GraphLinkSuggestionItem) => {
      setLinkBusyId(item.id)
      setLinkFeedback(null)
      const result = await createGraphWikiLink({
        sourceDocKey: item.sourceDocKey,
        targetDocKey: item.targetDocKey,
        targetTitle: item.targetTitle,
      })
      setLinkBusyId(null)
      if (result === 'ok') {
        onDismissSuggestion(item.id)
        onSuggestionsChanged()
        setLinkFeedback(t('knowledge.graph.discovery.linkAdded'))
        refreshGraph()
        return
      }
      if (result === 'duplicate') {
        onDismissSuggestion(item.id)
        setLinkFeedback(t('knowledge.graph.discovery.linkDuplicate'))
        return
      }
      setLinkFeedback(t('knowledge.graph.discovery.linkFailed'))
    },
    [onDismissSuggestion, onSuggestionsChanged, refreshGraph, t],
  )

  const onOpenNote = useCallback((docKey: DocKey) => {
    dispatchKnowledgeNavigate('wiki', asMetadataResolvedTarget({ docKey }, 'compiler'))
  }, [])

  const emptyMessage = (() => {
    if (aiLoading) return t('knowledge.graph.discovery.aiLoading')
    if (!aiConfigured) return t('knowledge.graph.discovery.aiNotConfigured')
    if (!aiPrefetchEnabled) return t('knowledge.graph.discovery.aiUiDisabled')
    if (aiError === 'failed') return t('knowledge.graph.discovery.aiFailed')
    return t('knowledge.graph.discovery.suggestionsEmpty')
  })()

  return (
    <aside
      className="kos-graph-discovery"
      data-testid="kos-graph-discovery"
      aria-label={t('knowledge.graph.discovery.aria')}
    >
      <div className="kos-graph-discovery-header">
        <div className="kos-graph-discovery-heading">
          <p className="kos-graph-discovery-title">{t('knowledge.graph.discovery.title')}</p>
          <p className="kos-graph-discovery-subtitle">{t('knowledge.graph.discovery.subtitle')}</p>
        </div>
        <button
          type="button"
          className="kos-graph-discovery-close"
          aria-label={t('knowledge.graph.discovery.close')}
          data-testid="kos-graph-discovery-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="kos-graph-discovery-empty-block">
          <p className="kos-graph-discovery-empty" data-testid="kos-graph-discovery-empty">
            {emptyMessage}
          </p>
          {!aiLoading && !aiConfigured ? (
            <button
              type="button"
              className="kos-graph-limit-notice-action"
              data-testid="kos-graph-discovery-open-ai-settings"
              onClick={() => openPreferencesDialog('ai')}
            >
              {t('knowledge.graph.discovery.openAiSettings')}
            </button>
          ) : null}
          {!aiLoading && aiConfigured && !aiPrefetchEnabled ? (
            <button
              type="button"
              className="kos-graph-limit-notice-action"
              data-testid="kos-graph-discovery-open-appearance-settings"
              onClick={() => openPreferencesDialog('appearance')}
            >
              {t('knowledge.graph.discovery.openAppearanceSettings')}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="kos-graph-discovery-list">
            {suggestions.map((item) => (
              <li key={item.id} className="kos-graph-discovery-item">
                <button
                  type="button"
                  className="kos-graph-discovery-link-pair"
                  data-testid={`kos-graph-discovery-suggestion-${item.sourceDocKey}-${item.targetDocKey}`}
                  onClick={() => onOpenNote(item.targetDocKey)}
                >
                  {item.sourceTitle} → {item.targetTitle}
                </button>
                <button
                  type="button"
                  className="kos-graph-limit-notice-action"
                  data-testid={`kos-graph-discovery-add-${item.sourceDocKey}-${item.targetDocKey}`}
                  disabled={linkBusyId === item.id}
                  aria-busy={linkBusyId === item.id}
                  onClick={() => {
                    void onAddLink(item)
                  }}
                >
                  {linkBusyId === item.id
                    ? t('knowledge.graph.discovery.addLinkBusy')
                    : t('knowledge.graph.discovery.addLink')}
                </button>
              </li>
            ))}
          </ul>
          {aiLoading ? (
            <p className="kos-graph-discovery-hint" data-testid="kos-graph-discovery-loading">
              {t('knowledge.graph.discovery.aiLoadingMore')}
            </p>
          ) : null}
        </>
      )}

      {linkFeedback ? (
        <p className="kos-graph-discovery-feedback" role="status">
          {linkFeedback}
        </p>
      ) : null}
    </aside>
  )
}
