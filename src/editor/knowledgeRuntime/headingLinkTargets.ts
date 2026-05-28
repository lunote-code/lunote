import { canonicalizeWikiLinkText } from './wikiCanonical'
import { resolveDocKey } from './knowledgeRegistry'
import type { DocKey } from './types'

export type HeadingTarget = {
  hostDocKey: DocKey
  heading: string
  level: number
  line: number
}

const headingTargetByCanonical = new Map<string, HeadingTarget>()
const headingCanonicalsByHost = new Map<DocKey, string[]>()
const headingLinesByHostAndCanonical = new Map<DocKey, Map<string, number>>()

function stripHeadingMarkdown(raw: string): string {
  return raw
    .replace(/[*_`~[\]()]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** Register the H1–H6 headings in the document as wiki targets (when there is no independent file with the same name).*/
export function registerHeadingTargets(hostDocKey: DocKey, markdown: string): void {
  unregisterHeadingTargets(hostDocKey)
  const canonicals: string[] = []
  const lineIndexByCanonical = new Map<string, number>()
  for (const [idx, line] of markdown.split('\n').entries()) {
    const m = /^(#{1,6})\s+(.+?)\s*$/u.exec(line)
    if (!m) continue
    const title = stripHeadingMarkdown(m[2]!)
    if (!title) continue
    const canonical = canonicalizeWikiLinkText(title)
    if (!canonical) continue
    const existingFile = resolveDocKey(title) ?? resolveDocKey(canonical)
    if (existingFile != null && existingFile !== hostDocKey) continue

    headingTargetByCanonical.set(canonical, {
      hostDocKey,
      heading: title,
      level: m[1]!.length,
      line: idx + 1,
    })
    canonicals.push(canonical)
    if (!lineIndexByCanonical.has(canonical)) {
      lineIndexByCanonical.set(canonical, idx + 1)
    }
  }
  if (canonicals.length > 0) {
    headingCanonicalsByHost.set(hostDocKey, canonicals)
    headingLinesByHostAndCanonical.set(hostDocKey, lineIndexByCanonical)
  }
}

export function unregisterHeadingTargets(hostDocKey: DocKey): void {
  for (const c of headingCanonicalsByHost.get(hostDocKey) ?? []) {
    const t = headingTargetByCanonical.get(c)
    if (t?.hostDocKey === hostDocKey) headingTargetByCanonical.delete(c)
  }
  headingCanonicalsByHost.delete(hostDocKey)
  headingLinesByHostAndCanonical.delete(hostDocKey)
}

export function resolveHeadingTarget(query: string): HeadingTarget | null {
  const canonical = canonicalizeWikiLinkText(query.trim())
  if (!canonical) return null
  return headingTargetByCanonical.get(canonical) ?? null
}

export function listHeadingCanonicalsForHost(hostDocKey: DocKey): readonly string[] {
  return headingCanonicalsByHost.get(hostDocKey) ?? []
}

export function resolveHeadingLineInDocument(hostDocKey: DocKey, query: string): number | null {
  const canonical = canonicalizeWikiLinkText(query.trim())
  if (!canonical) return null
  return headingLinesByHostAndCanonical.get(hostDocKey)?.get(canonical) ?? null
}

export function resetHeadingLinkTargets(): void {
  headingTargetByCanonical.clear()
  headingCanonicalsByHost.clear()
  headingLinesByHostAndCanonical.clear()
}
