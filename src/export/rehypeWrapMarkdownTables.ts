import type { Element, Parent, Root as HastRoot } from 'hast'
import { visit } from 'unist-util-visit'

const WRAP_CLASS = 'markdown-table-wrap'
const CARD_CLASS = 'luna-md-table-card'

function isAlreadyWrapped(parent: Parent | undefined): boolean {
  if (!parent || parent.type !== 'element') return false
  const el = parent as Element
  if (el.tagName !== 'div') return false
  const cn = el.properties?.className
  const list = Array.isArray(cn) ? cn : cn != null ? [String(cn)] : []
  return list.includes(WRAP_CLASS)
}

/**
 * Wrap the `<table>` output by GFM in a horizontal scroll card container, which is visually homologous to the editor `.pm-luna-table-scroll`.
 */
export function rehypeWrapMarkdownTables() {
  return (tree: HastRoot) => {
    const hits: { parent: Parent; index: number }[] = []
    visit(tree, 'element', (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== 'table' || parent == null || typeof index !== 'number') return
      if (isAlreadyWrapped(parent)) return
      hits.push({ parent, index })
    })
    for (let i = hits.length - 1; i >= 0; i--) {
      const { parent, index } = hits[i]
      const table = parent.children[index] as Element
      const wrap: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: [WRAP_CLASS, CARD_CLASS] },
        children: [table],
      }
      parent.children[index] = wrap
    }
  }
}
