import GithubSlugger from 'github-slugger'
import {
  resolveBlockLineInDocument,
  resolveHeadingLineInDocument,
} from '../knowledgeRuntime'
import { canonicalMarkdownOutline } from '../../markdown/canonicalMarkdownOutline'

import type { DocKey } from '../knowledgeRuntime/types'
import type { NavigationEntry } from './types'
import type { InteractionIntentSource } from './ui/interactionModel/types'

export type ResolvedEditorAnchor = {
  kind: 'block' | 'heading'
  /** 1-based source line */
  line: number
  headingSlug?: string
  blockId?: string
}

/** Title slug: lowercase, remove markdown symbols, fold whitespace, consistent with GitHub slugger.*/
export function normalizeHeadingToSlug(raw: string): string {
  const text = raw
    .trim()
    .replace(/^#+\s*/u, '')
    .replace(/[*_`~[\]()]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  if (!text) return ''
  return new GithubSlugger().slug(text)
}

export function resolveHeadingSlug(heading: string | undefined): string | null {
  if (!heading?.trim()) return null
  const slug = normalizeHeadingToSlug(heading)
  return slug || null
}

/** Locate blockId (1-based line number) in Markdown source code.*/
export function sourceLineNumberForBlockId(markdown: string, blockId: string): number | null {
  const id = blockId.trim()
  if (!id) return null
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\^${escaped}(?:\\s|$)`)
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i] ?? '')) return i + 1
  }
  return null
}

/** Only parse anchors from Markdown body (test/reveal).*/
export function resolveEditorAnchorFromMarkdown(
  entry: Pick<NavigationEntry, 'heading' | 'blockId'>,
  markdown: string,
): ResolvedEditorAnchor | null {
  if (entry.blockId?.trim()) {
    const line = sourceLineNumberForBlockId(markdown, entry.blockId.trim())
    if (line != null) {
      return { kind: 'block', line, blockId: entry.blockId.trim() }
    }
  }
  const headingSlug = resolveHeadingSlug(entry.heading)
  if (headingSlug) {
    const line = canonicalMarkdownOutline.sourceLineNumberForHeadingId(markdown, headingSlug)
    if (line != null) {
      return { kind: 'heading', line, headingSlug }
    }
  }
  return null
}

/**
 * Anchor priority: blockId → heading.
 * If `markdown` is provided, source code parsing is used when the index is not ready; otherwise, docKey runtime indexing is used.
 */
export function resolveEditorAnchor(
  entry: Pick<NavigationEntry, 'heading' | 'blockId'> & { docKey?: DocKey },
  markdown?: string,
): ResolvedEditorAnchor | null {
  if (entry.docKey) {
    if (entry.blockId?.trim()) {
      const line = resolveBlockLineInDocument(entry.docKey, entry.blockId.trim())
      if (line != null) {
        return { kind: 'block', line, blockId: entry.blockId.trim() }
      }
    }
    const headingSlug = resolveHeadingSlug(entry.heading)
    if (headingSlug) {
      const line = resolveHeadingLineInDocument(entry.docKey, entry.heading ?? headingSlug)
      if (line != null) {
        return { kind: 'heading', line, headingSlug }
      }
    }
  }
  if (markdown != null && markdown.length > 0) {
    return resolveEditorAnchorFromMarkdown(entry, markdown)
  }
  return null
}

export type EditorAnchorRevealRequest = {
  docKey: DocKey
  absolutePath: string
  heading?: string
  blockId?: string
  source: InteractionIntentSource
  /** The text after opening the target document; avoid the failure of using the closure content to parse the anchor point when React setState is not submitted.*/
  markdown?: string
}

export function shouldSkipEditorRestoreOnNavigate(source: InteractionIntentSource): boolean {
  return source === 'backlink' || source === 'wiki' || source === 'graph'
}

export async function waitFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
}

export async function waitForEditorDocumentReady(
  isReady: () => boolean,
  timeoutMs = 2500,
): Promise<boolean> {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (isReady()) return true
    await waitFrames(1)
  }
  return isReady()
}

/** Wait for virtual layout/row height measurements to stabilize before revealing.*/
export async function waitForEditorLayoutStable(): Promise<void> {
  await waitFrames(2)
}
