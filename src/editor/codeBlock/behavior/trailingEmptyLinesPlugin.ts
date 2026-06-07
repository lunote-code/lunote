import { Plugin, PluginKey } from '@tiptap/pm/state'

import { CODE_BLOCK_CM_ORIGIN_META } from '../cm/codeBlockCmDefer'
import { collapseCodeBlockTrailingEmptyLinesOnEdit } from './trailingEmptyLines'

const pluginKey = new PluginKey('lunaCodeBlockTrailingEmptyLines')

export function createCodeBlockTrailingEmptyLinesPlugin(): Plugin {
  return new Plugin({
    key: pluginKey,
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((transaction) => transaction.docChanged)) return null
      if (transactions.some((transaction) => transaction.getMeta(CODE_BLOCK_CM_ORIGIN_META))) return null

      const fixes: { from: number; to: number; text: string }[] = []
      newState.doc.descendants((node, pos) => {
        if (node.type.name !== 'codeBlock') return
        const text = node.textBetween(0, node.content.size, '\n', '\n')
        const collapsed = collapseCodeBlockTrailingEmptyLinesOnEdit(text)
        if (collapsed === text) return
        fixes.push({
          from: pos + 1,
          to: pos + node.nodeSize - 1,
          text: collapsed,
        })
      })

      if (fixes.length === 0) return null

      let tr = newState.tr
      for (let i = fixes.length - 1; i >= 0; i -= 1) {
        const fix = fixes[i]!
        if (fix.text.length > 0) {
          tr = tr.replaceWith(fix.from, fix.to, newState.schema.text(fix.text))
        } else {
          tr = tr.delete(fix.from, fix.to)
        }
      }
      return tr
    },
  })
}
