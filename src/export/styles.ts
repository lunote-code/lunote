import ghDark from 'github-markdown-css/github-markdown-dark.css?raw'
import ghLight from 'github-markdown-css/github-markdown-light.css?raw'
import lunaMarkdownTable from '../editor/lunaMarkdownTable.css?raw'
import { buildExportThemeVarsCss } from './exportThemeVars'
import type { ExportThemeSnapshot } from './exportThemeSnapshot'
import markdownTweaks from './markdown.css?raw'

/** Inline styles shared with exporting HTML/Print/Puppeteer (GitHub Markdown + local markdown.css + Luna tables)*/
export function bundledMarkdownStyles(snapshot: ExportThemeSnapshot): string {
  return `${buildExportThemeVarsCss({ localeId: snapshot.localeId, snapshot })}\n${snapshot.dark ? ghDark : ghLight}\n${markdownTweaks}\n${lunaMarkdownTable}`
}
