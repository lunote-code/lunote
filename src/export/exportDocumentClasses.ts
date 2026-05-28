import { parseFrontmatter } from '../editor/knowledgeRuntime/wikiLinkParser'

const CLASS_TOKEN_RE = /^[A-Za-z_-][A-Za-z0-9_-]*$/

function normalizeClassTokens(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : []
  return Array.from(
    new Set(
      rawValues
        .flatMap((entry) => entry.split(/[\s,]+/g))
        .map((entry) => entry.trim())
        .filter((entry) => CLASS_TOKEN_RE.test(entry)),
    ),
  )
}

export function extractExportDocumentClasses(markdown: string): string[] {
  const { frontmatter } = parseFrontmatter(markdown)
  return normalizeClassTokens(frontmatter.cssclasses ?? frontmatter.cssclass)
}

export function joinExportDocumentClasses(classes: readonly string[]): string {
  return classes.join(' ').trim()
}
