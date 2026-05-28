import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx'
import { loadImageForWord, svgElementToWordImage } from './wordExportMedia'

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
]

const CALLOUT_FILL: Record<string, string> = {
  note: 'E7F5FF',
  info: 'E7F5FF',
  tip: 'E6FCF5',
  important: 'F3F0FF',
  warning: 'FFF9DB',
  caution: 'FFF4E6',
  danger: 'FFE3E3',
}

const CALLOUT_LABEL: Record<string, string> = {
  note: 'NOTE',
  info: 'INFO',
  tip: 'TIP',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'CAUTION',
  danger: 'DANGER',
}

type InlineDeco = {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  highlight?: boolean
  superScript?: boolean
  subScript?: boolean
  font?: string
}

function textRun(text: string, deco: InlineDeco = {}): TextRun {
  return new TextRun({
    text,
    bold: deco.bold,
    italics: deco.italics,
    strike: deco.strike,
    superScript: deco.superScript,
    subScript: deco.subScript,
    font: deco.font,
    shading: deco.highlight ? { fill: 'FFF3BF', type: ShadingType.CLEAR } : undefined,
  })
}

function isHighlightElement(el: Element): boolean {
  return el.classList.contains('md-mark-highlight') || el.tagName.toUpperCase() === 'MARK'
}

function katexPlainText(el: Element): string {
  const annotation = el.querySelector('annotation')
  if (annotation?.textContent?.trim()) return annotation.textContent.trim()
  const mathml = el.querySelector('math')
  if (mathml?.textContent?.trim()) return mathml.textContent.trim()
  return el.textContent?.trim() ?? ''
}

function isFootnotesSection(el: Element): boolean {
  return el.tagName.toUpperCase() === 'SECTION' && el.classList.contains('footnotes')
}

function isTaskCheckbox(el: Element): boolean {
  return el.tagName.toUpperCase() === 'INPUT' && el.getAttribute('type') === 'checkbox'
}

async function inlineFromImage(img: HTMLImageElement, deco: InlineDeco): Promise<ParagraphChild[]> {
  const src = img.getAttribute('src') ?? ''
  const alt = img.getAttribute('alt') || ''
  const payload = await loadImageForWord(src)
  if (!payload) {
    return [textRun(`[Image${alt ? `: ${alt}` : ''}]`, deco)]
  }
  return [
    new ImageRun({
      type: payload.type,
      data: payload.data,
      transformation: { width: payload.width, height: payload.height },
      altText: alt ? { title: alt, description: alt, name: alt } : undefined,
    }),
  ]
}

async function collectInline(el: Element, deco: InlineDeco = {}): Promise<ParagraphChild[]> {
  const out: ParagraphChild[] = []
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent ?? ''
      if (t) out.push(textRun(t, deco))
      continue
    }
    if (!(child instanceof Element)) continue

    const tag = child.tagName.toUpperCase()
    if (tag === 'STRONG' || tag === 'B') {
      out.push(...(await collectInline(child, { ...deco, bold: true })))
      continue
    }
    if (tag === 'EM' || tag === 'I') {
      out.push(...(await collectInline(child, { ...deco, italics: true })))
      continue
    }
    if (tag === 'DEL' || tag === 'S') {
      out.push(...(await collectInline(child, { ...deco, strike: true })))
      continue
    }
    if (tag === 'CODE') {
      const t = child.textContent ?? ''
      if (t) out.push(textRun(t, { ...deco, font: 'Consolas' }))
      continue
    }
    if (tag === 'BR') {
      out.push(textRun('\n', deco))
      continue
    }
    if (tag === 'A') {
      const href = child.getAttribute('href') ?? ''
      const children = await collectInline(child, deco)
      if (href && !href.startsWith('#')) {
        out.push(
          new ExternalHyperlink({
            link: href,
            children:
              children.length > 0
                ? children
                : [new TextRun({ text: child.textContent ?? href, style: 'Hyperlink' })],
          }),
        )
      } else {
        out.push(...children)
      }
      continue
    }
    if (tag === 'IMG' && child instanceof HTMLImageElement) {
      out.push(...(await inlineFromImage(child, deco)))
      continue
    }
    if (tag === 'SUP') {
      out.push(...(await collectInline(child, { ...deco, superScript: true })))
      continue
    }
    if (tag === 'SUB') {
      out.push(...(await collectInline(child, { ...deco, subScript: true })))
      continue
    }
    if (isHighlightElement(child)) {
      out.push(...(await collectInline(child, { ...deco, highlight: true })))
      continue
    }
    if (child.classList.contains('katex') || child.classList.contains('math')) {
      const tex = katexPlainText(child)
      if (tex) out.push(textRun(tex, { ...deco, font: 'Cambria Math' }))
      continue
    }
    if (isTaskCheckbox(child)) {
      const checked = child.hasAttribute('checked')
      out.push(textRun(checked ? '☑ ' : '☐ ', deco))
      continue
    }
    if (tag === 'SPAN' || tag === 'P' || tag === 'DIV') {
      out.push(...(await collectInline(child, deco)))
      continue
    }
    out.push(...(await collectInline(child, deco)))
  }
  return out
}

function paragraphFromChildren(children: ParagraphChild[], extra: IParagraphOptions = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    ...extra,
    children: children.length > 0 ? children : [new TextRun('')],
  })
}

async function paragraphFromBlock(el: Element, extra: IParagraphOptions = {}): Promise<Paragraph> {
  return paragraphFromChildren(await collectInline(el), extra)
}

function preToParagraph(pre: HTMLPreElement): Paragraph {
  const code = pre.querySelector('code')
  const text = (code?.textContent ?? pre.textContent ?? '').replace(/\r\n/g, '\n')
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { fill: 'F6F8FA', type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: 'Consolas' })],
  })
}

async function tableFromHtml(table: HTMLTableElement): Promise<Table> {
  const TABLE_WIDTH_DXA = 9360
  const maxCols = Math.max(1, ...Array.from(table.rows).map((row) => row.cells.length || 0))
  const fallbackCellWidth = Math.max(1200, Math.floor(TABLE_WIDTH_DXA / maxCols))
  const rows: TableRow[] = []
  for (const tr of Array.from(table.rows)) {
    const cells: TableCell[] = []
    const rowCols = Math.max(1, tr.cells.length)
    const rowCellWidth = Math.max(1200, Math.floor(TABLE_WIDTH_DXA / rowCols))
    for (const td of Array.from(tr.cells)) {
      cells.push(
        new TableCell({
          width: { size: rowCellWidth, type: WidthType.DXA },
          children: [await paragraphFromBlock(td)],
        }),
      )
    }
    rows.push(new TableRow({ children: cells }))
  }
  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: Array.from({ length: maxCols }, () => fallbackCellWidth),
    rows,
  })
}

async function mermaidBlockToParagraphs(el: Element): Promise<Paragraph[]> {
  const svg = el.querySelector('svg')
  if (svg) {
    const payload = await svgElementToWordImage(svg)
    if (payload) {
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new ImageRun({
              type: 'png',
              data: payload.data,
              transformation: { width: payload.width, height: payload.height },
              altText: { title: 'Mermaid diagram', description: 'Mermaid diagram', name: 'Mermaid' },
            }),
          ],
        }),
      ]
    }
  }
  return [paragraphFromChildren([textRun('[Mermaid diagram]')], { spacing: { after: 120 } })]
}

async function calloutToParagraphs(el: Element): Promise<Paragraph[]> {
  const kind = el.getAttribute('data-luna-callout') || 'note'
  const fill = CALLOUT_FILL[kind] ?? CALLOUT_FILL.note
  const label = CALLOUT_LABEL[kind] ?? kind.toUpperCase()
  const bodyRuns = await collectInline(el)
  const children: ParagraphChild[] = [textRun(`${label}: `, { bold: true }), ...bodyRuns]
  return [
    new Paragraph({
      spacing: { before: 120, after: 120 },
      indent: { left: 360 },
      border: {
        left: { color: '74C0FC', size: 18, style: BorderStyle.SINGLE, space: 8 },
      },
      shading: { fill, type: ShadingType.CLEAR },
      children,
    }),
  ]
}

async function definitionListToParagraphs(el: Element): Promise<Paragraph[]> {
  const out: Paragraph[] = []
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toUpperCase()
    if (tag === 'DT') {
      out.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [textRun(child.textContent?.trim() ?? '', { bold: true })],
        }),
      )
    } else if (tag === 'DD') {
      out.push(await paragraphFromBlock(child, { indent: { left: 720 }, spacing: { after: 80 } }))
    }
  }
  return out.length > 0 ? out : [await paragraphFromBlock(el)]
}

async function tocToParagraphs(nav: Element): Promise<Paragraph[]> {
  const out: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      children: [textRun(nav.querySelector('.md-export-toc-title')?.textContent?.trim() || 'Table of contents')],
    }),
  ]
  for (const item of Array.from(nav.querySelectorAll('.md-export-toc-item'))) {
    const level = Number(item.getAttribute('data-toc-level')) || 1
    const text =
      item.querySelector('.md-export-toc-link, .md-export-toc-entry')?.textContent?.trim() ||
      item.textContent?.trim() ||
      ''
    if (!text) continue
    out.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: Math.max(0, (level - 1) * 360) },
        children: [textRun(`• ${text}`)],
      }),
    )
  }
  return out
}

async function footnotesSectionToParagraphs(section: Element): Promise<Paragraph[]> {
  const out: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [textRun(section.querySelector('h2')?.textContent?.trim() || 'Footnotes')],
    }),
  ]
  const items = section.querySelectorAll('li[id]')
  let index = 1
  for (const li of Array.from(items)) {
    const body = li.textContent?.replace(/\s*↩\s*$/u, '').trim() ?? ''
    if (!body) continue
    out.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [textRun(`${index}. `, { superScript: false }), textRun(body)],
      }),
    )
    index += 1
  }
  return out
}

async function blockElementToDocx(el: Element): Promise<(Paragraph | Table)[]> {
  const tag = el.tagName.toUpperCase()

  if (isFootnotesSection(el)) return []

  if (el.classList.contains('mermaid-export-diagram')) {
    return mermaidBlockToParagraphs(el)
  }

  if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'MAIN') {
    if (el.classList.contains('markdown-table-wrap')) {
      const acc: (Paragraph | Table)[] = []
      for (const c of Array.from(el.children)) acc.push(...(await blockElementToDocx(c)))
      return acc
    }
    if (el.classList.contains('katex-display') || el.querySelector('.katex-display')) {
      const katex = el.classList.contains('katex-display') ? el : el.querySelector('.katex-display')
      const tex = katex ? katexPlainText(katex) : el.textContent?.trim() ?? ''
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          alignment: 'center',
          children: [textRun(tex || '[Formula]', { font: 'Cambria Math', italics: true })],
        }),
      ]
    }
    const acc: (Paragraph | Table)[] = []
    for (const c of Array.from(el.children)) acc.push(...(await blockElementToDocx(c)))
    return acc
  }

  if (tag === 'NAV' && el.classList.contains('md-export-toc')) {
    return tocToParagraphs(el)
  }

  if (tag === 'ASIDE') {
    return calloutToParagraphs(el)
  }

  if (tag === 'DL') {
    return definitionListToParagraphs(el)
  }

  if (/^H[1-6]$/.test(tag)) {
    const n = Number(tag[1]) - 1
    const level = HEADINGS[Math.min(Math.max(n, 0), 5)]
    return [
      new Paragraph({
        heading: level,
        spacing: { after: 120 },
        children: await collectInline(el),
      }),
    ]
  }

  if (tag === 'P') {
    if (el.querySelector('.katex-display')) {
      return blockElementToDocx(el.querySelector('.katex-display') ?? el)
    }
    return [await paragraphFromBlock(el)]
  }

  if (tag === 'HR') {
    return [new Paragraph({ children: [textRun('—'.repeat(24))], spacing: { after: 120 } })]
  }

  if (tag === 'PRE' && el instanceof HTMLPreElement) {
    return [preToParagraph(el)]
  }

  if (tag === 'BLOCKQUOTE') {
    const quoteStyle = {
      indent: { left: 720 },
      border: { left: { color: 'CED4DA', size: 12, style: BorderStyle.SINGLE, space: 8 } },
    } as const
    const out: (Paragraph | Table)[] = []
    for (const c of Array.from(el.children)) {
      if (c.tagName.toUpperCase() === 'P') {
        out.push(await paragraphFromBlock(c, quoteStyle))
      } else {
        out.push(...(await blockElementToDocx(c)))
      }
    }
    return out.length > 0 ? out : [await paragraphFromBlock(el, quoteStyle)]
  }

  if (tag === 'UL' || tag === 'OL') {
    const ordered = tag === 'OL'
    let ord = ordered ? Number((el as HTMLOListElement).getAttribute('start')) || 1 : 1
    if (Number.isNaN(ord)) ord = 1
    const out: Paragraph[] = []
    for (const li of Array.from(el.children)) {
      if (li.tagName.toUpperCase() !== 'LI') continue
      const taskInput = li.querySelector('input[type="checkbox"]')
      const prefix = taskInput
        ? `${taskInput.hasAttribute('checked') ? '☑' : '☐'} `
        : ordered
          ? `${ord++}. `
          : '• '
      const runs: ParagraphChild[] = [textRun(prefix)]
      const nested: Element[] = []
      for (const c of Array.from(li.childNodes)) {
        if (c.nodeType === Node.TEXT_NODE) {
          const t = c.textContent?.replace(/\s+/g, ' ').trim() ?? ''
          if (t) runs.push(textRun(t))
        } else if (c instanceof Element) {
          const ct = c.tagName.toUpperCase()
          if (ct === 'UL' || ct === 'OL') nested.push(c)
          else if (ct === 'INPUT' && isTaskCheckbox(c)) continue
          else if (ct === 'P' || ct === 'DIV' || ct === 'LABEL') runs.push(...(await collectInline(c)))
          else runs.push(...(await collectInline(c)))
        }
      }
      out.push(paragraphFromChildren(runs.length ? runs : [textRun('')], { spacing: { after: 80 } }))
      for (const n of nested) out.push(...((await blockElementToDocx(n)) as Paragraph[]))
    }
    return out
  }

  if (tag === 'TABLE') {
    return [await tableFromHtml(el as HTMLTableElement)]
  }

  if (tag === 'FIGURE') {
    const acc: (Paragraph | Table)[] = []
    for (const c of Array.from(el.children)) acc.push(...(await blockElementToDocx(c)))
    return acc
  }

  return [await paragraphFromBlock(el)]
}

async function htmlRootToDocxBlocks(root: HTMLElement): Promise<(Paragraph | Table)[]> {
  const blocks: (Paragraph | Table)[] = []
  const footnoteSections: Element[] = []

  for (const child of Array.from(root.children)) {
    if (isFootnotesSection(child)) {
      footnoteSections.push(child)
      continue
    }
    blocks.push(...(await blockElementToDocx(child)))
  }

  for (const section of footnoteSections) {
    blocks.push(...(await footnotesSectionToParagraphs(section)))
  }

  return blocks
}

export type WordExportHtmlOptions = {
  sourcePath?: string
  rootDir?: string
  dark?: boolean
}

/** Convert exported HTML snippets to .docx Base64 (same HTML as unified pipeline).*/
export async function htmlFragmentToDocxBase64(
  htmlFragment: string,
  _opts?: WordExportHtmlOptions,
): Promise<string> {
  const wrapped = `<div id="lunote-export-root">${htmlFragment}</div>`
  const dom = new DOMParser().parseFromString(wrapped, 'text/html')
  const root = dom.getElementById('lunote-export-root')
  const blocks = root ? await htmlRootToDocxBlocks(root) : []
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: blocks.length > 0 ? blocks : [new Paragraph({ children: [new TextRun('')] })],
      },
    ],
  })
  return Packer.toBase64String(doc)
}
