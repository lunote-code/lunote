import { editorSurfaceForDocumentPath } from '../documentRuntime/documentBodyProjection'

import { normalizeLineEndings } from './normalizeLineEndings'

export type MemoryFlushCommit =
  | { action: 'normalize'; content: string }
  | { action: 'content-changed'; content: string }

export function projectedDocumentSurfacesEqual(path: string, current: string, saved: string): boolean {
  return (
    normalizeLineEndings(editorSurfaceForDocumentPath(path, current)) ===
    normalizeLineEndings(editorSurfaceForDocumentPath(path, saved))
  )
}

/**
 * Decide whether a tab-leave memory flush is a real edit.
 * Callers must pass cache/kernel body when the editor has not been user-edited,
 * so a forced visual serialize cannot create a false dirty flag.
 */
export function decideMemoryFlushCommit(args: {
  path: string
  flushedBody: string
  savedContent: string | undefined
  normalizeMarkdownForCompare?: (markdown: string) => string | null
}): MemoryFlushCommit {
  const { path, flushedBody, savedContent, normalizeMarkdownForCompare } = args
  const projected = editorSurfaceForDocumentPath(path, flushedBody)

  if (savedContent != null && normalizeMarkdownForCompare) {
    const normalizedBody = normalizeMarkdownForCompare(flushedBody)
    const normalizedSaved = normalizeMarkdownForCompare(savedContent)
    if (normalizedBody != null && normalizedSaved != null && normalizedBody === normalizedSaved) {
      return { action: 'normalize', content: savedContent }
    }
  }

  if (savedContent != null && projectedDocumentSurfacesEqual(path, flushedBody, savedContent)) {
    return { action: 'normalize', content: savedContent }
  }

  return { action: 'content-changed', content: projected }
}

export function shouldIgnoreEditorMarkdownSync(args: {
  path: string
  nextMarkdown: string
  savedContent: string | undefined
  hasUserEdited?: boolean
  normalizeMarkdownForCompare?: (markdown: string) => string | null
}): boolean {
  if (args.hasUserEdited === false) return true
  if (args.savedContent != null && args.normalizeMarkdownForCompare) {
    const normalizedValue = args.normalizeMarkdownForCompare(args.nextMarkdown)
    const normalizedSaved = args.normalizeMarkdownForCompare(args.savedContent)
    if (normalizedValue != null && normalizedSaved != null && normalizedValue === normalizedSaved) {
      return true
    }
  }
  if (args.savedContent != null && projectedDocumentSurfacesEqual(args.path, args.nextMarkdown, args.savedContent)) {
    return true
  }
  return false
}
