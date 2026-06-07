import { useEffect, useState, type KeyboardEvent } from 'react'
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
  const [tab, setTab] = useState<KnowledgeRailTab>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('knowledgeRailTab') : null
    return saved === 'graph' || saved === 'tags' || saved === 'frontmatter' || saved === 'embeds' ? saved : 'backlinks'
  })

  useEffect(() => {
    window.localStorage.setItem('knowledgeRailTab', tab)
  }, [tab])

  const tabs: KnowledgeRailTab[] = ['backlinks', 'graph', 'tags', 'frontmatter', 'embeds']
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: KnowledgeRailTab) => {
    const currentIndex = tabs.indexOf(current)
    if (currentIndex < 0) return
    const focusTab = (index: number) => {
      const next = tabs[((index % tabs.length) + tabs.length) % tabs.length]
      setTab(next)
      document.getElementById(`kos-tab-btn-${next}`)?.focus()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusTab(currentIndex + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusTab(currentIndex - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusTab(tabs.length - 1)
    }
  }

  const tabLabels: Record<KnowledgeRailTab, string> = {
    backlinks: t('knowledge.rail.tab.backlinks'),
    graph: t('knowledge.rail.tab.graph'),
    tags: t('knowledge.rail.tab.tags'),
    frontmatter: t('knowledge.rail.tab.frontmatter'),
    embeds: t('knowledge.rail.tab.embeds'),
  }

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
            onKeyDown={(event) => onTabKeyDown(event, 'backlinks')}
            tabIndex={tab === 'backlinks' ? 0 : -1}
            title={tabLabels.backlinks}
          >
            <Icon name="backlinks" size="sm" tone={tab === 'backlinks' ? 'accent' : 'muted'} />
            <span className="kos-rail-tab-label">{tabLabels.backlinks}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-graph"
            className={tab === 'graph' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'graph'}
            aria-controls="kos-tab-graph"
            onClick={() => setTab('graph')}
            onKeyDown={(event) => onTabKeyDown(event, 'graph')}
            tabIndex={tab === 'graph' ? 0 : -1}
            title={tabLabels.graph}
          >
            <Icon name="graph" size="sm" tone={tab === 'graph' ? 'accent' : 'muted'} />
            <span className="kos-rail-tab-label">{tabLabels.graph}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-tags"
            className={tab === 'tags' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'tags'}
            aria-controls="kos-tab-tags"
            onClick={() => setTab('tags')}
            onKeyDown={(event) => onTabKeyDown(event, 'tags')}
            tabIndex={tab === 'tags' ? 0 : -1}
            title={tabLabels.tags}
          >
            <Icon name="tags" size="sm" tone={tab === 'tags' ? 'accent' : 'muted'} />
            <span className="kos-rail-tab-label">{tabLabels.tags}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-frontmatter"
            className={tab === 'frontmatter' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'frontmatter'}
            aria-controls="kos-tab-frontmatter"
            onClick={() => setTab('frontmatter')}
            onKeyDown={(event) => onTabKeyDown(event, 'frontmatter')}
            tabIndex={tab === 'frontmatter' ? 0 : -1}
            title={tabLabels.frontmatter}
          >
            <Icon name="frontmatter" size="sm" tone={tab === 'frontmatter' ? 'accent' : 'muted'} />
            <span className="kos-rail-tab-label">{tabLabels.frontmatter}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="kos-tab-btn-embeds"
            className={tab === 'embeds' ? 'kos-rail-tab active' : 'kos-rail-tab'}
            aria-selected={tab === 'embeds'}
            aria-controls="kos-tab-embeds"
            onClick={() => setTab('embeds')}
            onKeyDown={(event) => onTabKeyDown(event, 'embeds')}
            tabIndex={tab === 'embeds' ? 0 : -1}
            title={tabLabels.embeds}
          >
            <Icon name="embeds" size="sm" tone={tab === 'embeds' ? 'accent' : 'muted'} />
            <span className="kos-rail-tab-label">{tabLabels.embeds}</span>
          </button>
        </div>
        <button
          type="button"
          className="icon-btn ghost-btn kos-rail-close kos-rail-knowledge-search"
          onClick={onOpenSearch}
          aria-label={t('knowledge.rail.searchScopeTitle')}
          title={t('knowledge.rail.searchScopeTitle')}
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
