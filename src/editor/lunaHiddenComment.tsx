import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { HiddenCommentView } from '../components/nodes/HiddenCommentView'
import { resolveEditorUiMessage } from './resolveEditorUiMessage'

/** Inline `%% hidden %%` — hidden in reading view, preserved in source. */
export const LunaHiddenComment = Node.create({
  name: 'hiddenComment',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      body: { default: '' },
      raw: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-hidden-comment]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const body = String(node.attrs.body ?? '')
    const title = body
      ? resolveEditorUiMessage('editor.hiddenComment.title', { label: body })
      : resolveEditorUiMessage('editor.hiddenComment.titleEmpty')
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-hidden-comment',
        'data-hidden-comment': '1',
        title,
      }),
      ['span', { class: 'pm-hidden-comment-badge', 'aria-hidden': 'true' }, '%% … %%'],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(HiddenCommentView)
  },
})

/** Block `%% … %%` hidden comment. */
export const LunaHiddenCommentBlock = Node.create({
  name: 'hiddenCommentBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      body: { default: '' },
      raw: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-hidden-comment-block]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const body = String(node.attrs.body ?? '')
    const title = body
      ? resolveEditorUiMessage('editor.hiddenComment.title', { label: body })
      : resolveEditorUiMessage('editor.hiddenComment.titleEmpty')
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-hidden-comment-block',
        'data-hidden-comment-block': '1',
        title,
      }),
      ['span', { class: 'pm-hidden-comment-badge', 'aria-hidden': 'true' }, '%% … %%'],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(HiddenCommentView)
  },
})
