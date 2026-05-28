import type { PreviewFragment } from './types'

const MAX_PREVIEW_LINES = 24
const MAX_PREVIEW_CHARS = 1200
const MAX_CONCURRENT_HYDRATIONS = 3

let activeHydrations = 0
const hydrationQueue: Array<() => void> = []

export function truncatePreviewMarkdown(markdown: string): string {
  if (markdown.length <= MAX_PREVIEW_CHARS) {
    const lines = markdown.split('\n')
    if (lines.length <= MAX_PREVIEW_LINES) return markdown
    return lines.slice(0, MAX_PREVIEW_LINES).join('\n') + '\n…'
  }
  return markdown.slice(0, MAX_PREVIEW_CHARS) + '…'
}

function collapseWhitespace(text: string): string {
  let out = ''
  let inSpace = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    const isSpace = ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'
    if (isSpace) {
      if (!inSpace) out += ' '
      inSpace = true
      continue
    }
    inSpace = false
    out += ch
  }
  return out.trim()
}

function buildMetadataDerivedFragment(
  markdown: string,
  options?: { heading?: string; blockId?: string },
): { markdown: string; plainSnippet: string } {
  const truncated = truncatePreviewMarkdown(markdown)
  const heading = options?.heading?.trim()
  const blockId = options?.blockId?.trim()
  const prefix = heading
    ? `## ${heading}\n\n`
    : blockId
      ? `^${blockId}\n\n`
      : ''
  const composed = prefix ? truncatePreviewMarkdown(`${prefix}${truncated}`) : truncated
  const snippet = collapseWhitespace(`${heading ?? ''} ${blockId ?? ''} ${truncated}`).slice(0, 200)
  return { markdown: composed, plainSnippet: snippet }
}

export function schedulePreviewHydration(run: () => void | Promise<void>): void {
  if (activeHydrations < MAX_CONCURRENT_HYDRATIONS) {
    activeHydrations += 1
    void Promise.resolve(run()).finally(() => {
      activeHydrations -= 1
      const next = hydrationQueue.shift()
      if (next) schedulePreviewHydration(next)
    })
    return
  }
  hydrationQueue.push(run)
}

export function buildPreviewFragment(
  docKey: string,
  title: string,
  markdown: string,
  contentHash: string,
  options?: { heading?: string; blockId?: string },
): PreviewFragment {
  const { heading, blockId } = options ?? {}
  const extracted = buildMetadataDerivedFragment(markdown, { heading, blockId })
  return {
    docKey,
    title,
    heading,
    blockId,
    markdown: extracted.markdown,
    plainSnippet: extracted.plainSnippet,
    contentHash,
    cachedAt: performance.now(),
  }
}

export function resetPreviewVirtualization(): void {
  activeHydrations = 0
  hydrationQueue.length = 0
}
