import { isTauri } from '@tauri-apps/api/core'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { bundledFullExportStyles } from './exportBundledStyles'
import { extractExportDocumentClasses, joinExportDocumentClasses } from './exportDocumentClasses'
import { resolveCurrentExportSettings } from './exportPreset'
import { createExportThemeSnapshot } from './exportThemeSnapshot'
import { markdownToHtmlFragment } from './markdownPipeline'
import {
  buildRasterExportDocumentHtml,
  buildRasterExportStyles,
  mountRasterExportFrame,
} from './rasterExportFrame'
import { rewriteRelativeMediaSources, buildMediaSourceResolveOptions } from './mediaSources'
import { buildPdfExportHtml } from './pdfExportHtml'
import { renderHtmlToPdfBase64, renderHtmlToPdfPath } from '../platform/tauri/pdfService'
import type { UiLocaleId } from '../i18n/resolveLocale'
import { resolveExportUiLocale } from './exportLocaleTypography'

/** Desktop PDF HTML payload guard (must match Rust MAX_PDF_HTML_BYTES). */
export const MAX_PDF_EXPORT_HTML_BYTES = 50 * 1024 * 1024

type RenderOptions = {
  title: string
  dark: boolean
  sourcePath?: string
  /** Tauri workspace root path, used to detect whether the relative image exists on the disk before exporting*/
  rootDir?: string
  localeId?: UiLocaleId
}

function ensurePdfHtmlWithinLimit(html: string): void {
  if (html.length > MAX_PDF_EXPORT_HTML_BYTES) {
    throw new Error(
      `PDF export HTML exceeds ${MAX_PDF_EXPORT_HTML_BYTES / (1024 * 1024)}MB limit`,
    )
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value)
    }
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

function escapeMdAlt(alt: string): string {
  return alt.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
}

function markdownImageSnippet(img: HTMLImageElement): string {
  const alt = escapeMdAlt(img.getAttribute('alt') || '')
  const src = img.getAttribute('data-luna-original-src') || img.getAttribute('src') || ''
  return `![${alt}](${src})`
}

function replaceBrokenImage(img: HTMLImageElement): void {
  const code = img.ownerDocument.createElement('code')
  code.className = 'md-missing-image-source'
  code.textContent = markdownImageSnippet(img)
  img.replaceWith(code)
}

function neutralizeTocAnchorsForRasterExport(root: ParentNode, doc: Document): void {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.md-export-toc a.md-export-toc-link[href^="#"]'))
  for (const link of links) {
    const label = doc.createElement('span')
    label.className = 'md-export-toc-entry'
    label.textContent = link.textContent || ''
    const title = link.getAttribute('title')
    if (title) label.setAttribute('title', title)
    link.replaceWith(label)
  }
}

export function downloadBinaryBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function createRenderHost(markdown: string, opts: RenderOptions) {
  const localeId = opts.localeId ?? resolveExportUiLocale()
  const exportSettings = resolveCurrentExportSettings()
  const exportWidth = exportSettings.preset.contentWidthPx
  const snapshot = createExportThemeSnapshot({ dark: opts.dark, localeId })
  const documentClasses = extractExportDocumentClasses(markdown)
  const documentClassName = joinExportDocumentClasses(documentClasses)
  const articleHtml = await markdownToHtmlFragment(markdown, {
    dark: opts.dark,
    localeId,
    tocMode: exportSettings.tocMode,
  })

  const frameDocHtml = buildRasterExportDocumentHtml({
    articleHtml,
    styles: buildRasterExportStyles(bundledFullExportStyles(snapshot)),
    exportSettings,
    exportWidth,
    dark: opts.dark,
    documentClassName,
    title: opts.title,
  })
  const frame = mountRasterExportFrame(frameDocHtml, exportWidth)
  const { article, body } = frame
  const frameDoc = article.ownerDocument

  neutralizeTocAnchorsForRasterExport(article, frameDoc)
  rewriteRelativeMediaSources(
    article,
    opts.sourcePath,
    buildMediaSourceResolveOptions(opts.rootDir),
  )

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await frameDoc.fonts?.ready?.catch(() => undefined)
  const images = Array.from(body.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            resolve()
          }
          const tryReplaceBroken = () => {
            if (img.naturalWidth === 0) replaceBrokenImage(img)
          }
          const timeoutMs = 4000
          const timer = window.setTimeout(() => {
            if (!img.complete || img.naturalWidth === 0) replaceBrokenImage(img)
            finish()
          }, timeoutMs)
          const done = () => {
            window.clearTimeout(timer)
            finish()
          }
          if (img.complete) {
            tryReplaceBroken()
            done()
            return
          }
          img.addEventListener(
            'load',
            () => {
              tryReplaceBroken()
              done()
            },
            { once: true },
          )
          img.addEventListener(
            'error',
            () => {
              replaceBrokenImage(img)
              done()
            },
            { once: true },
          )
        }),
    ),
  )
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  return frame
}

async function renderMarkdownToPngDataUrl(markdown: string, opts: RenderOptions): Promise<string> {
  const frame = await createRenderHost(markdown, opts)
  try {
    const { body, article } = frame
    const exportWidth = resolveCurrentExportSettings().preset.contentWidthPx
    const measuredHeight = Math.ceil(
      Math.max(
        body.scrollHeight,
        body.offsetHeight,
        body.clientHeight,
        body.getBoundingClientRect().height,
        article.scrollHeight,
        article.offsetHeight,
        article.clientHeight,
        article.getBoundingClientRect().height,
      ) + 24,
    )
    const renderHeight = Math.max(1, measuredHeight)
    const estimatedPixels = renderHeight * exportWidth
    const pixelRatio = estimatedPixels > 7_000_000 ? 1 : 2
    return await toPng(body, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: opts.dark ? '#0d1117' : '#ffffff',
      width: exportWidth,
      height: renderHeight,
    })
  } finally {
    frame.cleanup()
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode export image'))
    img.src = dataUrl
  })
}

export async function markdownToPngBase64(markdown: string, opts: RenderOptions): Promise<string> {
  const dataUrl = await renderMarkdownToPngDataUrl(markdown, opts)
  return dataUrlToBase64(dataUrl)
}

async function markdownToPdfBase64Raster(markdown: string, opts: RenderOptions): Promise<string> {
  const dataUrl = await renderMarkdownToPngDataUrl(markdown, opts)
  const img = await loadImage(dataUrl)
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 36
  const renderWidth = pageWidth - margin * 2
  const renderHeight = (img.height * renderWidth) / img.width
  const pageContentHeight = pageHeight - margin * 2
  let offset = 0

  while (offset < renderHeight) {
    if (offset > 0) pdf.addPage()
    pdf.addImage(dataUrl, 'PNG', margin, margin - offset, renderWidth, renderHeight)
    offset += pageContentHeight
  }

  const blob = pdf.output('blob')
  return blobToBase64(blob)
}

export async function markdownToPdfBase64(markdown: string, opts: RenderOptions): Promise<string> {
  const localeId = opts.localeId ?? resolveExportUiLocale()
  const renderOpts = { ...opts, localeId }
  if (isTauri()) {
    const html = await buildPdfExportHtml(markdown, renderOpts)
    ensurePdfHtmlWithinLimit(html)
    return renderHtmlToPdfBase64(html)
  }
  return markdownToPdfBase64Raster(markdown, renderOpts)
}

export async function exportMarkdownPdfToPathTauri(
  markdown: string,
  opts: RenderOptions,
  outPath: string,
  workspaceRoot: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Direct PDF file write is only supported on desktop')
  }
  const html = await buildPdfExportHtml(markdown, opts)
  ensurePdfHtmlWithinLimit(html)
  await renderHtmlToPdfPath(html, outPath, workspaceRoot)
}
