import type { Parent, Root, Strong, Text } from 'mdast'
import { visit } from 'unist-util-visit'

type Replace = { parent: Parent; index: number; nodes: (Text | Strong)[] }

/**
 * Typora / Obsidian style `==highlight==`, converted to strong with class (without rehype-raw, to avoid HTML injection).
 * Text within fenced/indented code blocks is not processed (code in mdast is an independent `code` node with no child `text`).
 */
export default function remarkEqualHighlight() {
  return (tree: Root) => {
    const replacements: Replace[] = []
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      const value = node.value
      if (!value.includes('==')) return

      const re = /==([^=\n]+)==/g
      const nodes: (Text | Strong)[] = []
      let last = 0
      let hit = false
      let m: RegExpExecArray | null
      while ((m = re.exec(value)) !== null) {
        hit = true
        if (m.index > last) {
          nodes.push({ type: 'text', value: value.slice(last, m.index) })
        }
        const inner = m[1]
        if (inner.length > 0) {
          const markStrong: Strong = {
            type: 'strong',
            data: { hProperties: { className: ['md-mark-highlight'] } },
            children: [{ type: 'text', value: inner }],
          }
          nodes.push(markStrong)
        }
        last = m.index + m[0].length
      }
      if (!hit) return
      if (last < value.length) {
        nodes.push({ type: 'text', value: value.slice(last) })
      }
      replacements.push({ parent, index, nodes })
    })

    const byParent = new Map<Parent, Replace[]>()
    for (const r of replacements) {
      const list = byParent.get(r.parent)
      if (list) list.push(r)
      else byParent.set(r.parent, [r])
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => b.index - a.index)
      for (const { parent, index, nodes } of list) {
        parent.children.splice(index, 1, ...(nodes as typeof parent.children))
      }
    }
  }
}
