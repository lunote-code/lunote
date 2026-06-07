import { Mark, mergeAttributes } from '@tiptap/core'

/** Soft, eye-friendly presets (lower saturation) for toolbar and Markdown. */
export const LUNA_TEXT_COLOR_PRESETS = [
  { id: 'red', value: '#b56b62', labelKey: 'ctx.editor.textColor.red' },
  { id: 'orange', value: '#b8895a', labelKey: 'ctx.editor.textColor.orange' },
  { id: 'yellow', value: '#9a9048', labelKey: 'ctx.editor.textColor.yellow' },
  { id: 'green', value: '#4d7c5e', labelKey: 'ctx.editor.textColor.green' },
  { id: 'blue', value: '#5b7d96', labelKey: 'ctx.editor.textColor.blue' },
  { id: 'purple', value: '#7d7291', labelKey: 'ctx.editor.textColor.purple' },
  { id: 'gray', value: '#6e736c', labelKey: 'ctx.editor.textColor.gray' },
] as const

/** Default custom-picker seed (sage green). */
export const LUNA_TEXT_COLOR_DEFAULT = LUNA_TEXT_COLOR_PRESETS[3].value

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

const DEFAULT_COLOR_INPUT_HEX = LUNA_TEXT_COLOR_DEFAULT

/** Expand #rgb → #rrggbb for `<input type="color">` (falls back when parsing fails). */
export function toNativeColorInputValue(color: string | null | undefined): string {
  const normalized = normalizeTextColor(color)
  if (!normalized) return DEFAULT_COLOR_INPUT_HEX
  if (/^#[0-9a-f]{6}$/iu.test(normalized)) return normalized
  if (/^#[0-9a-f]{3}$/iu.test(normalized)) {
    const [r, g, b] = normalized.slice(1)
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (typeof document === 'undefined') return DEFAULT_COLOR_INPUT_HEX
  const probe = document.createElement('span')
  probe.style.color = normalized
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  const m = computed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/iu)
  if (!m) return DEFAULT_COLOR_INPUT_HEX
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
  return `#${hex(m[1]!)}${hex(m[2]!)}${hex(m[3]!)}`
}

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
