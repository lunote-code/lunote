import type { ReactNode } from 'react'
import { getDocumentMeta } from '../../knowledgeRuntime'
import { useOsRevision } from './useKnowledgeOSSlice'
import { useI18n } from '../../../i18n'

type Props = {
  docKey: string | null
}

function renderFrontmatterValue(key: string, value: unknown): ReactNode {
  if (value == null) return '—'
  if (Array.isArray(value)) {
    if (key === 'tags' || key === 'aliases') {
      return (
        <span className="kos-frontmatter-chips">
          {value.map((item, i) => (
            <span key={`${key}-${i}`} className="kos-tag-chip">
              {String(item)}
            </span>
          ))}
        </span>
      )
    }
    return value.map((item) => String(item)).join(', ')
  }
  if (typeof value === 'object') {
    return <code className="kos-frontmatter-inline">{JSON.stringify(value)}</code>
  }
  return String(value)
}

export function FrontmatterPanel({ docKey }: Props) {
  const { t } = useI18n()
  const revision = useOsRevision()
  void revision

  if (!docKey) {
    return (
      <div className="kos-surface-host kos-surface-host--empty">
        <p className="kos-panel-empty">{t('knowledge.frontmatter.emptyDoc')}</p>
      </div>
    )
  }

  const meta = getDocumentMeta(docKey)
  const frontmatter = meta?.frontmatter ?? {}
  const keys = Object.keys(frontmatter)
  const orderedKeys = [
    'title',
    'tags',
    'aliases',
    'created',
    'updated',
    ...keys.filter((k) => !['title', 'tags', 'aliases', 'created', 'updated'].includes(k)).sort(),
  ].filter((k, i, arr) => arr.indexOf(k) === i && keys.includes(k))

  return (
    <div className="kos-frontmatter-panel">
      <section className="kos-backlink-section">
        <h3 className="kos-section-title">{t('knowledge.frontmatter.document')}</h3>
        <div className="kos-frontmatter-grid">
          <div className="kos-frontmatter-key">{t('knowledge.frontmatter.titleField')}</div>
          <div className="kos-frontmatter-value">{meta?.title ?? docKey}</div>
          <div className="kos-frontmatter-key">{t('knowledge.frontmatter.docKeyField')}</div>
          <div className="kos-frontmatter-value kos-panel-muted">{docKey}</div>
        </div>
      </section>
      <section className="kos-backlink-section">
        <h3 className="kos-section-title">{t('knowledge.frontmatter.title')} ({orderedKeys.length})</h3>
        {orderedKeys.length === 0 ? (
          <p className="kos-panel-muted">{t('knowledge.frontmatter.empty')}</p>
        ) : (
          <div className="kos-frontmatter-grid">
            {orderedKeys.map((key) => (
              <div key={key} className="kos-frontmatter-row">
                <div className="kos-frontmatter-key">{key}</div>
                <div className="kos-frontmatter-value">{renderFrontmatterValue(key, frontmatter[key])}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
