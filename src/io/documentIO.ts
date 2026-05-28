import { readNote, saveNote, saveNoteAsset } from '../platform/tauri/documentService'

export type WriteDocumentOptions = {
  /** Consistent with `note_file_stat.modifiedSecs`; used for optimistic locking verification before saving*/
  expectedModifiedSecs?: number
  /** Force disk overwrite after user confirms retaining local version*/
  forceOverwrite?: boolean
}

export async function readDocument(root: string, path: string): Promise<string> {
  return readNote(root, path)
}

export async function writeDocument(
  root: string,
  path: string,
  content: string,
  options?: WriteDocumentOptions,
): Promise<void> {
  await saveNote(root, path, content, options)
}

export async function copyAssetFile(params: {
  root: string
  path: string
  relativePath: string
  dataBase64: string
}): Promise<void> {
  await saveNoteAsset(params)
}

export const documentIO = {
  readDocument,
  writeDocument,
  copyAssetFile,
}
