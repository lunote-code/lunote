import { useState } from 'react'
import { KnowledgeTabs, type KnowledgeRailTab } from './KnowledgeTabs'
import { Icon } from '../../../design-system/icons'
import { useI18n } from '../../../i18n'

type Props = {
  activeDocKey: string | null
  visible: boolean
  onOpenSearch: () => void
  onClose: () => void
}

export function KnowledgeRightRail({ activeDocKey, visible, onOpenSearch, onClose }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<KnowledgeRailTab>('backlinks')

  if (!visible) return null

  return (
    <aside className="kos-right-rail workspace-split mod-right-split" aria-label={t('knowledge.rail.aria')}>
      <div className="kos-rail-header">
        <div className="kos-rail-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-backlinks"
            className={tab === 'backlinks' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'backlinks'}
            aria-controls="kos-tab-backlinks"
            onClick={() => setTab('backlinks')}
          >
            <Icon name="backlinks" size="sm" tone={tab === 'backlinks' ? 'accent' : 'muted'} />
            {t('knowledge.rail.tab.backlinks')}
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-graph"
            className={tab === 'graph' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'graph'}
            aria-controls="kos-tab-graph"
            onClick={() => setTab('graph')}
          >
            <Icon name="graph" size="sm" tone={tab === 'graph' ? 'accent' : 'muted'} />
            {t('knowledge.rail.tab.graph')}
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-tags"
            className={tab === 'tags' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'tags'}
            aria-controls="kos-tab-tags"
            onClick={() => setTab('tags')}
          >
            <Icon name="list" size="sm" tone={tab === 'tags' ? 'accent' : 'muted'} />
            {t('knowledge.rail.tab.tags')}
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-frontmatter"
            className={tab === 'frontmatter' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'frontmatter'}
            aria-controls="kos-tab-frontmatter"
            onClick={() => setTab('frontmatter')}
          >
            <Icon name="note" size="sm" tone={tab === 'frontmatter' ? 'accent' : 'muted'} />
            {t('knowledge.rail.tab.frontmatter')}
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-embeds"
            className={tab === 'embeds' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'embeds'}
            aria-controls="kos-tab-embeds"
            onClick={() => setTab('embeds')}
          >
            <Icon name="assets" size="sm" tone={tab === 'embeds' ? 'accent' : 'muted'} />
            {t('knowledge.rail.tab.embeds')}
          </button>
        </div>
        <button
          type="button"
          className="icon-btn ghost-btn kos-rail-close"
          onClick={onOpenSearch}
          aria-label={t('knowledge.rail.search')}
          title={t('knowledge.rail.search')}
        >
          <Icon name="search" size="sm" stroke="strong" />
        </button>
        <button
          type="button"
          className="icon-btn ghost-btn kos-rail-close"
          onClick={onClose}
          aria-label={t('knowledge.rail.close')}
        >
          <Icon name="close" size="sm" stroke="strong" />
        </button>
      </div>
      <div className="kos-rail-body">
        <KnowledgeTabs activeDocKey={activeDocKey} tab={tab} />
      </div>
    </aside>
  )
}
