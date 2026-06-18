import { useRef } from 'react'
import { BacklinkPanel } from './BacklinkPanel'
import { EmbedsPanel } from './EmbedsPanel'
import { FrontmatterPanel } from './FrontmatterPanel'
import { GraphPanel } from './GraphPanel'
import { TagsPanel } from './TagsPanel'
import { useTabSurfaceLayout } from './useTabSurfaceLayout'

export type KnowledgeRailTab = 'backlinks' | 'graph' | 'tags' | 'frontmatter' | 'embeds'

type Props = {
  activeDocKey: string | null
  tab: KnowledgeRailTab
  focusedTag?: string | null
  onTagNavigate?: (tag: string) => void
}

export function KnowledgeTabs({ activeDocKey, tab, focusedTag = null, onTagNavigate }: Props) {
  const tabRootRef = useRef<HTMLDivElement>(null)
  const tabPanelRef = useRef<HTMLDivElement>(null)
  useTabSurfaceLayout(tab, tabRootRef, tabPanelRef)
  const tabId =
    tab === 'backlinks'
      ? 'kos-tab-backlinks'
      : tab === 'graph'
        ? 'kos-tab-graph'
        : tab === 'tags'
          ? 'kos-tab-tags'
          : tab === 'frontmatter'
            ? 'kos-tab-frontmatter'
            : 'kos-tab-embeds'
  const tabLabelId = `${tabId.replace('kos-tab-', 'kos-tab-btn-')}`

  return (
    <div className="kos-surface-split-host">
    <div className="kos-tab-root" ref={tabRootRef}>
      <div className="kos-tab-content">
        <div
          className="kos-tab-panel"
          ref={tabPanelRef}
          role="tabpanel"
          id={tabId}
          aria-labelledby={tabLabelId}
        >
          {tab === 'backlinks' ? (
            <BacklinkPanel key={activeDocKey ?? 'none'} docKey={activeDocKey} />
          ) : tab === 'graph' ? (
            <GraphPanel key={activeDocKey ?? 'none'} centerDocKey={activeDocKey} />
          ) : tab === 'tags' ? (
            <TagsPanel focusTag={focusedTag} />
          ) : tab === 'frontmatter' ? (
            <FrontmatterPanel key={activeDocKey ?? 'none'} docKey={activeDocKey} onTagNavigate={onTagNavigate} />
          ) : (
            <EmbedsPanel key={activeDocKey ?? 'none'} docKey={activeDocKey} />
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
