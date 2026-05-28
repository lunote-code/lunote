import type { UiLocaleId } from '../i18n/resolveLocale'
import { buildExportLayoutCss, resolveCurrentExportSettings } from './exportPreset'
import { resolveExportHtmlLang, resolveExportUiLocale } from './exportLocaleTypography'
import { bundledFullExportStyles } from './exportBundledStyles'
import { extractExportDocumentClasses, joinExportDocumentClasses } from './exportDocumentClasses'
import { createExportThemeSnapshot } from './exportThemeSnapshot'
import { markdownToHtmlFragment } from './markdownPipeline'
import { rewriteRelativeMediaSources, buildMediaSourceResolveOptions } from './mediaSources'

export type PdfExportHtmlOptions = {
  title: string
  dark: boolean
  sourcePath?: string
  rootDir?: string
  /** UI locale for export `lang` and CJK font fallbacks; defaults to current app locale. */
  localeId?: UiLocaleId
}

function buildPrintCss(): string {
  const exportSettings = resolveCurrentExportSettings()
  const blockAvoidCss =
    exportSettings.pageBreakMode === 'avoid-blocks'
      ? `
  html.markdown-export-root, body.markdown-export-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .markdown-body.markdown-export-body pre,
  .markdown-body.markdown-export-body .md-callout,
  .markdown-body.markdown-export-body table,
  .markdown-body.markdown-export-body .markdown-table-wrap,
  .markdown-body.markdown-export-body img,
  .markdown-body.markdown-export-body svg,
  .markdown-body.markdown-export-body .mermaid-export-diagram {
    break-inside: avoid;
    page-break-inside: avoid;
  }
`
      : `
  html.markdown-export-root, body.markdown-export-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`
  return `
@page { size: ${exportSettings.preset.pageSize}; margin: ${exportSettings.preset.pageMargin}; }
@media print {
${blockAvoidCss}
  .markdown-body.markdown-export-body .md-export-toc {
    border: 1px solid #d0d7de;
    background: #f6f8fa;
    box-shadow: none;
  }
  body.markdown-export-root[data-theme='dark'] .markdown-body.markdown-export-body .md-export-toc {
    border-color: #30363d;
    background: #161b22;
  }
  .markdown-body.markdown-export-body .md-export-toc-link,
  .markdown-body.markdown-export-body .md-export-toc-entry {
    color: #24292f;
  }
  body.markdown-export-root[data-theme='dark'] .markdown-body.markdown-export-body .md-export-toc-link,
  body.markdown-export-root[data-theme='dark'] .markdown-body.markdown-export-body .md-export-toc-entry {
    color: #e6edf3;
  }
  .markdown-body.markdown-export-body .md-export-toc-list .md-export-toc-list {
    border-left-color: #d0d7de;
  }
  body.markdown-export-root[data-theme='dark'] .markdown-body.markdown-export-body .md-export-toc-list .md-export-toc-list {
    border-left-color: #484f58;
  }
}`
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Works with Puppeteer/Chrome printing: completely offline, vector-ready HTML documents*/
export function wrapSelfContainedPrintHtml(
  bodyInnerHtml: string,
  opts: { title: string; dark: boolean; localeId?: UiLocaleId; documentClasses?: readonly string[] },
): string {
  const { title, dark } = opts
  const localeId = opts.localeId ?? resolveExportUiLocale()
  const htmlLang = resolveExportHtmlLang(localeId)
  const safeTitle = escapeHtmlAttr(title)
  const snapshot = createExportThemeSnapshot({ dark, localeId })
  const exportSettings = resolveCurrentExportSettings()
  const themeAttr = dark ? ` data-theme="dark"` : ' data-theme="light"'
  const themeClass = dark ? 'theme-dark' : 'theme-light'
  const documentClasses = joinExportDocumentClasses(opts.documentClasses ?? [])
  const documentClassAttr = documentClasses ? ` ${documentClasses}` : ''
  const documentDataAttr = documentClasses
    ? ` data-document-cssclasses="${escapeHtmlAttr(documentClasses)}"`
    : ''
  const css = `${bundledFullExportStyles(snapshot)}\n${buildExportLayoutCss(exportSettings)}\n${buildPrintCss()}`
  return `<!DOCTYPE html>
<html lang="${htmlLang}" class="markdown-export-root">
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

/** Markdown → self-contained HTML (for Chrome/Puppeteer vector PDF printing)*/
export async function buildPdfExportHtml(markdown: string, opts: PdfExportHtmlOptions): Promise<string> {
  const exportSettings = resolveCurrentExportSettings()
  const body = await markdownToHtmlFragment(markdown, {
    dark: opts.dark,
    localeId: opts.localeId,
    tocMode: exportSettings.tocMode,
  })
  const documentClasses = extractExportDocumentClasses(markdown)
  const template = document.createElement('template')
  template.innerHTML = body
  rewriteRelativeMediaSources(
    template.content,
    opts.sourcePath ?? '',
    buildMediaSourceResolveOptions(opts.rootDir, { preferFileUrl: true }),
  )
  const localeId = opts.localeId ?? resolveExportUiLocale()
  return wrapSelfContainedPrintHtml(template.innerHTML, {
    title: opts.title,
    dark: opts.dark,
    localeId,
    documentClasses,
  })
}
