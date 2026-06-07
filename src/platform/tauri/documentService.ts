import { invoke } from '@tauri-apps/api/core'

import {
  assertWritablePathInWorkspace,
  joinRelativePath,
  parentDirectoryOfFile,
  pathHasParentDirSegment,
  resolveWorkspaceFilePath,
} from '../../lib/workspacePathUtils'

export type SaveNoteOptions = {
  expectedModifiedSecs?: number
  forceOverwrite?: boolean
}

export type CreateNotePayload = {
  root: string
  parentPath?: string
  stem?: string
  content?: string
  /** Vault-relative path, e.g. Daily/2026-05-28.md */
  relativePath?: string
}

export type RenameNotePayload = {
  root: string
  oldPath: string
  newName: string
}

export type MoveNotePayload = {
  root: string
  oldPath: string
  destDir: string
}

export type SaveNoteAssetPayload = {
  root: string
  path: string
  relativePath: string
  dataBase64: string
}

export type NoteFileStat = {
  modifiedSecs: number
  size: number
}

export async function readNote(root: string, path: string): Promise<string> {
  const resolvedPath = resolveWorkspaceFilePath(root, path)
  return invoke('read_note', { payload: { root, path: resolvedPath } }) as Promise<string>
}

export async function saveNote(
  root: string,
  path: string,
  content: string,
  options?: SaveNoteOptions,
): Promise<void> {
  const resolvedPath = resolveWorkspaceFilePath(root, path)
  await invoke('save_note', {
    payload: {
      root,
      path: resolvedPath,
      content,
      expectedModifiedSecs: options?.expectedModifiedSecs,
      forceOverwrite: options?.forceOverwrite ?? false,
    },
  })
}

export async function createNote(payload: CreateNotePayload): Promise<string> {
  return invoke<string>('create_note', { payload })
}

export async function deleteNote(root: string, path: string): Promise<void> {
  await invoke('delete_note', { payload: { root, path } })
}

export async function renameNote(payload: RenameNotePayload): Promise<string> {
  return invoke<string>('rename_note', { payload })
}

export async function moveNote(payload: MoveNotePayload): Promise<string> {
  return invoke<string>('move_note', { payload })
}

export async function exportNote(payload: {
  payload: {
    path: string
    content: string
    workspaceRoot: string
  }
}): Promise<void> {
  await invoke('export_note', payload)
}

export async function exportBinaryNote(payload: {
  payload: {
    path: string
    dataBase64: string
    workspaceRoot: string
  }
}): Promise<void> {
  await invoke('export_note_binary', payload)
}

export async function statNoteFile(root: string, path: string): Promise<NoteFileStat> {
  return invoke<NoteFileStat>('note_file_stat', { payload: { root, path } })
}

export async function readWorkspaceFileBase64(root: string, path: string): Promise<string> {
  return invoke<string>('read_workspace_file_base64', { payload: { root, path } })
}

export async function noteAssetExists(
  root: string,
  path: string,
  relativePath: string,
): Promise<boolean> {
  return invoke<boolean>('note_asset_exists', {
    payload: { root, path, relativePath },
  })
}

export async function saveNoteAsset(payload: SaveNoteAssetPayload): Promise<void> {
  assertWritablePathInWorkspace(payload.root, payload.path)
  if (pathHasParentDirSegment(payload.relativePath)) {
    throw new Error('Asset relative path cannot contain ..')
  }
  joinRelativePath(parentDirectoryOfFile(payload.path), payload.relativePath)
  await invoke('save_note_asset', { payload })
}
