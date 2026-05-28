import { Mark, mergeAttributes } from '@tiptap/core'

/** Typora / Obsidian style `==Highlight==` (consistent with remarkEqualHighlight export)*/
export const LunaHighlight = Mark.create({
  name: 'highlight',
  inclusive: true,
  addOptions() {
    return { HTMLAttributes: {} }
  },
  parseHTML() {
    return [{ tag: 'mark' }, { tag: 'strong.md-mark-highlight' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'md-mark-highlight' }), 0]
  },
})
