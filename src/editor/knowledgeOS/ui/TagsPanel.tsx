import { useMemo, useState } from 'react'
import { getDocumentMeta, getDocumentsByTag, listAllTags } from '../../knowledgeRuntime'
import { asMetadataResolvedTarget, dispatchKnowledgeNavigate } from './interactionTransaction'
import { useOsRevision } from './useKnowledgeOSSlice'
import { useI18n } from '../../../i18n'

export function TagsPanel() {
  const { t } = useI18n()
  const revision = useOsRevision()
  void revision
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const tags = useMemo(() => {
    void revision
    const all = listAllTags()
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((t) => t.toLowerCase().includes(q))
  }, [query, revision])

  const activeDocs = useMemo(() => {
    void revision
    if (!activeTag) return []
    return getDocumentsByTag(activeTag)
      .map((docKey) => ({
        docKey,
        title: getDocumentMeta(docKey)?.title ?? docKey,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [activeTag, revision])

  return (
    <div className="kos-tags-panel">
      <input
        className="kos-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('knowledge.tags.filter.placeholder')}
        aria-label={t('knowledge.tags.filter.aria')}
      />
      {tags.length === 0 ? (
        <p className="kos-panel-muted">{t('knowledge.tags.empty')}</p>
      ) : (
        <ul className="kos-virtual-list kos-tags-list">
          {tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                className={`kos-link-btn kos-tag-btn${activeTag === tag ? ' kos-tag-btn--active' : ''}`}
                onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
              >
                <span className="kos-tag-label">#{tag}</span>
                <span className="kos-tag-count">{getDocumentsByTag(tag).length}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {activeTag ? (
        <section className="kos-backlink-section kos-tags-docs">
          <h3 className="kos-section-title">{t('knowledge.tags.notes', { count: activeDocs.length })}</h3>
          {activeDocs.length === 0 ? (
            <p className="kos-panel-muted">{t('knowledge.tags.emptyFor', { tag: activeTag })}</p>
          ) : (
            <ul className="kos-virtual-list">
              {activeDocs.map((doc) => (
                <li key={doc.docKey}>
                  <button
                    type="button"
                    className="kos-link-btn"
                    onClick={() =>
                      dispatchKnowledgeNavigate('tag', asMetadataResolvedTarget({ docKey: doc.docKey }, 'metadata'))
                    }
                  >
                    {doc.title}
                    <span className="kos-panel-muted"> {doc.docKey}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
