import { bundledFullExportStyles } from './export/exportBundledStyles'
import { extractExportDocumentClasses, joinExportDocumentClasses } from './export/exportDocumentClasses'
import { buildExportLayoutCss, resolveCurrentExportSettings } from './export/exportPreset'
import { createExportThemeSnapshot } from './export/exportThemeSnapshot'
import { htmlFragmentToDocxBase64 } from './export/htmlToDocx'
import { rewriteRelativeMediaSources, buildMediaSourceResolveOptions } from './export/mediaSources'
import { markdownToHtmlFragment } from './export/markdownPipeline'
import { resolveExportUiLocale } from './export/exportLocaleTypography'

export type AppExportFormat = 'pdf' | 'html' | 'htmlPlain' | 'image' | 'word'

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Use the same set of inline styles (github-markdown-css + markdown.css) as exported to HTML/Print/Puppeteer.
 */
export function wrapStandaloneHtml(
  bodyInnerHtml: string,
  opts: {
    title: string
    styled: boolean
    dark: boolean
    localeId?: import('./i18n/resolveLocale').UiLocaleId
    documentClasses?: readonly string[]
  },
): string {
  const { title, styled, dark } = opts
  const localeId = opts.localeId ?? resolveExportUiLocale()
  const safeTitle = escapeHtmlAttr(title)
  const exportSettings = resolveCurrentExportSettings()
  const documentClasses = joinExportDocumentClasses(opts.documentClasses ?? [])
  const documentClassAttr = documentClasses ? ` ${documentClasses}` : ''
  const documentDataAttr = documentClasses
    ? ` data-document-cssclasses="${escapeHtmlAttr(documentClasses)}"`
    : ''
  const plainArticleClassAttr = documentClasses ? ` class="${documentClasses}"` : ''
  if (!styled) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeTitle}</title>
</head>
<body>
<article${plainArticleClassAttr}${documentDataAttr} style="max-width:${exportSettings.preset.contentWidthPx}px;margin:1.25rem auto;padding:0 0.75rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#111">
${bodyInnerHtml}
</article>
</body>
</html>`
  }
  const snapshot = createExportThemeSnapshot({ dark, localeId })
  const themeAttr = dark ? ` data-theme="dark"` : ` data-theme="light"`
  const themeClass = dark ? 'theme-dark' : 'theme-light'
  const css = `${bundledFullExportStyles(snapshot)}\n${buildExportLayoutCss(exportSettings)}`
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeTitle}</title>
<style>${css}</style>
</head>
<body class="markdown-export-root ${themeClass}${documentClassAttr}"${themeAttr}${documentDataAttr}>
<main class="markdown-body markdown-export-body markdown-preview-view markdown-reading-view view-content${documentClassAttr}"${documentDataAttr}>
${bodyInnerHtml}
</main>
</body>
</html>`
}

/** Same source as preview/export: unified + remark + rehype*/
export async function markdownToStyledHtmlFragment(md: string): Promise<string> {
  return markdownToHtmlFragment(md, { tocMode: resolveCurrentExportSettings().tocMode })
}

/** Semantic HTML has the same origin as styled; "no style" refers to the styled:false shell of wrapStandaloneHtml*/
export async function markdownToPlainHtmlFragment(md: string): Promise<string> {
  return markdownToHtmlFragment(md, { tocMode: resolveCurrentExportSettings().tocMode })
}

export function resolveExportDocumentClasses(md: string): string[] {
  return extractExportDocumentClasses(md)
}

/** Opens the print dialog and the user can select "Save as PDF" (uses the same HTML as export)*/
export function openPrintableHtml(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'print-export')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    window.open('', '_blank')?.document.write(html)
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  const win = iframe.contentWindow
  const cleanup = () => {
    try {
      iframe.remove()
    } catch {
      /* ignore */
    }
  }
  const doPrint = () => {
    try {
      win?.focus()
      win?.print()
    } finally {
      window.setTimeout(cleanup, 800)
    }
  }
  if (win?.document.readyState === 'complete') {
    window.setTimeout(doPrint, 150)
  } else {
    win?.addEventListener('load', () => window.setTimeout(doPrint, 150), { once: true })
  }
}

/** Generate Word (docx) Base64 based on the same HTML fragment as exported*/
export async function markdownToDocxBase64(
  md: string,
  opts?: { sourcePath?: string; rootDir?: string; dark?: boolean },
): Promise<string> {
  const html = await markdownToHtmlFragment(md, { dark: opts?.dark })
  const template = document.createElement('template')
  template.innerHTML = html
  rewriteRelativeMediaSources(
    template.content,
    opts?.sourcePath ?? '',
    buildMediaSourceResolveOptions(opts?.rootDir),
  )
  return htmlFragmentToDocxBase64(template.innerHTML, opts)
}

export function defaultExportBasename(activePath: string): string {
  const base = activePath.replace(/\\/g, '/').split('/').pop() ?? 'export'
  return base.replace(/\.(md|markdown)$/i, '') || 'export'
}

/** Trigger HTML file download in browser (consistent with Tauri export content)*/
export function downloadHtmlBlob(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.html') || filename.endsWith('.htm') ? filename : `${filename}.html`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
