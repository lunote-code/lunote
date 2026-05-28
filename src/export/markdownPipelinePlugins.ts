import type { Blockquote, Parent, Paragraph, Root } from 'mdast'
import { visit } from 'unist-util-visit'
import { matchCalloutFirstLine, parseCalloutLeadingParagraph } from '../editor/lunaCallout'

function paragraphText(node: Paragraph): string {
  return node.children
    .map((child) => (child.type === 'text' || child.type === 'inlineCode' ? child.value : ''))
    .join('')
}

export function remarkStripFrontmatter() {
  return (tree: Root) => {
    tree.children = tree.children.filter((node) => {
      const type = String(node.type)
      return type !== 'yaml' && type !== 'toml'
    })
  }
}

export function remarkTyporaCallouts() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0]
      if (!first || first.type !== 'paragraph') return
      const text = paragraphText(first)
      const led = parseCalloutLeadingParagraph(text)
      if (led) {
        const { kind, body } = led
        if (body) {
          first.children = [{ type: 'text', value: body }]
        } else {
          node.children = node.children.slice(1) as Parent['children'] as Blockquote['children']
        }
        const data = (node.data ||= {})
        data.hName = 'aside'
        data.hProperties = {
          className: ['md-callout', `md-callout-${kind}`],
          'data-luna-callout': kind,
        }
        return
      }
      const kind = matchCalloutFirstLine(text.trim())
      if (!kind) return
      node.children = node.children.slice(1) as Parent['children'] as Blockquote['children']
      const data = (node.data ||= {})
      data.hName = 'aside'
      data.hProperties = {
        className: ['md-callout', `md-callout-${kind}`],
        'data-luna-callout': kind,
      }
    })
  }
}
