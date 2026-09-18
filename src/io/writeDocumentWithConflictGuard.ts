import { dispatchDocumentCommand, hasDocumentRuntimeCapabilities } from '../documentRuntime/documentKernel'
import { statNoteFile } from '../platform/tauri/documentService'
import { writeDocument } from './documentIO'

export async function writeDocumentWithConflictGuard(args: {
  root: string
  path: string
  content: string
  source?: string
}): Promise<void> {
  const { root, path, content, source = 'conflict-guard-write' } = args
  let expectedModifiedSecs: number | undefined
  try {
    expectedModifiedSecs = (await statNoteFile(root, path)).modifiedSecs
  } catch {
    expectedModifiedSecs = undefined
  }
  if (hasDocumentRuntimeCapabilities()) {
    await dispatchDocumentCommand({
      type: 'SAVE_DOCUMENT',
      root,
      path,
      content,
      source,
      expectedModifiedSecs,
    })
    return
  }
  await writeDocument(root, path, content, { expectedModifiedSecs })
}
