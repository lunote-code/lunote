import { isTauri } from '@tauri-apps/api/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import type { EditorView as CmEditorView } from '@codemirror/view'

import { MAX_PASTE_IMAGE_BYTES } from '../app/assets/imagePasteLimits'
import { applyPlainTextPasteInsertion, setInputLayerSource } from './inputLayer/inputLayerPaste'
import { readTauriClipboardImage, readTauriClipboardText } from './tauriClipboardRead'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const JPEG_SIG = [0xff, 0xd8] as const
const GIF_SIG = [0x47, 0x49, 0x46] as const
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const

export function looksLikeRasterImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  if (PNG_SIG.every((b, i) => bytes[i] === b)) return true
  if (JPEG_SIG.every((b, i) => bytes[i] === b)) return true
  if (GIF_SIG.every((b, i) => bytes[i] === b)) return true
  if (
    WEBP_RIFF.every((b, i) => bytes[i] === b) &&
    WEBP_TAG.every((b, i) => bytes[i + 8] === b)
  ) {
    return true
  }
  return false
}

export async function fileLooksLikeImage(file: File): Promise<boolean> {
  if (!file.type.startsWith('image/') && file.size < 16) return false
  const head = new Uint8Array(await file.slice(0, 24).arrayBuffer())
  return looksLikeRasterImage(head)
}

const IMAGE_FILE_REF_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif|svg)(\?.*)?$/iu

/** When Finder copies image files, the clipboard text/plain is often the file name or path.*/
export function isLikelyImageFileReference(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.includes('\n') || trimmed.includes('\r')) return false
  if (IMAGE_FILE_REF_RE.test(trimmed)) return true
  if (/^file:\/\/\/.+\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif|svg)/iu.test(trimmed)) return true
  return false
}

export function shouldPasteClipboardText(text: string, plainOnly: boolean): boolean {
  if (!text) return false
  if (plainOnly) return true
  return !isLikelyImageFileReference(text)
}

export function clipboardDataHasPlainText(cd: DataTransfer | null | undefined): boolean {
  if (!cd) return false
  return cd.getData('text/plain').length > 0
}

/** Extract visible plain text from HTML fragments (a fallback when the browser only provides text/html)*/
export function stripHtmlToPlainText(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html')
    return doc.body.textContent ?? ''
  }
  return trimmed.replace(/<[^>]+>/g, '')
}

/** The paste event reads text/plain first; when there is no plain, the text is stripped from text/html to avoid PM rich text.*/
export function plainTextFromClipboardData(cd: DataTransfer | null | undefined): string {
  if (!cd) return ''
  const plain = cd.getData('text/plain')
  if (plain.trim()) return plain
  return stripHtmlToPlainText(cd.getData('text/html'))
}

export function htmlFromClipboardData(cd: DataTransfer | null | undefined): string {
  if (!cd) return ''
  return cd.getData('text/html')
}

export async function extractValidImageFiles(cd: DataTransfer): Promise<File[]> {
  const out: File[] = []
  const files = cd.files?.length ? Array.from(cd.files) : []
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > MAX_PASTE_IMAGE_BYTES) continue
    if (await fileLooksLikeImage(file)) out.push(file)
  }
  if (out.length > 0) return out
  const items = cd.items ? Array.from(cd.items) : []
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file && file.size <= MAX_PASTE_IMAGE_BYTES && (await fileLooksLikeImage(file))) out.push(file)
  }
  return out
}

/** Whether the WKWebView paste event has an available payload (non-empty text or valid image)*/
export async function clipboardEventHasUsablePayload(event: ClipboardEvent): Promise<boolean> {
  const cd = event.clipboardData
  if (!cd) return false
  if (clipboardDataHasPlainText(cd)) return true
  const images = await extractValidImageFiles(cd)
  return images.length > 0
}

export async function readNavigatorClipboardText(): Promise<string> {
  if (isTauri()) {
    const native = await readTauriClipboardText()
    if (native) return native
  }
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

/** Tauri gives priority to native reading; only browsers use navigator.clipboard.read()*/
export async function readNavigatorClipboardImageFile(): Promise<{ file: File; mime: string } | null> {
  if (isTauri()) {
    const native = await readTauriClipboardImage()
    if (native) return native
    return null
  }
  if (!navigator.clipboard.read) return null
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (!type.startsWith('image/')) continue
        const blob = await item.getType(type)
        const file = new File([blob], `paste.${type.split('/')[1] || 'png'}`, { type })
        if (await fileLooksLikeImage(file)) return { file, mime: type }
      }
    }
  } catch {
    return null
  }
  return null
}

export type WebviewPasteImageHandler = (file: File, mimeHint: string) => Promise<string | null>

export async function insertImageIntoPmView(
  view: EditorView,
  src: string,
  alt = 'image',
): Promise<void> {
  const { state } = view
  const imageType = state.schema.nodes.image
  if (!imageType) return
  const node = imageType.create({ src, alt })
  const tr = state.tr.replaceSelection(new Slice(Fragment.from(node), 0, 0)).scrollIntoView()
  view.dispatch(tr)
  view.focus()
}

export function insertTextIntoCmView(view: CmEditorView, text: string): void {
  view.dispatch(view.state.replaceSelection(text))
  view.focus()
}

export function insertMarkdownImageIntoCmView(view: CmEditorView, src: string, alt = 'image'): void {
  const escapedAlt = alt.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
  insertTextIntoCmView(view, `![${escapedAlt}](${src})`)
}

type HtmlTableParseResult = {
  headerRowIndex: number
  rows: string[][]
}

function parseHtmlTable(html: string): HtmlTableParseResult | null {
  const trimmed = html.trim()
  if (!trimmed || typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(trimmed, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null
  const rows: string[][] = []
  let headerRowIndex = -1
  const trs = Array.from(table.querySelectorAll('tr'))
  for (const tr of trs) {
    const cells = Array.from(tr.querySelectorAll('th, td'))
    if (cells.length === 0) continue
    const row: string[] = []
    let hasTh = false
    for (const cell of cells) {
      if (cell.tagName.toLowerCase() === 'th') hasTh = true
      const text = (cell.textContent ?? '').replace(/\s+/gu, ' ').trim()
      const span = Math.max(1, Number(cell.getAttribute('colspan')) || 1)
      row.push(text)
      for (let i = 1; i < span; i += 1) row.push('')
    }
    if (headerRowIndex === -1 && hasTh) headerRowIndex = rows.length
    rows.push(row)
  }
  if (rows.length === 0) return null
  const colCount = Math.max(...rows.map((r) => r.length))
  const normalized = rows.map((r) => {
    const copy = [...r]
    while (copy.length < colCount) copy.push('')
    return copy
  })
  const header = headerRowIndex >= 0 ? headerRowIndex : 0
  return { headerRowIndex: header, rows: normalized }
}

function buildMarkdownTable(rows: string[][], headerRowIndex: number): string {
  if (rows.length === 0) return ''
  const header = rows[headerRowIndex] ?? []
  const body = rows.filter((_, idx) => idx !== headerRowIndex)
  const separator = header.map(() => '---')
  const formatRow = (cells: string[]) => `| ${cells.map((c) => c || ' ').join(' | ')} |`
  return [formatRow(header), formatRow(separator), ...body.map(formatRow)].join('\n')
}

function insertHtmlTableIntoPmView(view: EditorView, table: HtmlTableParseResult): boolean {
  const { schema } = view.state
  const tableNode = schema.nodes.table
  const tableRow = schema.nodes.tableRow
  const tableCell = schema.nodes.tableCell
  const tableHeader = schema.nodes.tableHeader
  const paragraph = schema.nodes.paragraph
  if (!tableNode || !tableRow || !tableCell || !paragraph) return false

  const makePara = (text: string) => (text ? paragraph.create(null, schema.text(text)) : paragraph.create())
  const rows = table.rows.map((row, idx) => {
    const isHeader = idx === table.headerRowIndex && tableHeader
    const cells = row.map((text) => {
      const node = makePara(text)
      return (isHeader ? tableHeader : tableCell)!.create(null, node)
    })
    return tableRow.create(null, cells)
  })
  const node = tableNode.create(null, rows)
  const tr = setInputLayerSource(
    view.state.tr.replaceSelection(new Slice(Fragment.from(node), 0, 0)),
    'paste-rich',
  )
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

function insertMarkdownTableIntoPmView(view: EditorView, markdown: string): boolean {
  const { schema } = view.state
  const tableNode = schema.nodes.table
  if (!tableNode) return false
  const doc = canonicalMarkdownSemantics.parse(markdown, schema)
  if (doc.childCount !== 1) return false
  const child = doc.child(0)
  if (child.type !== tableNode) return false
  const tr = setInputLayerSource(
    view.state.tr.replaceSelection(new Slice(Fragment.from(child), 0, 0)),
    'paste-rich',
  )
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

async function insertResolvedImage(
  pmView: EditorView | null | undefined,
  cmView: CmEditorView | null | undefined,
  src: string,
): Promise<boolean> {
  if (pmView) {
    await insertImageIntoPmView(pmView, src)
    return true
  }
  if (cmView) {
    insertMarkdownImageIntoCmView(cmView, src)
    return true
  }
  return false
}

export async function applyWebviewPasteFallback(options: {
  pmView?: EditorView | null
  cmView?: CmEditorView | null
  domImages?: File[]
  plainOnly?: boolean
  prefetchedText?: string
  prefetchedHtml?: string
  onPasteImage?: WebviewPasteImageHandler
}): Promise<boolean> {
  const { pmView, cmView, domImages = [], plainOnly = false, onPasteImage, prefetchedHtml } = options

  //Paste event clipboardData takes priority: read pictures synchronously to avoid navigator.clipboard.read / asynchronous native reading to trigger the system Paste menu
  if (!plainOnly && onPasteImage) {
    for (const file of domImages) {
      const mime = file.type || 'image/png'
      const src = await onPasteImage(file, mime)
      if (!src) continue
      if (await insertResolvedImage(pmView, cmView, src)) return true
    }
  }

  if (!plainOnly && prefetchedHtml) {
    const table = parseHtmlTable(prefetchedHtml)
    if (table) {
      if (pmView && insertHtmlTableIntoPmView(pmView, table)) return true
      if (cmView) {
        const markdown = buildMarkdownTable(table.rows, table.headerRowIndex)
        if (markdown) {
          insertTextIntoCmView(cmView, markdown)
          return true
        }
      }
    }
  }

  const text = options.prefetchedText ?? (await readNavigatorClipboardText())
  if (text && shouldPasteClipboardText(text, plainOnly)) {
    if (pmView) {
      if (!plainOnly && insertMarkdownTableIntoPmView(pmView, text)) return true
      const tr = applyPlainTextPasteInsertion(pmView.state, text)
      pmView.dispatch(tr.scrollIntoView())
      pmView.focus()
      return true
    }
    if (cmView) {
      insertTextIntoCmView(cmView, text)
      return true
    }
  }

  //The solution when WKWebView and other clipboardData is empty (menu pasting, Tauri native image reading)
  if (!plainOnly && onPasteImage && domImages.length === 0) {
    const image = await readNavigatorClipboardImageFile()
    if (image) {
      const src = await onPasteImage(image.file, image.mime)
      if (src && (await insertResolvedImage(pmView, cmView, src))) return true
    }
  }

  return false
}

/** Tauri desktop needs to compensate for the empty clipboardData of WKWebView; the pasting pipeline itself browser is shared with Tauri*/
export function needsWebviewPasteBridge(): boolean {
  return isTauri()
}
