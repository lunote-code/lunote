/** Kind aligned with fence syntax such as `:::note` (converted to existing Typora-style callout)*/
const ADMON_FENCE_KINDS = new Set(['note', 'warning', 'danger'])

function fenceToggleLine(line: string): boolean {
  return /^\s*(?:`{3,}|~{3,})\s*[^\n]*$/u.test(line)
}

export type LunaAdmonitionPreprocessResult = {
  text: string
  /** The original Markdown line number (0-based) corresponding to each line (0-based) after preprocessing*/
  preLineToRawLine: number[]
}

function pushMapped(out: string[], map: number[], text: string, rawLine0: number): void {
  out.push(text)
  map.push(rawLine0)
}

/**
 * Wrap `:::note` / `:::warning` / `:::danger` blocks outside CommonMark style fences
 * Convert to the existing `> [!…]` callout syntax, and maintain the mapping of preprocessed lines → original lines (for source code outline jump).
 */
export function preprocessLunaMarkdownAdmonitionsWithLineMap(
  markdown: string,
): LunaAdmonitionPreprocessResult {
  const lines = markdown.split('\n')
  const out: string[] = []
  const preLineToRawLine: number[] = []
  let inFence = false
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (fenceToggleLine(line)) {
      inFence = !inFence
      pushMapped(out, preLineToRawLine, line, i)
      i += 1
      continue
    }
    if (inFence) {
      pushMapped(out, preLineToRawLine, line, i)
      i += 1
      continue
    }

    const m = line.match(/^(\s*)::: *\s*(\w+)\s*$/iu)
    if (!m) {
      pushMapped(out, preLineToRawLine, line, i)
      i += 1
      continue
    }
    const indent = m[1]
    const kind = m[2].toLowerCase()
    if (!ADMON_FENCE_KINDS.has(kind)) {
      pushMapped(out, preLineToRawLine, line, i)
      i += 1
      continue
    }

    const bracket =
      kind === 'note' ? '[!NOTE]' : kind === 'warning' ? '[!WARNING]' : '[!DANGER]'
    const openRaw = i
    i += 1
    const body: { line: string; rawIdx: number }[] = []
    while (i < lines.length) {
      const L = lines[i]
      if (/^\s*:::\s*$/iu.test(L)) {
        i += 1
        break
      }
      body.push({ line: L, rawIdx: i })
      i += 1
    }

    const markerRaw = body.length > 0 ? body[0].rawIdx : openRaw
    pushMapped(out, preLineToRawLine, `${indent}> ${bracket}`, markerRaw)
    for (const b of body) {
      if (/^\s*>/.test(b.line)) pushMapped(out, preLineToRawLine, b.line, b.rawIdx)
      else pushMapped(out, preLineToRawLine, `${indent}> ${b.line}`, b.rawIdx)
    }
  }
  return { text: out.join('\n'), preLineToRawLine }
}

/**
 * Wrap `:::note` / `:::warning` / `:::danger` blocks outside CommonMark style fences
 * Convert existing `> [!…]` callout syntax for markdown-it + existing liftTyporaCallouts to handle.
 * There is no substitution within fenced code blocks.
 * Called only by the `parseMarkdownToDoc` pipeline (regardless of whether `::: …` is left intact on disk, see the serialization side).
 */
export function preprocessLunaMarkdownAdmonitions(markdown: string): string {
  return preprocessLunaMarkdownAdmonitionsWithLineMap(markdown).text
}

const LEADING_YAML_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u

/** Strip the first YAML frontmatter (aligned with the exported remarkStripFrontmatter)*/
export function stripLeadingYamlFrontmatter(markdown: string): { body: string; frontmatter: string | null } {
  const m = markdown.match(LEADING_YAML_FRONTMATTER)
  if (!m) return { body: markdown, frontmatter: null }
  return { body: markdown.slice(m[0].length), frontmatter: m[1] ?? null }
}

import {
  normalizeWikiLinkBlockRefEscapesInMarkdown,
} from './knowledgeRuntime/wikiLinkParser'

/** Unified preprocessing before editing parse: frontmatter stripping + admonition (consistent with `normalizeMarkdownPipeline`)*/
export function preprocessMarkdownForEditParse(markdown: string): string {
  const { body } = stripLeadingYamlFrontmatter(markdown)
  return normalizeWikiLinkBlockRefEscapesInMarkdown(preprocessLunaMarkdownAdmonitions(body))
}
