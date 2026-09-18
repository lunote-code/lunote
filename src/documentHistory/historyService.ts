import { isBufferTabId } from '../app/workspace/constants'
import { splitDocumentMarkdown } from '../editor/documentFrontmatter'
import type { DocumentCommand } from '../documentRuntime/documentTypes'
import { resolveLatestDocumentBody } from '../documentRuntime/documentAuthority'
import { getDocumentRuntimeSnapshot } from '../documentRuntime/documentKernel'
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
  const content = (resolver ?? resolveLatestDocumentBody)(path)
  if (content !== undefined) return diskMarkdownForDocumentSave(path, content)
  throw new Error(`Failed to resolve document body for history snapshot: ${path}`)
}

export async function createManualSnapshotForDocument(
  params: CreateSnapshotParams,
): Promise<DocumentHistoryEntry | null> {
  if (!params.rootDir || !params.path || isBufferTabId(params.path)) return null
  const activePath = getDocumentRuntimeSnapshot().activePath
  const targetingActiveDocument = pathsEqual(params.path, activePath)
  if (targetingActiveDocument) {
    const flushed = await params.flushEditorToMemory()
    if (!flushed) return null
  }
  const content = resolveSnapshotContent(params.path, params.resolveDocumentBody)
  const { frontmatter } = splitDocumentMarkdown(content)
  const titleFromFrontmatter = typeof frontmatter.title === 'string' ? frontmatter.title.trim() : ''
  return (params.createSnapshot ?? createDocumentSnapshot)({
    rootDir: params.rootDir,
    path: params.path,
    content,
    title: titleFromFrontmatter || null,
    source: 'manual',
  })
}

export async function createAutoSnapshotForSavedDocument(params: {
  rootDir: string
  path: string
  content: string
  source?: 'save' | 'autosave'
  createSnapshot?: typeof createDocumentSnapshot
}): Promise<DocumentHistoryEntry | null> {
  if (!params.rootDir || !params.path || isBufferTabId(params.path)) return null
  const { frontmatter } = splitDocumentMarkdown(params.content)
  const titleFromFrontmatter = typeof frontmatter.title === 'string' ? frontmatter.title.trim() : ''
  return (params.createSnapshot ?? createDocumentSnapshot)({
    rootDir: params.rootDir,
    path: params.path,
    content: params.content,
    title: titleFromFrontmatter || null,
    source: params.source ?? 'save',
  })
}

export async function restoreSnapshotToEditor(
  params: RestoreSnapshotParams,
): Promise<DocumentHistorySnapshot> {
  const activePath = getDocumentRuntimeSnapshot().activePath
  const restoringActiveDocument = pathsEqual(params.path, activePath)

  if (restoringActiveDocument && params.flushEditorToMemory) {
    const flushed = await params.flushEditorToMemory()
    if (!flushed) {
      throw new Error('Failed to capture current editor content before restore')
    }
  }

  const snapshot = await (params.readSnapshot ?? readDocumentSnapshot)({
    rootDir: params.rootDir,
    path: params.path,
    snapshotId: params.snapshotId,
  })
  if (!pathsEqual(snapshot.entry.path, params.path)) {
    throw new Error(`History snapshot path mismatch: expected ${params.path} got ${snapshot.entry.path}`)
  }

  const preRestoreContent = resolveSnapshotContent(params.path, params.resolveDocumentBody)
  const { frontmatter } = splitDocumentMarkdown(preRestoreContent)
  const titleFromFrontmatter = typeof frontmatter.title === 'string' ? frontmatter.title.trim() : ''
  await (params.createSnapshot ?? createDocumentSnapshot)({
    rootDir: params.rootDir,
    path: params.path,
    content: preRestoreContent,
    title: titleFromFrontmatter || null,
    source: 'pre_restore',
  })

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
