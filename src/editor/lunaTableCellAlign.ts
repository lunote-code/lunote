/** Alignment of text within cells (text-align of td/th), regardless of the outer layout of the table*/
export type LunaCellTextAlign = 'left' | 'center' | 'right'

export function parseCellTextAlign(v: unknown): LunaCellTextAlign | null {
  if (v === 'left' || v === 'center' || v === 'right') return v
  return null
}

export function cellTextAlignAttrsSpec() {
  return {
    lunaCellTextAlign: {
      default: null as LunaCellTextAlign | null,
      parseHTML: (element: Element) => {
        const el = element as HTMLElement
        const ta = el.style?.textAlign
        if (ta === 'left' || ta === 'center' || ta === 'right') return ta
        const a = el.getAttribute('align')
        if (a === 'left' || a === 'center' || a === 'right') return a
        return null
      },
      renderHTML: (attrs: { lunaCellTextAlign?: LunaCellTextAlign | null }) => {
        const v = parseCellTextAlign(attrs.lunaCellTextAlign)
        if (!v) return {}
        return { style: `text-align: ${v}` }
      },
    },
  }
}
