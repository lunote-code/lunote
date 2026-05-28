import hljsDark from 'highlight.js/styles/github-dark.min.css?raw'
import hljsLight from 'highlight.js/styles/github.min.css?raw'
import katexCss from 'katex/dist/katex.min.css?raw'
import { buildMermaidThemeCss } from '../editor/markdown/mermaid/mermaidThemeCss'
import { buildMermaidExportLayoutCss, resolveMermaidExportColors } from './mermaidExportColors'
import { bundledMarkdownStyles } from './styles'
import type { ExportThemeSnapshot } from './exportThemeSnapshot'
import { filterThemeCssForExport, normalizeRawExportCss } from './exportThemeCssFilter'

/** Full inline CSS bundle shared by PDF/HTML/PNG export hosts. */
export function bundledFullExportStyles(snapshot: ExportThemeSnapshot): string {
  const mermaidColors = resolveMermaidExportColors(snapshot.dark)
  const hljsCss = snapshot.dark ? hljsDark : hljsLight
  const filteredThemeCss = filterThemeCssForExport(snapshot.stylesheetCss)
  const filteredSnippetCss = filterThemeCssForExport(snapshot.snippetCss)
  const rawExportStyleCss = normalizeRawExportCss(snapshot.exportStyleCss)
  return [
    bundledMarkdownStyles(snapshot),
    hljsCss,
    katexCss,
    buildMermaidThemeCss(mermaidColors),
    buildMermaidExportLayoutCss(mermaidColors),
    filteredThemeCss,
    filteredSnippetCss,
    rawExportStyleCss,
  ].join('\n')
}
