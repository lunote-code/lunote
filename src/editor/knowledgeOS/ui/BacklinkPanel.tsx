import { memo, useCallback, useRef } from 'react'
import { Icon } from '../../../design-system/icons'
import { useBacklinkSlice } from './useKnowledgeOSSlice'
import {
  backlinkIdForDoc,
  backlinkIdForInbound,
  backlinkIdForOutbound,
} from '../backlinkNavigation'
import { useSurfaceLayout } from './useSurfaceLayout'
import { isSurfaceResizing } from '../layout/surfaceSplitLayoutRuntime'
import type { WikiLinkTarget } from '../../knowledgeRuntime/types'
import { normalizeDocKeyForNavigation, resolveCanonicalIdentity } from '../../knowledgeRuntime'
import { resolveClickIntent } from '../../navigation/clickIntentResolver'
import { asMetadataResolvedTarget, dispatchKnowledgeNavigate } from './interactionTransaction'
import { resolveWikiTarget } from '../wikiLinkRuntime'
import { useI18n } from '../../../i18n'

type Props = {
  docKey: string | null
}

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

type NavigateFn = (
  event: React.MouseEvent<HTMLButtonElement>,
  backlinkId: string,
  target: WikiLinkTarget,
) => void

const InboundGroupList = memo(function InboundGroupList({
  groups,
  onNavigate,
}: {
  groups: NonNullable<ReturnType<typeof useBacklinkSlice>>['inbound']
  onNavigate: NavigateFn
}) {
  return (
    <ul className="kos-virtual-list">
      {groups.map((group) => (
        <li key={group.sourceDocKey} className="kos-backlink-group">
          <button
            type="button"
            className="kos-link-btn kos-backlink-source"
            onClick={(event) =>
              onNavigate(
                event,
                backlinkIdForDoc(group.sourceDocKey),
                {
                  docKey: group.sourceDocKey,
                  heading: group.items[0]?.heading,
                  blockId: group.items[0]?.blockId,
                },
              )
            }
          >
            {group.sourceTitle}
          </button>
          <ul className="kos-backlink-items">
            {group.items.map((item, i) => (
              <li key={`${group.sourceDocKey}-${i}`}>
                <button
                  type="button"
                  className="kos-link-btn kos-backlink-snippet"
                  onClick={(event) =>
                    onNavigate(
                      event,
                      backlinkIdForInbound(group.sourceDocKey, i),
                      {
                        docKey: group.sourceDocKey,
                        heading: item.heading,
                        blockId: item.blockId,
                      },
                    )
                  }
                >
                  <code>{item.raw}</code>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
})

const OutboundList = memo(function OutboundList({
  outbound,
  onNavigate,
}: {
  outbound: NonNullable<ReturnType<typeof useBacklinkSlice>>['outbound']
  onNavigate: NavigateFn
}) {
  return (
    <ul className="kos-virtual-list">
      {outbound.map((o, i) => (
        <li key={`${o.targetDocKey}-${i}`}>
          <button
            type="button"
            className="kos-link-btn"
            onClick={(event) =>
              onNavigate(
                event,
                backlinkIdForOutbound(o.targetDocKey),
                {
                  docKey: o.targetDocKey,
                  heading: o.heading,
                  blockId: o.blockId,
                  alias: o.alias,
                },
              )
            }
          >
            {o.targetTitle}
            <span className="kos-panel-muted"> {o.raw}</span>
          </button>
        </li>
      ))}
    </ul>
  )
})

export function BacklinkPanel({ docKey }: Props) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  useSurfaceLayout('backlink', hostRef)
  const panel = useBacklinkSlice(docKey)
  const resizing = isSurfaceResizing()

  const onNavigate = useCallback<NavigateFn>((event, backlinkId, target) => {
    const traceId = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const normalizedDocKey = normalizeDocKeyForNavigation(target.docKey)
    let normalizedTarget: WikiLinkTarget = {
      ...target,
      docKey: normalizedDocKey,
    }
    const resolved = resolveWikiTarget(normalizedTarget)
    if (resolved.resolvedDocKey) {
      normalizedTarget = {
        ...normalizedTarget,
        docKey: resolved.resolvedDocKey,
        heading: normalizedTarget.heading ?? resolved.rawTarget.heading,
      }
    }
    const identity = resolveCanonicalIdentity(normalizedDocKey)
    const intent = resolveClickIntent({
      type: 'backlink',
      event,
      uiDisabled: false,
      meta: {
        backlinkId,
        docKey: normalizedTarget.docKey,
        heading: normalizedTarget.heading,
        blockId: normalizedTarget.blockId,
      },
    })
    if (isAgentLogEnabled()) {
      // #region agent log
      console.debug('[backlink-click]', { traceId, docKey: normalizedTarget.docKey ?? null, resolvedPath: null, root: null, eventType: null, commandType: null, backlinkId, heading: normalizedTarget.heading ?? null, blockId: normalizedTarget.blockId ?? null, allowDispatch: intent.allowDispatch, reason: intent.reason })
      console.debug('[backlink-resolve]', { traceId, identity, backlinkId, heading: normalizedTarget.heading ?? null, blockId: normalizedTarget.blockId ?? null })
      // #endregion
    }
    dispatchKnowledgeNavigate('backlink', {
      intent,
      backlinkId,
      target: asMetadataResolvedTarget(normalizedTarget, 'metadata'),
      traceId,
    })
  }, [])

  if (!docKey) {
    return (
      <div className="kos-surface-host kos-surface-host--empty" ref={hostRef}>
        <Icon name="backlinks" size="display" tone="muted" />
        <p className="kos-panel-empty">{t('knowledge.backlinks.emptyDoc')}</p>
      </div>
    )
  }
  if (!panel) {
    return (
      <div className="kos-surface-host kos-surface-host--empty" ref={hostRef}>
        <Icon name="backlinks" size="display" tone="muted" />
        <p className="kos-panel-empty">{t('knowledge.backlinks.loading')}</p>
      </div>
    )
  }

  const inboundLoading = !panel.inboundHydrated
  const showInboundList = panel.inboundHydrated && panel.inbound.length > 0
  const showInboundEmpty = panel.inboundHydrated && panel.inbound.length === 0
  const showStalePreview = inboundLoading && panel.inbound.length > 0

  return (
    <div className="kos-surface-host" ref={hostRef}>
      <div className={`kos-backlink-panel${resizing ? ' kos-backlink-panel--resizing' : ''}`}>
        <div className="kos-backlink-scroll">
          <section className="kos-backlink-section">
            <h3 className="kos-section-title">
              {t('knowledge.backlinks.title')}
              {panel.inboundHydrated ? ` (${panel.inbound.length})` : ''}
            </h3>
            {inboundLoading && !showStalePreview ? (
              <p className="kos-panel-muted">{t('knowledge.backlinks.building')}</p>
            ) : null}
            {inboundLoading && showStalePreview ? (
              <p className="kos-panel-muted">{t('knowledge.backlinks.updating')}</p>
            ) : null}
            {showInboundEmpty ? (
              <p className="kos-panel-muted">{t('knowledge.backlinks.empty')}</p>
            ) : null}
            {showInboundList || showStalePreview ? (
              <div className={showStalePreview ? 'kos-backlink-list--stale' : undefined}>
                <InboundGroupList groups={panel.inbound} onNavigate={onNavigate} />
              </div>
            ) : null}
          </section>
          <section className="kos-backlink-section">
            <h3 className="kos-section-title">{t('knowledge.backlinks.outbound')} ({panel.outbound.length})</h3>
            {panel.outbound.length === 0 ? (
              <p className="kos-panel-muted">{t('knowledge.backlinks.outboundEmpty')}</p>
            ) : (
              <OutboundList outbound={panel.outbound} onNavigate={onNavigate} />
            )}
          </section>

          <section className="kos-backlink-section">
            <h3 className="kos-section-title">{t('knowledge.backlinks.mentions')} ({panel.mentions.length})</h3>
            {panel.mentions.length === 0 ? (
              <p className="kos-panel-muted">{t('knowledge.backlinks.mentionsEmpty')}</p>
            ) : (
              <ul className="kos-virtual-list">
                {panel.mentions.map((mention, i) => (
                  <li key={`${mention.suggestedDocKey}-${mention.phrase}-${i}`}>
                    <button
                      type="button"
                      className="kos-link-btn kos-backlink-snippet"
                      onClick={(event) =>
                        onNavigate(
                          event,
                          backlinkIdForOutbound(mention.suggestedDocKey),
                          { docKey: mention.suggestedDocKey },
                        )
                      }
                    >
                      <code>{mention.phrase}</code>
                      <span className="kos-panel-muted"> → {mention.suggestedTitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>        </div>
      </div>
    </div>
  )
}
