type SearchSnippetContext = {
  before: string
  match: string
  after: string
}

type SearchResultCandidate = {
  before: string
  match: string
  after: string
}

export type PlainTextSearchRange = {
  from: number
  to: number
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
}

function stripHtmlTags(value: string): string {
  return decodeBasicHtmlEntities(value.replace(/<[^>]+>/gu, ''))
}

function normalizeForSearchComparison(value: string): string {
  return stripHtmlTags(value)
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase()
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let index = 0
  while (index < max && a[index] === b[index]) index += 1
  return index
}

function commonSuffixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let index = 0
  while (index < max && a[a.length - 1 - index] === b[b.length - 1 - index]) index += 1
  return index
}

export function extractSearchSnippetContext(snippetHtml: string, fallbackQuery: string): SearchSnippetContext | null {
  const trimmed = snippetHtml.trim()
  const fallback = normalizeForSearchComparison(fallbackQuery)
  if (!trimmed) {
    return fallback ? { before: '', match: fallback, after: '' } : null
  }
  const markMatch = /^(.*?)<mark>(.*?)<\/mark>(.*)$/isu.exec(trimmed)
  if (!markMatch) {
    const plain = normalizeForSearchComparison(trimmed)
    if (!plain) return fallback ? { before: '', match: fallback, after: '' } : null
    return {
      before: '',
      match: fallback || plain,
      after: '',
    }
  }
  const before = normalizeForSearchComparison(markMatch[1] ?? '')
  const match = normalizeForSearchComparison(markMatch[2] ?? '')
  const after = normalizeForSearchComparison(markMatch[3] ?? '')
  if (!before && !match && !after) {
    return fallback ? { before: '', match: fallback, after: '' } : null
  }
  return {
    before,
    match: match || fallback,
    after,
  }
}

function scoreSearchResultCandidate(context: SearchSnippetContext, candidate: SearchResultCandidate): number {
  const before = normalizeForSearchComparison(candidate.before)
  const match = normalizeForSearchComparison(candidate.match)
  const after = normalizeForSearchComparison(candidate.after)

  let score = 0
  if (context.match && match === context.match) score += 500
  else if (context.match && match.includes(context.match)) score += 280

  if (context.before) {
    score += commonSuffixLength(context.before, before) * 6
    if (before.endsWith(context.before)) score += 180
    else if (before.includes(context.before)) score += 90
  }

  if (context.after) {
    score += commonPrefixLength(context.after, after) * 6
    if (after.startsWith(context.after)) score += 180
    else if (after.includes(context.after)) score += 90
  }

  return score
}

export function pickBestSearchResultCandidateIndex(
  snippetHtml: string,
  fallbackQuery: string,
  candidates: readonly SearchResultCandidate[],
): number {
  if (candidates.length <= 1) return 0
  const context = extractSearchSnippetContext(snippetHtml, fallbackQuery)
  if (!context?.match) return 0

  let bestIndex = 0
  let bestScore = Number.NEGATIVE_INFINITY
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (!candidate) continue
    const score = scoreSearchResultCandidate(context, candidate)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  return bestIndex
}

export function findBestPlainTextSearchRange(
  text: string,
  query: string,
  snippetHtml?: string,
): PlainTextSearchRange | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  const haystack = text.toLocaleLowerCase()
  const needle = trimmed.toLocaleLowerCase()
  const ranges: PlainTextSearchRange[] = []
  let index = haystack.indexOf(needle)
  while (index >= 0) {
    ranges.push({ from: index, to: index + trimmed.length })
    index = haystack.indexOf(needle, index + Math.max(trimmed.length, 1))
  }
  if (ranges.length === 0) return null
  if (!snippetHtml?.trim() || ranges.length === 1) return ranges[0] ?? null

  const pickedIndex = pickBestSearchResultCandidateIndex(
    snippetHtml,
    trimmed,
    ranges.map((range) => ({
      before: text.slice(Math.max(0, range.from - 120), range.from),
      match: text.slice(range.from, range.to),
      after: text.slice(range.to, Math.min(text.length, range.to + 120)),
    })),
  )
  return ranges[pickedIndex] ?? ranges[0] ?? null
}
