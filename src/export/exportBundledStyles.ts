import hljsDark from 'highlight.js/styles/github-dark.min.css?raw'
import hljsLight from 'highlight.js/styles/github.min.css?raw'
import katexCss from 'katex/dist/katex.min.css?raw'
import katexEditorThemeCss from '../editor/katexEditorTheme.css?raw'
import { buildMermaidThemeCss } from '../editor/markdown/mermaid/mermaidThemeCss'
import { buildMermaidExportLayoutCss, resolveMermaidExportColors } from './mermaidExportColors'
import { bundledMarkdownStyles } from './styles'
import type { ExportThemeSnapshot } from './exportThemeSnapshot'
import { filterThemeCssForExport, normalizeRawExportCss } from './exportThemeCssFilter'
import {
  buildExportFontFamilyOverrideCss,
  sanitizeExportFontCss,
} from './exportFontSanitize'
import { buildExportThemeVarsCss } from './exportThemeVars'

/** Full inline CSS bundle shared by PDF/HTML/PNG export hosts. */
export function bundledFullExportStyles(snapshot: ExportThemeSnapshot): string {
  const mermaidColors = resolveMermaidExportColors(snapshot.dark)
  const hljsCss = snapshot.dark ? hljsDark : hljsLight
  const filteredThemeCss = sanitizeExportFontCss(filterThemeCssForExport(snapshot.stylesheetCss))
  const filteredSnippetCss = sanitizeExportFontCss(filterThemeCssForExport(snapshot.snippetCss))
  const rawExportStyleCss = sanitizeExportFontCss(normalizeRawExportCss(snapshot.exportStyleCss))
  const localeId = snapshot.localeId ?? 'en'
  return [
    bundledMarkdownStyles(snapshot),
    hljsCss,
    katexCss,
    katexEditorThemeCss,
    buildMermaidThemeCss(mermaidColors),
    buildMermaidExportLayoutCss(mermaidColors),
    filteredThemeCss,
    filteredSnippetCss,
    rawExportStyleCss,
    buildExportThemeVarsCss({ localeId, snapshot }),
    buildExportFontFamilyOverrideCss(localeId),
  ].join('\n')
}
