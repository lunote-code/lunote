import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { EmptyState } from '../../../design-system/EmptyState'
import { extractAliases, extractTags, extractTitle } from '../../knowledgeRuntime/wikiLinkParser'
import { noteTitleFromDocKey } from '../vaultRuntime'
import { FrontmatterChipField } from './FrontmatterChipField'
import { FrontmatterSectionHeading } from './FrontmatterSectionHeading'
import { getKnowledgeInteractionHost } from './knowledgeInteractionHost'
import { useDocumentFrontmatter } from './useDocumentFrontmatter'
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
  const [busy, setBusy] = useState(false)
  const { fields: frontmatter } = useDocumentFrontmatter(docKey)

  const tags = useMemo(() => extractTags(frontmatter), [frontmatter])
  const aliases = useMemo(() => extractAliases(frontmatter), [frontmatter])
  const fallbackTitle = docKey ? extractTitle(docKey, frontmatter) : ''
  const yamlTitle = typeof frontmatter.title === 'string' ? frontmatter.title : ''
  const [titleDraft, setTitleDraft] = useState(yamlTitle)

  useEffect(() => {
    setTitleDraft(yamlTitle)
  }, [yamlTitle, docKey])

  const patchFrontmatter = useCallback(
    async (updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
      if (!docKey) return
      const host = getKnowledgeInteractionHost()
      if (!host?.updateDocumentFrontmatter) return
      setBusy(true)
      try {
        await host.updateDocumentFrontmatter(docKey, updater)
      } finally {
        setBusy(false)
      }
    },
    [docKey],
  )

  const commitTitle = useCallback(() => {
    const trimmed = titleDraft.trim()
    if (trimmed === yamlTitle.trim()) return
    void patchFrontmatter((current) => {
      const next = { ...current }
      if (trimmed) {
        next.title = trimmed
      } else {
        delete next.title
      }
      return next
    })
  }, [patchFrontmatter, titleDraft, yamlTitle])

  const setTags = useCallback(
    (nextTags: string[]) => {
      void patchFrontmatter((current) => ({
        ...current,
        tags: nextTags,
      }))
    },
    [patchFrontmatter],
  )

  const setAliases = useCallback(
    (nextAliases: string[]) => {
      void patchFrontmatter((current) => ({
        ...current,
        aliases: nextAliases,
      }))
    },
    [patchFrontmatter],
  )

  const onAddTag = useCallback(
    (tag: string) => {
      const next = [...tags]
      if (!next.includes(tag)) next.push(tag)
      setTags(next)
    },
    [setTags, tags],
  )

  const onRemoveTag = useCallback(
    (tag: string) => {
      setTags(tags.filter((item) => item !== tag))
    },
    [setTags, tags],
  )

  const onAddAlias = useCallback(
    (alias: string) => {
      const next = [...aliases]
      if (!next.includes(alias)) next.push(alias)
      setAliases(next)
    },
    [aliases, setAliases],
  )

  const onRemoveAlias = useCallback(
    (alias: string) => {
      setAliases(aliases.filter((item) => item !== alias))
    },
    [aliases, setAliases],
  )

  if (!docKey) {
    return (
      <div className="kos-surface-host kos-surface-host--empty">
        <EmptyState variant="compact" icon="frontmatter" title={t('knowledge.frontmatter.emptyDoc')} />
      </div>
    )
  }

  const keys = Object.keys(frontmatter)
  const orderedKeys = [
    'title',
    'tags',
    'aliases',
    'created',
    'updated',
    ...keys.filter((k) => !['title', 'tags', 'aliases', 'created', 'updated'].includes(k)).sort(),
  ].filter(
    (k, i, arr) =>
      arr.indexOf(k) === i &&
      keys.includes(k) &&
      k !== 'tags' &&
      k !== 'aliases' &&
      k !== 'title',
  )

  const host = getKnowledgeInteractionHost()
  const canEdit = Boolean(host?.updateDocumentFrontmatter && host.getRootDir())
  const titlePlaceholder = docKey ? noteTitleFromDocKey(docKey) : fallbackTitle

  return (
    <div className="kos-frontmatter-panel">
      <section className="kos-backlink-section">
        <FrontmatterSectionHeading
          title={t('knowledge.frontmatter.document')}
          help={
            canEdit
              ? {
                  title: t('knowledge.frontmatter.document'),
                  body: t('knowledge.frontmatter.propertiesHintTooltip'),
                }
              : undefined
          }
        />
        <div className="kos-frontmatter-grid">
          <div className="kos-frontmatter-key">{t('knowledge.frontmatter.titleField')}</div>
          <div className="kos-frontmatter-value">
            {canEdit ? (
              <input
                type="text"
                className="kos-frontmatter-title-input"
                value={titleDraft}
                disabled={busy}
                placeholder={titlePlaceholder}
                aria-label={t('knowledge.frontmatter.titleField')}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => commitTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
              />
            ) : (
              fallbackTitle
            )}
          </div>
          <div className="kos-frontmatter-key">{t('knowledge.frontmatter.docKeyField')}</div>
          <div className="kos-frontmatter-value kos-panel-muted">{docKey}</div>
        </div>
      </section>
      <section className="kos-backlink-section">
        <FrontmatterSectionHeading
          title={t('knowledge.frontmatter.tagsTitle')}
          help={
            canEdit
              ? {
                  title: t('knowledge.frontmatter.tagsTitle'),
                  body: t('knowledge.frontmatter.tagsHintTooltip'),
                }
              : undefined
          }
        />
        {canEdit ? (
          <FrontmatterChipField
            kind="tag"
            docKey={docKey}
            chips={tags}
            disabled={busy}
            onAdd={onAddTag}
            onRemove={onRemoveTag}
          />
        ) : (
          <div className="kos-frontmatter-value">
            {tags.length > 0 ? (
              renderFrontmatterValue('tags', tags)
            ) : (
              <span className="kos-panel-muted">{t('knowledge.frontmatter.tagsEmpty')}</span>
            )}
          </div>
        )}
      </section>
      <section className="kos-backlink-section">
        <FrontmatterSectionHeading
          title={t('knowledge.frontmatter.aliasesTitle')}
          help={
            canEdit
              ? {
                  title: t('knowledge.frontmatter.aliasesTitle'),
                  body: t('knowledge.frontmatter.aliasesHintTooltip'),
                }
              : undefined
          }
        />
        {canEdit ? (
          <FrontmatterChipField
            kind="alias"
            docKey={docKey}
            chips={aliases}
            disabled={busy}
            onAdd={onAddAlias}
            onRemove={onRemoveAlias}
          />
        ) : aliases.length > 0 ? (
          <div className="kos-frontmatter-value">{renderFrontmatterValue('aliases', aliases)}</div>
        ) : (
          <p className="kos-panel-muted">{t('knowledge.frontmatter.aliasesEmpty')}</p>
        )}
      </section>
      <section className="kos-backlink-section">
        <FrontmatterSectionHeading
          title={`${t('knowledge.frontmatter.moreFields')} (${orderedKeys.length})`}
        />
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
