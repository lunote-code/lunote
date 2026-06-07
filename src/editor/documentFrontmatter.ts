import { parseFrontmatter } from './knowledgeRuntime/wikiLinkParser'

const LEADING_YAML_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u

function yamlScalar(value: unknown): string {
  const s = String(value)
  if (!s) return '""'
  if (/[\n:#\][[{}&*!|>'"%@`]/u.test(s) || /^\s|\s$/u.test(s)) {
    return JSON.stringify(s)
  }
  return s
}

export function serializeFrontmatter(frontmatter: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}:`)
        continue
      }
      lines.push(`${key}:`)
      for (const item of value) {
        lines.push(`  - ${yamlScalar(item)}`)
      }
      continue
    }
    if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`)
      continue
    }
    lines.push(`${key}: ${yamlScalar(value)}`)
  }
  return lines.join('\n')
}

export function joinMarkdownWithFrontmatter(
  body: string,
  frontmatter: Record<string, unknown>,
  hadLeadingBlock: boolean,
): string {
  const yaml = serializeFrontmatter(frontmatter)
  const hasFields = yaml.trim().length > 0
  if (!hasFields && !hadLeadingBlock) return body
  if (!hasFields && hadLeadingBlock) {
    return body
  }
  return `---\n${yaml}\n---\n${body}`
}

export function splitDocumentMarkdown(markdown: string): {
  frontmatter: Record<string, unknown>
  body: string
  hadLeadingBlock: boolean
} {
  const m = markdown.match(LEADING_YAML_FRONTMATTER)
  if (!m) {
    return { frontmatter: {}, body: markdown, hadLeadingBlock: false }
  }
  const { frontmatter, body } = parseFrontmatter(markdown)
  return { frontmatter, body, hadLeadingBlock: true }
}
