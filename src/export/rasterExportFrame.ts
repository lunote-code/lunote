import { buildExportLayoutCss, type ExportSettingsSnapshot } from './exportPreset'

export type RasterExportFrame = {
  iframe: HTMLIFrameElement
  body: HTMLElement
  article: HTMLElement
  cleanup: () => void
}

export function buildRasterExportDocumentHtml(args: {
  articleHtml: string
  styles: string
  exportSettings: ExportSettingsSnapshot
  exportWidth: number
  dark: boolean
  documentClassName: string
  title: string
}): string {
  const { articleHtml, styles, exportSettings, exportWidth, dark, documentClassName, title } = args
  const themeAttr = dark ? 'dark' : 'light'
  const docClassAttr = documentClassName ? ` ${documentClassName}` : ''
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return `<!DOCTYPE html>
<html class="markdown-export-root" data-theme="${themeAttr}" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${exportWidth}, initial-scale=1" />
<title>${escapedTitle}</title>
<style>
${styles}
${buildExportLayoutCss(exportSettings)}
html, body {
  margin: 0;
  padding: 0;
  background: ${dark ? '#0d1117' : '#ffffff'};
}
body.markdown-export-root {
  width: ${exportWidth}px;
  max-width: ${exportWidth}px;
  overflow: visible;
}
.markdown-export-root .markdown-export-body {
  width: ${exportWidth}px;
  max-width: ${exportWidth}px;
  margin: 0;
  overflow: visible;
}
</style>
</head>
<body class="markdown-export-root" data-theme="${themeAttr}">
<main class="markdown-body markdown-export-body${docClassAttr}" data-title="${escapedTitle}">${articleHtml}</main>
</body>
</html>`
}

export function mountRasterExportFrame(documentHtml: string, exportWidth: number): RasterExportFrame {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('tabindex', '-1')
  iframe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${exportWidth}px`,
    'height:0',
    'border:0',
    'margin:0',
    'padding:0',
    'opacity:0',
    'pointer-events:none',
    'z-index:2147483647',
  ].join(';')

  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    throw new Error('Failed to create raster export frame')
  }

  doc.open()
  doc.write(documentHtml)
  doc.close()

  const body = doc.body
  const article = doc.querySelector<HTMLElement>('.markdown-export-body')
  if (!article) {
    iframe.remove()
    throw new Error('Raster export frame is missing article root')
  }

  return {
    iframe,
    body,
    article,
    cleanup: () => iframe.remove(),
  }
}

export function buildRasterExportStyles(bundledStyles: string): string {
  return `${bundledStyles}
.markdown-body .md-export-toc-list {
  list-style: none !important;
}
.markdown-body .md-export-toc,
.markdown-body .md-export-toc * {
  float: none !important;
}
`
}
