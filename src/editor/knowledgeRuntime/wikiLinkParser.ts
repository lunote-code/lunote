import { canonicalizeWikiLinkText, normalizeWikiPath } from './wikiCanonical'
import type { DocKey, ParsedBlockRef, ParsedWikiLink, WikiLinkKind } from './types'

/** [[target]] / [[target#h]] / [[target^block]] / [[target|alias]] / ![[embed]] */
const WIKI_LINK_RE =
  /(!)?\[\[([^\]|#^]+?)(?:#([^\]|^]+?))?(?:\^([^\]]+?))?(?:\|([^\]]+?))?\]\]/g

/** Inline ^block-id (Obsidian style, alphanumeric and hyphenated)*/
const BLOCK_REF_RE = /(?:^|\s)\^([a-zA-Z0-9_-]+)/gm

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function docKeyFromWikiTarget(raw: string): DocKey {
  return canonicalizeWikiLinkText(normalizeWikiPath(raw))
}

/** Extract display target text from a `[[target]]` / `![[target]]` token or bare target name.*/
export function wikiLinkInnerTargetText(rawToken: string, fallback = ''): string {
  const trimmed = rawToken.trim()
  if (!trimmed) return fallback
  WIKI_LINK_RE.lastIndex = 0
  const m = WIKI_LINK_RE.exec(trimmed)
  if (m?.[2]) return normalizeWikiPath(m[2]) || m[2].trim()
  return normalizeWikiPath(trimmed) || trimmed || fallback
}

export function parseFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const m = FRONTMATTER_RE.exec(markdown)
  if (!m) return { frontmatter: {}, body: markdown }
  const yaml = m[1] ?? ''
  const body = markdown.slice(m[0].length)
  const frontmatter: Record<string, unknown> = {}
  let currentKey: string | null = null

  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const listItem = /^-\s+(.+)$/.exec(trimmed)
    if (listItem && currentKey) {
      const existing = frontmatter[currentKey]
      const value = listItem[1]!.trim().replace(/^['"]|['"]$/g, '')
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        frontmatter[currentKey] = [value]
      }
      continue
    }

    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmed)
    if (!kv) continue
    currentKey = kv[1]!
    const raw = kv[2]!.trim()
    if (!raw) {
      frontmatter[currentKey] = []
      continue
    }
    if (raw.startsWith('[') && raw.endsWith(']')) {
      frontmatter[currentKey] = raw
        .slice(1, -1)
        .split(',')
        .map((s: string) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    } else {
      frontmatter[currentKey] = raw.replace(/^['"]|['"]$/g, '')
    }
  }
  return { frontmatter, body }
}

export function extractTitle(
  docKey: DocKey,
  frontmatter: Record<string, unknown>,
): string {
  const t = frontmatter.title
  if (typeof t === 'string' && t.trim()) return t.trim()
  const base = docKey.split('/').pop() ?? docKey
  return base.replace(/\.md$/iu, '') || docKey
}

export function extractTags(frontmatter: Record<string, unknown>): string[] {
  const tags = frontmatter.tags
  if (Array.isArray(tags)) return tags.map(String)
  if (typeof tags === 'string') {
    return tags
      .split(/[,\s]+/u)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

export function extractAliases(frontmatter: Record<string, unknown>): string[] {
  const a = frontmatter.aliases
  if (Array.isArray(a)) return a.map(String)
  if (typeof a === 'string') return [a]
  return []
}

/**
 * Incremental safety: only parses incoming text blocks (dispatched by incrementalIndexer, not called in the render path).
 */
export function parseWikiLinksInText(
  text: string,
  baseOffset = 0,
): { links: ParsedWikiLink[]; embeds: ParsedWikiLink[] } {
  const links: ParsedWikiLink[] = []
  const embeds: ParsedWikiLink[] = []
  WIKI_LINK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKI_LINK_RE.exec(text)) !== null) {
    const embed = !!m[1]
    const kind: WikiLinkKind = embed ? 'embed' : 'link'
    const raw = m[0]!
    const target = {
      docKey: docKeyFromWikiTarget(m[2]!),
      heading: m[3]?.trim() || undefined,
      blockId: m[4]?.trim() || undefined,
      alias: m[5]?.trim() || undefined,
    }
    const entry: ParsedWikiLink = {
      raw,
      kind,
      target,
      start: baseOffset + m.index,
      end: baseOffset + m.index + raw.length,
    }
    if (embed) embeds.push(entry)
    else links.push(entry)
  }
  return { links, embeds }
}

export function parseBlockRefsInText(text: string, baseOffset = 0): ParsedBlockRef[] {
  const refs: ParsedBlockRef[] = []
  const lineStarts: number[] = [0]
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10 /* \n */) lineStarts.push(i + 1)
  }
  const lineFromOffset = (offset: number): number => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const val = lineStarts[mid]!
      if (val <= offset) lo = mid + 1
      else hi = mid - 1
    }
    return Math.max(1, hi + 1)
  }
  BLOCK_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BLOCK_REF_RE.exec(text)) !== null) {
    const blockId = m[1]!
    const token = `^${blockId}`
    const start = baseOffset + m.index + (m[0]!.length - token.length)
    refs.push({
      blockId,
      start,
      end: start + token.length,
      line: lineFromOffset(start - baseOffset),
    })
  }
  return refs
}

export function parseInlineTags(text: string): string[] {
  const tags = new Set<string>()
  const re = /(?:^|\s)#([a-zA-Z0-9_/-]+)/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    tags.add(m[1]!)
  }
  return [...tags]
}

/** Obsidian/Markdown escape: \[\[link\]\] → [[link]], otherwise the parser cannot hit it.*/
export function unescapeWikiLinksInMarkdown(text: string): string {
  return text.replace(/\\\[\\\[/gu, '[[').replace(/\\\]\\\]/gu, ']]')
}

export function parseDocumentKnowledge(content: string): {
  frontmatter: Record<string, unknown>
  body: string
  links: ParsedWikiLink[]
  embeds: ParsedWikiLink[]
  blockRefs: ParsedBlockRef[]
  inlineTags: string[]
} {
  const { frontmatter, body } = parseFrontmatter(content)
  const { links, embeds } = parseWikiLinksInText(unescapeWikiLinksInMarkdown(body))
  const blockRefs = parseBlockRefsInText(body)
  const inlineTags = parseInlineTags(body)
  return { frontmatter, body, links, embeds, blockRefs, inlineTags }
}
