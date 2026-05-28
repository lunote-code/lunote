import { useEffect, useMemo, useState } from 'react'
import { getDocumentMeta } from '../../knowledgeRuntime'
import { stripLeadingYamlFrontmatter } from '../../lunaMarkdownExtensionsPreprocess'
import { loadNoteContent } from '../vaultRuntime'
import { resolveWikiTarget } from '../wikiLinkRuntime'
import { asMetadataResolvedTarget, dispatchKnowledgeNavigate } from './interactionTransaction'
import { useOsRevision } from './useKnowledgeOSSlice'
import { useI18n } from '../../../i18n'

type Props = {
  docKey: string | null
}

type EmbedPreview = {
  id: string
  targetDocKey: string
  title: string
  heading?: string
  blockId?: string
  raw: string
  snippet: string
  unresolved: boolean
}

function buildSnippet(markdown: string): string {
  const { body } = stripLeadingYamlFrontmatter(markdown)
  const cleaned = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/gu, ' ')
  if (!cleaned) return ''
  return cleaned.length > 180 ? `${cleaned.slice(0, 180)}…` : cleaned
}

function embedLabel(title: string, heading?: string, blockId?: string): string {
  const parts = [title]
  if (heading) parts.push(`#${heading}`)
  if (blockId) parts.push(`^${blockId}`)
  return parts.join(' ')
}

export function EmbedsPanel({ docKey }: Props) {
  const { t } = useI18n()
  const revision = useOsRevision()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<EmbedPreview[]>([])

  const embeds = useMemo(() => {
    void revision
    if (!docKey) return []
    const meta = getDocumentMeta(docKey)
    return meta?.embeds ?? []
  }, [docKey, revision])

  useEffect(() => {
    let cancelled = false
    if (!docKey) {
      setItems([])
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    if (embeds.length === 0) {
      setItems([])
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    const load = async () => {
      setLoading(true)
      const previews = await Promise.all(
        embeds.map(async (link, idx) => {
          const resolved = resolveWikiTarget(link.target)
          const targetDocKey = resolved.resolvedDocKey ?? link.target.docKey
          let snippet = ''
          if (resolved.resolvedDocKey && resolved.absolutePath) {
            const content = await loadNoteContent(resolved.resolvedDocKey, resolved.absolutePath)
            snippet = buildSnippet(content)
          }
          return {
            id: `${targetDocKey}-${link.start}-${idx}`,
            targetDocKey,
            title: resolved.displayLabel,
            heading: link.target.heading,
            blockId: link.target.blockId,
            raw: link.raw,
            snippet,
            unresolved: !resolved.resolvedDocKey,
          }
        }),
      )
      if (!cancelled) {
        setItems(previews)
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [docKey, embeds])

  if (!docKey) {
    return (
      <div className="kos-surface-host kos-surface-host--empty">
        <p className="kos-panel-empty">{t('knowledge.embeds.emptyDoc')}</p>
      </div>
    )
  }

  return (
    <div className="kos-embed-panel">
      <section className="kos-backlink-section">
        <h3 className="kos-section-title">{t('knowledge.embeds.title')} ({embeds.length})</h3>
        {loading ? <p className="kos-panel-muted">{t('knowledge.embeds.loading')}</p> : null}
        {embeds.length === 0 ? <p className="kos-panel-muted">{t('knowledge.embeds.empty')}</p> : null}
        <ul className="kos-virtual-list">
          {items.map((item) => (
            <li key={item.id} className="kos-embed-card">
              <button
                type="button"
                className="kos-link-btn kos-embed-title"
                onClick={() =>
                  dispatchKnowledgeNavigate(
                    'backlink',
                    asMetadataResolvedTarget(
                      {
                        docKey: item.targetDocKey,
                        heading: item.heading,
                        blockId: item.blockId,
                      },
                      'metadata',
                    ),
                  )
                }
                disabled={item.unresolved}
              >
                {embedLabel(item.title, item.heading, item.blockId)}
                {item.unresolved ? <span className="kos-panel-muted"> ({t('knowledge.embeds.missing')})</span> : null}
              </button>
              <div className="kos-embed-meta">
                <code>{item.raw}</code>
              </div>
              {item.snippet ? <p className="kos-embed-snippet">{item.snippet}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
