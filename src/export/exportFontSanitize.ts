import type { UiLocaleId } from '../i18n/resolveLocale'
import { exportFontStackForLocale } from './exportLocaleTypography'

/** macOS print/PDF: SF Pro variable fonts resolve to internal `.SFNS-*` names and fail in iframe print. */
const UNSAFE_FONT_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/["']?SF Pro Text["']?/gi, '-apple-system'],
  [/["']?SF Pro Display["']?/gi, '-apple-system'],
  [/["']?SF Pro Rounded["']?/gi, '-apple-system'],
  [/["']?SF Pro["']?/gi, '-apple-system'],
  [/["']?SF Mono["']?/gi, 'Menlo'],
  [/\.SFNS[-\w]*/gi, '-apple-system'],
  [/\.SFMono[-\w]*/gi, 'Menlo'],
]

export const EXPORT_MONO_FONT_STACK =
  'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

/** Strip SF Pro / SFNS internal names from export CSS (user themes may copy app tokens). */
export function sanitizeExportFontCss(css: string): string {
  if (!css.trim()) return ''
  let out = css
  for (const [pattern, replacement] of UNSAFE_FONT_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out
    .replace(/(-apple-system\s*,?\s*){2,}/gi, '-apple-system, ')
    .replace(/,\s*,/g, ', ')
    .replace(/font-family:\s*,/gi, 'font-family: -apple-system,')
}

/** Final cascade override so print/dialog always uses CoreText-safe system stacks. */
export function buildExportFontFamilyOverrideCss(localeId: UiLocaleId = 'en'): string {
  const stack = exportFontStackForLocale(localeId)
  return `
html.markdown-export-root,
body.markdown-export-root,
body.markdown-export-root .markdown-body,
body.markdown-export-root .markdown-export-body,
body.markdown-export-root .markdown-preview-view,
body.markdown-export-root .markdown-reading-view {
  font-family: ${stack} !important;
}
body.markdown-export-root pre,
body.markdown-export-root code,
body.markdown-export-root .markdown-body pre,
body.markdown-export-root .markdown-body code,
body.markdown-export-root .markdown-table-wrap,
body.markdown-export-root .mermaid-export-diagram {
  font-family: ${EXPORT_MONO_FONT_STACK} !important;
}`
}
