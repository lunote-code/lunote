import { Node, mergeAttributes } from '@tiptap/core'

/** Default URL placeholder when creating a new reference definition (the label is left blank and filled in by the user)*/
export const LINK_REFERENCE_DEF_DEFAULT_HREF = 'https://'

/** Format attrs into Markdown reference definition line (output `[]: url` when label is empty)*/
export function formatLinkReferenceDefLine(
  label: string,
  href: string,
  title?: string | null,
): string {
  const l = String(label ?? '').trim()
  const h = String(href ?? '').trim()
  const t = title ? String(title).trim() : ''
  const titleSuffix = t ? ` "${t.replace(/"/gu, '\\"')}"` : ''
  if (!h) return l ? `[${l}]: ` : `[]: `
  return l ? `[${l}]: ${h}${titleSuffix}` : `[]: ${h}${titleSuffix}`
}

/** Markdown link reference definition block `[label]: url` (double-click to enter source code editing, consistent with the title)*/
export const LunaLinkReferenceDef = Node.create({
  name: 'linkReferenceDef',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: { default: '' },
      href: { default: LINK_REFERENCE_DEF_DEFAULT_HREF },
      title: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-link-reference-def]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? '')
    const href = String(node.attrs.href ?? '')
    const title = node.attrs.title ? String(node.attrs.title) : null
    const display = formatLinkReferenceDefLine(label, href, title)
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-link-reference-def',
        'data-link-reference-def': label,
      }),
      display,
    ]
  },
})
