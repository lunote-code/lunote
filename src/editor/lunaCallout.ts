import { Node, mergeAttributes } from '@tiptap/core'

/** The internal kind corresponding to the Typora annotation block (used for styling and serialization)*/
export const CALLOUT_KINDS = [
  'note',
  'important',
  'caution',
  'tip',
  'success',
  'warning',
  'info',
  'danger',
] as const

export type CalloutKind = (typeof CALLOUT_KINDS)[number]

/** Bracket tag names in `[!TAG]` (GitHub + Obsidian). Shared by parse + markdownDocument lift. */
export const CALLOUT_BRACKET_TAGS = 'NOTE|TIP|IMPORTANT|CAUTION|WARNING|INFO|DANGER|SUCCESS'

const BRACKET = new RegExp(`^\\[!\\s*(${CALLOUT_BRACKET_TAGS})\\s*\\]$`, 'iu')
const LEADING = new RegExp(`^\\[!\\s*(${CALLOUT_BRACKET_TAGS})\\s*\\]\\s*(.*)$`, 'isu')

function mapBracket(tag: string): CalloutKind {
  switch (tag.toUpperCase()) {
    case 'NOTE':
      return 'note'
    case 'TIP':
      return 'tip'
    case 'IMPORTANT':
      return 'important'
    case 'CAUTION':
      return 'caution'
    case 'WARNING':
      return 'warning'
    case 'INFO':
      return 'info'
    case 'DANGER':
      return 'danger'
    case 'SUCCESS':
      return 'success'
    default:
      return 'note'
  }
}

/**
 * Parsing the first paragraph of GitHub / Obsidian style callout: `[!NOTE]` can be followed by a blank space before continuing with the text (`markdown-it` + PM is usually `"[!NOTE] note"`).
 * If `body` is empty, it means that there is no corresponding text after the label, and the text is in the subsequent block-level child nodes.
 */
export function parseCalloutLeadingParagraph(text: string): { kind: CalloutKind; body: string } | null {
  const raw = text.replace(/\r\n/g, '\n')
  const m = raw.match(LEADING)
  if (!m) return null
  return { kind: mapBracket(m[1]), body: m[2].trim() }
}

/** Identify the first line of the reference block: the entire paragraph is only `[!NOTE]`, etc., or warning / information / error / prompt (no bracket suffix)*/
export function matchCalloutFirstLine(text: string): CalloutKind | null {
  const t = text.trim()
  const m = t.match(BRACKET)
  if (m) return mapBracket(m[1])
  if (t === '警告' || t === 'Warning' || t === 'Caution') return 'caution'
  if (t === '信息' || t === 'Info' || t === 'Information') return 'info'
  if (t === '错误' || t === 'Error' || t === 'Danger') return 'danger'
  if (t === '提示' || t === 'Tip' || t === 'Hint') return 'tip'
  if (t === '成功' || t === 'Success') return 'success'
  return null
}

/**
 * Serialize to GitHub / Obsidian style first line (`> [!TYPE]`), guaranteed to be round-trip with the source code mode;
 * Chinese aliases are still recognized on the parsing side by `matchCalloutFirstLine`.
 */
export function calloutFirstLineForKind(kind: string): string {
  switch (String(kind || 'note').toLowerCase()) {
    case 'note':
      return '[!NOTE]'
    case 'tip':
      return '[!TIP]'
    case 'success':
      return '[!SUCCESS]'
    case 'important':
      return '[!IMPORTANT]'
    case 'caution':
      return '[!CAUTION]'
    case 'warning':
      return '[!WARNING]'
    case 'info':
      return '[!INFO]'
    case 'danger':
      return '[!DANGER]'
    default:
      return '[!NOTE]'
  }
}

export const LunaCallout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'note',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-luna-callout') || 'note',
      },
      /** Collapse written by `CalloutNode` NodeView; optional when pasting in pure HTML*/
      collapsed: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-collapsed') === 'true',
        renderHTML: (attrs) => ((attrs as { collapsed?: boolean }).collapsed ? { 'data-collapsed': 'true' } : {}),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'aside[data-luna-callout]',
        getAttrs: (el) => ({
          kind: (el as HTMLElement).getAttribute('data-luna-callout') || 'note',
          collapsed: (el as HTMLElement).getAttribute('data-collapsed') === 'true',
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = String(node.attrs.kind || 'note')
    const collapsed = Boolean(node.attrs.collapsed)
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-luna-callout': kind,
        ...(collapsed ? { 'data-collapsed': 'true' } : {}),
        class: `pm-callout pm-callout--${kind} luna-callout-card`,
        spellcheck: 'false',
      }),
      0,
    ]
  },
})
