import { listDocumentMetas } from './knowledgeRuntime'
import { isWorkspaceTemplateDocKey } from '../templates/templatePathMatch'

export const WIKI_SUGGEST_EMPTY_ID = '__wiki_suggest_empty__'

export type WikiLinkSuggestPathCandidate = {
  docKey: string
  title: string
}

let pathCandidatesProvider: (() => WikiLinkSuggestPathCandidate[]) | null = null
let templatesFolderProvider: (() => readonly string[]) | null = null

/** Workspace file tree fallback (the .md path can still be prompted when the knowledge base index is not completed)*/
export function setWikiLinkSuggestPathProvider(
  provider: (() => WikiLinkSuggestPathCandidate[]) | null,
): void {
  pathCandidatesProvider = provider
}

/** Workspace templates folder(s) used to exclude template files from [[ link suggestions. */
export function setWikiLinkSuggestTemplatesFolderProvider(
  provider: (() => readonly string[]) | null,
): void {
  templatesFolderProvider = provider
}

function shouldExcludeWikiLinkCandidate(docKey: string): boolean {
  return isWorkspaceTemplateDocKey(docKey, templatesFolderProvider?.() ?? [])
}

export type WikiLinkSuggestMatch = {
  embed: boolean
  query: string
  replaceFrom: number
  replaceTo: number
}

export type WikiLinkSuggestItem = {
  id: string
  title: string
  hint: string
  insertTarget: string
  score: number
  disabled?: boolean
}

const WIKI_SUGGEST_RE = /(?:^|\s)(!?\[\[)([^\]|#^]*)$/u

const MENU_ITEM_HEIGHT = 36
const MENU_PADDING = 12
const MENU_GAP = 2
const MENU_MARGIN = 8
const MENU_MIN_HEIGHT = 120

export function matchWikiLinkSuggestInText(
  textBefore: string,
  baseOffset: number,
): WikiLinkSuggestMatch | null {
  const hit = WIKI_SUGGEST_RE.exec(textBefore)
  if (!hit) return null
  const open = hit[1] ?? '[['
  const query = hit[2] ?? ''
  const openLen = open.length
  const relFrom = textBefore.length - openLen - query.length
  if (relFrom < 0) return null
  return {
    embed: open.startsWith('!'),
    query,
    replaceFrom: baseOffset + relFrom,
    replaceTo: baseOffset + textBefore.length,
  }
}

function scoreWikiCandidate(
  query: string,
  title: string,
  docKey: string,
): number {
  const q = query.trim().toLowerCase()
  const titleLower = title.toLowerCase()
  const keyLower = docKey.toLowerCase()
  const base = (docKey.split('/').pop() ?? '').toLowerCase()
  if (!q) return 1
  if (titleLower === q || keyLower === q || base === q) return 100
  if (titleLower.startsWith(q)) return 80
  if (keyLower.startsWith(q) || base.startsWith(q)) return 70
  if (titleLower.includes(q) || keyLower.includes(q) || base.includes(q)) return 50
  return 0
}

export function wikiLinkInsertTarget(title: string, docKey: string): string {
  const t = title.trim()
  if (t) return t
  const base = docKey.split('/').pop()
  return base || docKey
}

export function buildWikiLinkInsertText(embed: boolean, target: string): string {
  return `${embed ? '!' : ''}[[${target}]]`
}

function collectRegistryCandidates(
  query: string,
  excludeDocKey?: string,
): WikiLinkSuggestItem[] {
  const items: WikiLinkSuggestItem[] = []
  for (const meta of listDocumentMetas()) {
    if (excludeDocKey && meta.docKey === excludeDocKey) continue
    if (shouldExcludeWikiLinkCandidate(meta.docKey)) continue
    const score = scoreWikiCandidate(query, meta.title, meta.docKey)
    if (score <= 0) continue
    items.push({
      id: meta.docKey,
      title: meta.title,
      hint: meta.docKey,
      insertTarget: wikiLinkInsertTarget(meta.title, meta.docKey),
      score,
    })
  }
  return items
}

function collectPathFallbackCandidates(query: string): WikiLinkSuggestItem[] {
  const provider = pathCandidatesProvider
  if (!provider) return []
  const items: WikiLinkSuggestItem[] = []
  for (const candidate of provider()) {
    if (shouldExcludeWikiLinkCandidate(candidate.docKey)) continue
    const score = scoreWikiCandidate(query, candidate.title, candidate.docKey)
    if (score <= 0) continue
    items.push({
      id: `path:${candidate.docKey}`,
      title: candidate.title,
      hint: candidate.docKey,
      insertTarget: wikiLinkInsertTarget(candidate.title, candidate.docKey),
      score: score - 1,
    })
  }
  return items
}

function emptyWikiSuggestItem(): WikiLinkSuggestItem {
  return {
    id: WIKI_SUGGEST_EMPTY_ID,
    title: 'No documents available',
    hint: 'Open a workspace and wait for indexing to finish',
    insertTarget: '',
    score: 0,
    disabled: true,
  }
}

export function isWikiSuggestItemSelectable(item: WikiLinkSuggestItem): boolean {
  return !item.disabled && item.id !== WIKI_SUGGEST_EMPTY_ID && Boolean(item.insertTarget)
}

export function searchWikiLinkSuggestCandidates(
  query: string,
  options?: { excludeDocKey?: string; limit?: number },
): WikiLinkSuggestItem[] {
  const limit = options?.limit ?? 8
  const seen = new Set<string>()
  const merged: WikiLinkSuggestItem[] = []
  for (const item of [...collectRegistryCandidates(query, options?.excludeDocKey), ...collectPathFallbackCandidates(query)]) {
    const key = item.hint || item.id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  merged.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  const picked = merged.slice(0, limit)
  return picked.length > 0 ? picked : [emptyWikiSuggestItem()]
}

export function estimateSuggestMenuHeight(itemCount: number): number {
  if (itemCount <= 0) return MENU_PADDING
  return MENU_PADDING + itemCount * MENU_ITEM_HEIGHT + (itemCount - 1) * MENU_GAP
}

type CaretRect = Pick<DOMRect, 'left' | 'top' | 'bottom'>

export function computeSuggestMenuPosition(
  caretRect: CaretRect,
  shellRect: DOMRect,
  itemCount: number,
): { left: number; top: number; placement: 'above' | 'below'; maxHeight?: number } {
  const menuHeight = estimateSuggestMenuHeight(itemCount)
  const spaceBelow = Math.max(0, shellRect.bottom - caretRect.bottom - MENU_MARGIN)
  const spaceAbove = Math.max(0, caretRect.top - shellRect.top - MENU_MARGIN)
  const left = Math.max(8, Math.min(caretRect.left - shellRect.left, shellRect.width - 280))

  const fitsBelow = spaceBelow >= menuHeight
  const fitsAbove = spaceAbove >= menuHeight

  if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
    return {
      left,
      top: caretRect.bottom - shellRect.top + MENU_MARGIN,
      placement: 'below',
      maxHeight: fitsBelow ? undefined : Math.max(MENU_MIN_HEIGHT, spaceBelow),
    }
  }

  const maxHeight = fitsAbove ? undefined : Math.max(MENU_MIN_HEIGHT, spaceAbove)
  const visibleHeight = maxHeight ? Math.min(menuHeight, maxHeight) : menuHeight
  return {
    left,
    top: caretRect.top - shellRect.top - visibleHeight - MENU_MARGIN,
    placement: 'above',
    maxHeight,
  }
}
