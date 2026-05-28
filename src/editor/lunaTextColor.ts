import { Mark, mergeAttributes } from '@tiptap/core'

/** Default color shared between right-click menu and Markdown*/
export const LUNA_TEXT_COLOR_PRESETS = [
  { id: 'red', value: '#e03131', labelKey: 'ctx.editor.textColor.red' },
  { id: 'orange', value: '#f08c00', labelKey: 'ctx.editor.textColor.orange' },
  { id: 'yellow', value: '#fab005', labelKey: 'ctx.editor.textColor.yellow' },
  { id: 'green', value: '#2f9e44', labelKey: 'ctx.editor.textColor.green' },
  { id: 'blue', value: '#1971c2', labelKey: 'ctx.editor.textColor.blue' },
  { id: 'purple', value: '#9c36b5', labelKey: 'ctx.editor.textColor.purple' },
  { id: 'gray', value: '#868e96', labelKey: 'ctx.editor.textColor.gray' },
] as const

const NAMED_COLORS = new Set([
  'black',
  'silver',
  'gray',
  'grey',
  'white',
  'maroon',
  'red',
  'orange',
  'yellow',
  'olive',
  'lime',
  'green',
  'teal',
  'cyan',
  'aqua',
  'blue',
  'navy',
  'purple',
  'fuchsia',
  'magenta',
])

/** Verify and normalize color values that are safe to write to Markdown/style*/
export function normalizeTextColor(raw: unknown): string | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  if (/^#[0-9a-f]{3,8}$/iu.test(t)) return t.toLowerCase()
  if (/^(?:rgb|rgba|hsl|hsla)\([^)]+\)$/iu.test(t)) return t.replace(/\s+/gu, ' ')
  const named = t.toLowerCase()
  if (NAMED_COLORS.has(named)) return named
  return null
}

export function parseColorFromSpanOpenTag(content: string): string | null {
  const m = content.match(/^<span\b[^>]*\bstyle\s*=\s*(["'])([\s\S]*?)\1/i)
  if (!m) return null
  const style = m[2] ?? ''
  const cm = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/iu)
  if (!cm) return null
  return normalizeTextColor(cm[1]?.trim())
}

export function isSpanCloseTag(content: string): boolean {
  return /^<\/span\s*>\s*$/iu.test(String(content ?? '').trim())
}

/** Source code mode: wrap the selection with an open tag of `<span style="color:…">` (normalized color)*/
export function spanStyleColorTag(color: string): string {
  const normalized = normalizeTextColor(color)
  if (!normalized) return ''
  return `<span style="color:${normalized};">`
}

export const LunaTextColor = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => normalizeTextColor((el as HTMLElement).style?.color || el.getAttribute('data-color')),
        renderHTML: (attrs) => {
          const color = normalizeTextColor(attrs.color)
          if (!color) return {}
          return { style: `color: ${color}`, 'data-color': color }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (el) => {
          const node = el as HTMLElement
          const styleAttr = node.getAttribute('style') ?? ''
          const cm = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/iu)
          const color = normalizeTextColor(cm?.[1]?.trim() ?? node.style?.color)
          return color ? { color } : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const color = normalizeTextColor(HTMLAttributes.color)
    if (!color) return ['span', mergeAttributes(HTMLAttributes), 0]
    return ['span', mergeAttributes(HTMLAttributes, { style: `color: ${color}`, 'data-color': color }), 0]
  },
})
