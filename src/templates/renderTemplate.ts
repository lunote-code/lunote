import { formatDateWithPattern } from './formatDateTokens'

export type TemplateRenderContext = {
  title: string
  filename: string
  folder?: string
  vaultName?: string
  now?: Date
}

function resolveToken(inner: string, ctx: TemplateRenderContext, now: Date): string {
  const trimmed = inner.trim()
  if (trimmed === 'title') return ctx.title
  if (trimmed === 'filename') return ctx.filename
  if (trimmed === 'folder') return ctx.folder ?? ''
  if (trimmed === 'vault') return ctx.vaultName ?? ''

  const dateMatch = /^date:(.+)$/i.exec(trimmed)
  if (dateMatch) return formatDateWithPattern(now, dateMatch[1]!.trim())

  const timeMatch = /^time:(.+)$/i.exec(trimmed)
  if (timeMatch) return formatDateWithPattern(now, timeMatch[1]!.trim())

  return `{{${inner}}}`
}

/** Replace `{{title}}`, `{{date:YYYY-MM-DD}}`, etc. Unknown tokens are left unchanged. */
export function renderTemplateString(template: string, ctx: TemplateRenderContext): string {
  const now = ctx.now ?? new Date()
  return template.replace(/\{\{([^}]+)\}\}/g, (_full, inner: string) => resolveToken(inner, ctx, now))
}
