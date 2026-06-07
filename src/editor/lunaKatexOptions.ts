import type { KatexOptions } from 'katex'

/** HTML KaTeX defaults — editor NodeViews, markdown-it texmath, and mode-switch IR must stay aligned. */
export const LUNA_KATEX_HTML_OPTIONS = {
  throwOnError: false,
  output: 'html',
  trust: false,
} satisfies KatexOptions
