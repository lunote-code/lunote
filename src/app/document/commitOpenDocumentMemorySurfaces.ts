import { syncDocumentFrontmatterFromMarkdown } from '../../editor/documentFrontmatterStore'
import {
  applyActiveDocumentContentImmediately,
  dispatchDocumentCommand,
} from '../../documentRuntime/documentKernel'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { pathsEqual } from '../../lib/workspacePathUtils'

export type CommitOpenDocumentMemorySurfacesArgs = {
  absolutePath: string
  activePath: string | null
  editorSurface: string
  sourceIdentity: string
  source: string
  contentRef: { current: string }
}

/** Single coordinator for open-document memory writes from knowledge/wiki mutations. */
export async function commitOpenDocumentMemorySurfaces(
  args: CommitOpenDocumentMemorySurfacesArgs,
): Promise<void> {
  const { absolutePath, activePath, editorSurface, sourceIdentity, source, contentRef } = args
  const isActive = pathsEqual(activePath ?? '', absolutePath)

  syncDocumentFrontmatterFromMarkdown(absolutePath, sourceIdentity)
  await dispatchDocumentCommand({
    type: 'UPDATE_OPEN_DOCUMENT_CONTENT',
    path: absolutePath,
    content: editorSurface,
    source,
  })
  setSourceModeIdentity(absolutePath, sourceIdentity)
  if (isActive) {
    contentRef.current = editorSurface
    applyActiveDocumentContentImmediately(absolutePath, editorSurface, source)
  }
}
