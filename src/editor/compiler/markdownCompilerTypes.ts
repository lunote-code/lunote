export type ProductionMarkdown = string & { readonly __compilerAuthority: 'production' }

export type RenderMode = 'production' | 'preview' | 'debug'

export type SerializeDocToMarkdownResult =
  | { ok: true; markdown: string }
  | { ok: false; error: unknown }
