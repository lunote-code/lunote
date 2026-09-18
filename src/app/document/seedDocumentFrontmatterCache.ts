import {
  hasDocumentFrontmatterCache,
  syncDocumentFrontmatterFromMarkdown,
} from '../../editor/documentFrontmatterStore'
import { getSourceModeIdentity } from '../../editor/sourceModeIdentity'
import {
  getDocumentAuthorityProjection,
  resolveLatestDocumentBody,
} from '../../documentRuntime/documentAuthority'
import { pathsEqual } from '../../lib/workspacePathUtils'

export async function seedDocumentFrontmatterCacheIfMissing(args: {
  absolutePath: string
  isOpen: boolean
  activePath: string | null
  contentRef: { current: string }
  readDocument?: (root: string, path: string) => Promise<string>
  rootAtRequest: string
}): Promise<boolean> {
  const { absolutePath, isOpen, activePath, contentRef, readDocument, rootAtRequest } = args
  if (hasDocumentFrontmatterCache(absolutePath)) return true

  const sourceIdentity = getSourceModeIdentity(absolutePath)?.trim()
  if (sourceIdentity) {
    syncDocumentFrontmatterFromMarkdown(absolutePath, sourceIdentity)
    return true
  }

  if (readDocument) {
    try {
      const disk = await readDocument(rootAtRequest, absolutePath)
      syncDocumentFrontmatterFromMarkdown(absolutePath, disk)
      return true
    } catch {
      return false
    }
  }

  if (isOpen) {
    const authority = getDocumentAuthorityProjection()
    const current = resolveLatestDocumentBody(absolutePath, {
      projection: authority,
      contentFallback: contentRef.current,
    })
    if (!current) return false
    syncDocumentFrontmatterFromMarkdown(absolutePath, current)
    return true
  }

  if (pathsEqual(activePath ?? '', absolutePath)) {
    syncDocumentFrontmatterFromMarkdown(absolutePath, contentRef.current)
    return true
  }

  return false
}
