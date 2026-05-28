import Heading from '@tiptap/extension-heading'
import { textblockTypeInputRule } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { memo } from 'react'

type Level = 1 | 2 | 3 | 4 | 5 | 6

function clampLevel(n: number): Level {
  const x = Math.min(6, Math.max(1, Math.round(n)))
  return x as Level
}

function headingEnter(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const sel = state.selection
  if (!(sel instanceof TextSelection) || !sel.empty) return false
  const { $from } = sel
  if ($from.parent.type.name !== 'heading') return false

  const heading = $from.parent
  const offset = $from.parentOffset
  const from = $from.start()
  const to = $from.end()
  const schema = state.schema
  const para = schema.nodes.paragraph

  const tr = state.tr
  if (offset === heading.content.size) {
    const insertPos = $from.after()
    tr.insert(insertPos, para.create())
    tr.setSelection(TextSelection.create(tr.doc, insertPos + 1))
  } else {
    const beforeSlice = heading.slice(0, offset)
    const afterSlice = heading.slice(offset)
    const hNode = heading.type.create(heading.attrs, beforeSlice.content)
    const pNode = para.create(null, afterSlice.content)
    tr.replaceWith(from, to, [hNode, pNode])
    tr.setSelection(TextSelection.create(tr.doc, from + hNode.nodeSize + 1))
  }

  if (dispatch) dispatch(tr)
  return true
}

function headingBackspaceAtStart(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const sel = state.selection
  if (!(sel instanceof TextSelection) || !sel.empty) return false
  const { $from } = sel
  if ($from.parent.type.name !== 'heading' || $from.parentOffset !== 0) return false

  const heading = $from.parent
  const level = Number(heading.attrs.level ?? 1)
  const from = $from.before()
  const to = $from.after()
  const tr = state.tr

  if (level > 1) {
    tr.setNodeMarkup(from, undefined, { ...heading.attrs, level: level - 1 })
    tr.setSelection(TextSelection.create(tr.doc, from + 1))
  } else {
    const para = state.schema.nodes.paragraph.create(null, heading.content)
    tr.replaceWith(from, to, para)
    tr.setSelection(TextSelection.create(tr.doc, from + 1))
  }

  if (dispatch) dispatch(tr)
  return true
}

const LunaHeadingView = memo(function LunaHeadingView(props: ReactNodeViewProps) {
  const { node } = props
  const level = clampLevel(Number(node.attrs.level ?? 1))

  const headingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

  return (
    <NodeViewWrapper
      as="div"
      className={`pm-heading-block pm-heading-block--l${level}`}
      data-type="heading"
      data-level={level}
    >
      <span className="pm-heading-level-tag" contentEditable={false} aria-hidden>
        H{level}
      </span>

      <div className="pm-heading-read">
        <NodeViewContent<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>
          as={headingTag}
          className="pm-heading-content"
        />
      </div>
    </NodeViewWrapper>
  )
})

export const LunaHeading = Heading.extend({
  draggable: false,

  priority: 1200,

  addInputRules() {
    /**
     * Restore ATX: `# `~`###### ` Convert paragraph to heading at end of line.
     * TipTap `inputRulesPlugin` will not run input rules when `view.composing === true` (Chinese IME group words), which can reduce accidental touches.
     * If the schema prohibits heading in a table cell, `canReplaceWith` will fail and the rule will not take effect.
     */
    const levels = this.options.levels
    return levels.map((level) =>
      textblockTypeInputRule({
        find: new RegExp(`^(#{${Math.min(...levels)},${level}})\\s$`),
        type: this.type,
        getAttributes: { level },
      }),
    )
  },

  addNodeView() {
    return ReactNodeViewRenderer(LunaHeadingView)
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (editor.view.composing) return false
        if (headingEnter(editor.state, editor.view.dispatch.bind(editor.view))) return true
        return false
      },
      Backspace: ({ editor }) => {
        if (editor.view.composing) return false
        if (headingBackspaceAtStart(editor.state, editor.view.dispatch.bind(editor.view))) return true
        return false
      },
    }
  },
})
