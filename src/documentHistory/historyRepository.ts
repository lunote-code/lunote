import { invoke } from '@tauri-apps/api/core'

import type { DocumentHistoryEntry, DocumentHistorySnapshot } from './types'

export async function createDocumentSnapshot(input: {
  rootDir: string
  path: string
  content: string
  title?: string | null
  source?: 'manual' | 'pre_restore'
}): Promise<DocumentHistoryEntry> {
  return invoke<DocumentHistoryEntry>('create_document_snapshot', {
    payload: {
      root: input.rootDir,
      path: input.path,
      content: input.content,
      title: input.title ?? null,
      source: input.source ?? 'manual',
    },
  })
}

export async function listDocumentSnapshots(input: {
  rootDir: string
  path: string
}): Promise<DocumentHistoryEntry[]> {
  return invoke<DocumentHistoryEntry[]>('list_document_snapshots', {
    payload: { root: input.rootDir, path: input.path },
  })
}

export async function readDocumentSnapshot(input: {
  rootDir: string
  path: string
  snapshotId: string
}): Promise<DocumentHistorySnapshot> {
  return invoke<DocumentHistorySnapshot>('read_document_snapshot', {
    payload: { root: input.rootDir, path: input.path, snapshotId: input.snapshotId },
  })
}

export async function deleteDocumentSnapshot(input: {
  rootDir: string
  path: string
  snapshotId: string
}): Promise<void> {
  await invoke('delete_document_snapshot', {
    payload: { root: input.rootDir, path: input.path, snapshotId: input.snapshotId },
  })
}

export async function deleteAllDocumentSnapshots(input: {
  rootDir: string
  path: string
}): Promise<number> {
  return invoke<number>('delete_all_document_snapshots', {
    payload: { root: input.rootDir, path: input.path },
  })
}
