import type { DocumentKnowledgeMeta } from '../../editor/knowledgeRuntime/types'

/** ATX headings (# .. ######), excluding setext-style. */
const HEADING_LINE_RE = /^ {0,3}#{1,6}\s+(.+?)(?:\s+#+\s*)?$/gmu

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/u

export function stripMarkdownFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER_RE, '')
}

export function extractMarkdownHeadingTexts(markdown: string): string[] {
  const body = stripMarkdownFrontmatter(markdown)
  const headings: string[] = []
  for (const match of body.matchAll(HEADING_LINE_RE)) {
    const text = match[1]?.trim()
    if (text) headings.push(text)
  }
  return headings
}

export function buildWorkspaceSearchFields(input: {
  fileLabel: string
  meta?: Pick<DocumentKnowledgeMeta, 'title' | 'docKey' | 'frontmatter' | 'bodySample'>
}): { displayTitle: string; matchText: string } {
  const fileStem = input.fileLabel.replace(/\.md$/iu, '')
  const displayTitle = input.meta?.title?.trim() || fileStem
  const parts = new Set<string>()
  if (displayTitle) parts.add(displayTitle)
  if (fileStem && fileStem !== displayTitle) parts.add(fileStem)

  const fmTitle = input.meta?.frontmatter?.title
  if (typeof fmTitle === 'string' && fmTitle.trim()) parts.add(fmTitle.trim())

  if (input.meta?.bodySample) {
    for (const heading of extractMarkdownHeadingTexts(input.meta.bodySample)) {
      parts.add(heading)
    }
  }

  return {
    displayTitle,
    matchText: [...parts].join('\n'),
  }
}
