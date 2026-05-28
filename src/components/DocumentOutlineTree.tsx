import { memo } from 'react'
import { Icon } from '../design-system/icons'
import { useI18n } from '../i18n'
import type { HeadingOutlineTreeNode } from '../editor/outlineHeadingTree'

export type DocumentOutlineTreeProps = {
  nodes: HeadingOutlineTreeNode[]
  activeId: string
  onJump: (id: string) => void
  /** Sidebar outline: collapsible subtree; all [toc] in the text are expanded by default*/
  collapsible?: boolean
  collapsedPaths?: Set<string>
  onTogglePath?: (path: string) => void
}

type OutlineRowsProps = DocumentOutlineTreeProps & {
  pathPrefix: string
}

const OutlineRows = memo(function OutlineRows({
  nodes,
  pathPrefix,
  activeId,
  onJump,
  collapsible = false,
  collapsedPaths = new Set<string>(),
  onTogglePath = () => {},
}: OutlineRowsProps) {
  const { t } = useI18n()
  const isRoot = pathPrefix === ''

  return (
    <div className={isRoot ? 'document-outline-tree document-outline-tree--root' : 'document-outline-branch'}>
      {nodes.map((node, i) => {
        const path = pathPrefix === '' ? String(i) : `${pathPrefix}-${i}`
        const hasChildren = node.children.length > 0
        const expanded = !collapsible || !collapsedPaths.has(path)
        return (
          <div key={path} className="document-outline-item" data-outline-level={node.level}>
            <div className="document-outline-row">
              <span className="document-outline-node-dot" aria-hidden />
              <button
                type="button"
                className={`document-outline-link${activeId === node.id ? ' active' : ''}`}
                title={node.title}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onJump(node.id)
                }}
              >
                {node.title}
              </button>
              {collapsible && hasChildren ? (
                <button
                  type="button"
                  className="document-outline-chevron"
                  aria-expanded={expanded}
                  aria-label={expanded ? t('outline.collapse') : t('outline.expand')}
                  onClick={() => onTogglePath(path)}
                >
                  {expanded ? (
                    <Icon name="chevron-down" size="sm" stroke="strong" />
                  ) : (
                    <Icon name="chevron-right" size="sm" stroke="strong" />
                  )}
                </button>
              ) : null}
            </div>
            {hasChildren && expanded ? (
              <div className="document-outline-branch-wrap">
                <OutlineRows
                  nodes={node.children}
                  pathPrefix={path}
                  activeId={activeId}
                  onJump={onJump}
                  collapsible={collapsible}
                  collapsedPaths={collapsedPaths}
                  onTogglePath={onTogglePath}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
})

/** Vertical timeline style Markdown document outline navigation on the left (shared with sidebar and in-text [toc])*/
export const DocumentOutlineTree = memo(function DocumentOutlineTree(props: DocumentOutlineTreeProps) {
  return <OutlineRows {...props} pathPrefix="" />
})
