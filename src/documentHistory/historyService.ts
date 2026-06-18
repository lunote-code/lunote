import { isBufferTabId } from '../app/workspace/constants'
import type { DocumentCommand } from '../documentRuntime/documentTypes'
import { resolveDocumentBody } from '../documentRuntime/documentAuthority'
import { diskMarkdownForDocumentSave } from '../lib/editorContentSync'
import { pathsEqual } from '../lib/workspacePathUtils'
import {
  createDocumentSnapshot,
  deleteDocumentSnapshot,
  listDocumentSnapshots,
  readDocumentSnapshot,
} from './historyRepository'
import { suspendAutosaveForPath } from './historyRestoreState'
import type { DocumentHistoryEntry, DocumentHistorySnapshot } from './types'

type ResolveDocumentBodyFn = (path: string) => string | undefined

type CreateSnapshotParams = {
  rootDir: string
  path: string
  flushEditorToMemory: () => Promise<boolean>
  resolveDocumentBody?: ResolveDocumentBodyFn
  createSnapshot?: typeof createDocumentSnapshot
}

type RestoreSnapshotParams = {
  rootDir: string
  path: string
  snapshotId: string
  flushEditorToMemory?: () => Promise<boolean>
  dispatchDocumentCommand: (command: DocumentCommand) => Promise<string | void>
  resolveDocumentBody?: ResolveDocumentBodyFn
  createSnapshot?: typeof createDocumentSnapshot
  readSnapshot?: typeof readDocumentSnapshot
}

function resolveSnapshotContent(path: string, resolver?: ResolveDocumentBodyFn): string {
  const content = (resolver ?? resolveDocumentBody)(path)
  if (content !== undefined) return diskMarkdownForDocumentSave(path, content)
  throw new Error(`Failed to resolve document body for history snapshot: ${path}`)
}

export async function createManualSnapshotForDocument(
  params: CreateSnapshotParams,
): Promise<DocumentHistoryEntry | null> {
  if (!params.rootDir || !params.path || isBufferTabId(params.path)) return null
  const flushed = await params.flushEditorToMemory()
  if (!flushed) return null
  const content = resolveSnapshotContent(params.path, params.resolveDocumentBody)
  return (params.createSnapshot ?? createDocumentSnapshot)({
    rootDir: params.rootDir,
    path: params.path,
    content,
    source: 'manual',
  })
}

export async function restoreSnapshotToEditor(
  params: RestoreSnapshotParams,
): Promise<DocumentHistorySnapshot> {
  if (params.flushEditorToMemory) {
    const flushed = await params.flushEditorToMemory()
    if (!flushed) {
      throw new Error('Failed to capture current editor content before restore')
    }
    await (params.createSnapshot ?? createDocumentSnapshot)({
      rootDir: params.rootDir,
      path: params.path,
      content: resolveSnapshotContent(params.path, params.resolveDocumentBody),
      source: 'pre_restore',
    })
  }
  const snapshot = await (params.readSnapshot ?? readDocumentSnapshot)({
    rootDir: params.rootDir,
    path: params.path,
    snapshotId: params.snapshotId,
  })
  if (!pathsEqual(snapshot.entry.path, params.path)) {
    throw new Error(`History snapshot path mismatch: expected ${params.path} got ${snapshot.entry.path}`)
  }
  await params.dispatchDocumentCommand({
    type: 'RESTORE_DOCUMENT_HISTORY_SNAPSHOT',
    path: params.path,
    content: snapshot.content,
    snapshotId: snapshot.entry.id,
    source: 'history-restore',
  })
  suspendAutosaveForPath(params.path, snapshot.entry.id)
  return snapshot
}

export { deleteDocumentSnapshot, listDocumentSnapshots, readDocumentSnapshot }
