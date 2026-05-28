import { Node, mergeAttributes } from '@tiptap/core'
import { gemoji } from 'gemoji'

/** shortcode name (without colon) → Unicode, for WYSIWYG display*/
const SHORTCODE_TO_UNICODE = new Map<string, string>()
for (const g of gemoji) {
  const n = g.names[0]
  if (n) SHORTCODE_TO_UNICODE.set(n, g.emoji)
}

export function unicodeForEmojiShortcode(name: string): string {
  return SHORTCODE_TO_UNICODE.get(name) ?? ''
}

/**
 * `emoji` token corresponding to markdown-it-emoji; serialized to `:shortcode:`, without Unicode↔shortcode implicit rewriting.
 */
export const LunaEmoji = Node.create({
  name: 'emoji',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      value: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-emoji')?.trim() ?? '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-luna-emoji]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.value ?? '').trim()
    const glyph = unicodeForEmojiShortcode(name)
    const display = glyph || `:${name}:`
    return ['span', mergeAttributes(HTMLAttributes, { 'data-luna-emoji': '1', 'data-emoji': name, class: 'pm-luna-emoji' }), display]
  },
})
