import { invoke, isTauri } from '@tauri-apps/api/core'
import { parseWikiLinksInText, canonicalizeWikiLinkText } from '../knowledgeRuntime'
import {
  onKnowledgeDocumentRemoved,
  onKnowledgeDocumentRenamed,
  onKnowledgeDocumentSaved,
} from '../knowledgeRuntime'
import { listDocumentMetas } from '../knowledgeRuntime'
import { docKeyFromWikiTarget } from '../knowledgeRuntime'
import {
  docKeyToAbsolutePath,
  absolutePathToDocKeyOs,
  getKnowledgeVaultRoot,
  getVaultFileAdapter,
  loadNoteContent,
} from './vaultRuntime'
import type { AbsoluteDocPath, DocKey } from '../knowledgeRuntime/types'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { getDocumentAuthorityProjection } from '../../documentRuntime/documentAuthority'
import { pathsEqual } from '../../lib/workspacePathUtils'

const renameQueue: Array<{ fromKey: DocKey; toKey: DocKey }> = []
let renameDraining = false

function defaultNoteContent(title: string): string {
  return `---\ntitle: ${title}\n---\n\n# ${title}\n\n`
}

export async function createNote(
  docKey: DocKey,
  options?: { content?: string; openAfter?: boolean },
): Promise<AbsoluteDocPath> {
  const adapter = getVaultFileAdapter()
  const path = docKeyToAbsolutePath(docKey)
  const title = docKey.split('/').pop() ?? docKey
  const content = options?.content ?? defaultNoteContent(title)
  if (adapter) {
    if (adapter.exists && (await adapter.exists(path))) {
      throw new Error(`Note already exists: ${docKey}`)
    }
    await adapter.create(path, content)
  }
  onKnowledgeDocumentSaved(path, content)
  return path
}

export async function deleteNote(docKey: DocKey): Promise<void> {
  const adapter = getVaultFileAdapter()
  const path = docKeyToAbsolutePath(docKey)
  if (adapter) await adapter.delete(path)
  onKnowledgeDocumentRemoved(path)
}

export async function renameNote(fromKey: DocKey, toKey: DocKey): Promise<AbsoluteDocPath> {
  const fromPath = docKeyToAbsolutePath(fromKey)
  const toPath = docKeyToAbsolutePath(toKey)
  const adapter = getVaultFileAdapter()
  if (adapter) await adapter.rename(fromPath, toPath)
  onKnowledgeDocumentRenamed(fromPath, toPath)
  enqueueRenameLinkPropagation(fromKey, toKey)
  return toPath
}

export function enqueueRenameLinkPropagation(fromKey: DocKey, toKey: DocKey): void {
  renameQueue.push({ fromKey, toKey })
  scheduleRenameDrain()
}

function scheduleRenameDrain(): void {
  if (renameDraining) return
  renameDraining = true
  const run = async () => {
    renameDraining = false
    const batch = [...renameQueue]
    renameQueue.length = 0
    for (const job of batch) {
      await propagateWikiLinksInVault(job.fromKey, job.toKey)
    }
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => void run(), { timeout: 500 })
  } else {
    queueMicrotask(() => void run())
  }
}

/** Incremental: Only update [[fromKey]] references in indexed documents (no full library scan of the directory tree)*/
export async function propagateWikiLinksInVault(fromKey: DocKey, toKey: DocKey): Promise<void> {
  const root = getKnowledgeVaultRoot()
  if (!root) return

  const fromVariants = [fromKey, fromKey.split('/').pop()!].filter(Boolean)
  const canonicalVariants = fromVariants.map((v) => canonicalizeWikiLinkText(v)).filter(Boolean)
  const allVariants = Array.from(new Set([...fromVariants, ...canonicalVariants])).filter(Boolean)
  const re = new RegExp(`(!)?\\[\\[(${allVariants.map(escapeRe).join('|')})([^\\]]*)\\]\\]`, 'gi')
  const metas = listDocumentMetas()
  let targets: Array<{ docKey: DocKey; absolutePath: AbsoluteDocPath }> = metas.map((meta) => ({
    docKey: meta.docKey,
    absolutePath: meta.absolutePath,
  }))
  if (targets.length === 0) {
    const windowWithTauri = typeof window !== 'undefined' ? (window as Window & { __TAURI_INTERNALS__?: unknown }) : null
    const hasTauriBridge =
      isTauri() ||
      (windowWithTauri !== null && typeof windowWithTauri.__TAURI_INTERNALS__ !== 'undefined')
    if (hasTauriBridge) {
      try {
        const docs = await invoke<string[]>('list_markdown_files', { payload: { root } })
        targets = docs.map((docPath) => ({
          docKey: absolutePathToDocKeyOs(docPath, root),
          absolutePath: docPath,
        }))
      } catch {
        // ignore fallback scan errors
      }
    }
  }

  const authority = getDocumentAuthorityProjection()
  const diskUpdates: Array<{ path: AbsoluteDocPath; content: string }> = []
  const memoryOnlyUpdates: Array<{ path: AbsoluteDocPath; content: string }> = []
  for (const meta of targets) {
    if (meta.docKey === toKey) continue
    const content =
      resolveAuthorityBackedDocumentBody(meta.absolutePath, authority) ??
      await loadNoteContent(meta.docKey, meta.absolutePath)
    if (!content) continue
    const { links, embeds } = parseWikiLinksInText(content)
    const touches = [...links, ...embeds].some((l) => {
      const k = docKeyFromWikiTarget(l.target.docKey)
      return k === fromKey || allVariants.includes(l.target.docKey) || allVariants.includes(k)
    })
    re.lastIndex = 0
    if (!touches && !re.test(content)) continue

    re.lastIndex = 0
    const next = content.replace(re, (_m, embed, _target, suffix) => {
      return `${embed ? '!' : ''}[[${toKey}${suffix ?? ''}]]`
    })
    if (next !== content) {
      if (shouldKeepRenameRewriteInMemory(meta.absolutePath, authority)) {
        memoryOnlyUpdates.push({ path: meta.absolutePath, content: next })
      } else {
        diskUpdates.push({ path: meta.absolutePath, content: next })
      }
    }
  }
  for (const update of memoryOnlyUpdates) {
    applyRenameRewriteToMemory(update.path, update.content, authority)
  }
  if (diskUpdates.length > 0) {
    await dispatchDocumentCommand({
      type: 'SAVE_DOCUMENT_BATCH',
      root,
      documents: diskUpdates,
      source: 'knowledge-rename-propagation',
    })
  }
  if (import.meta.env.DEV && memoryOnlyUpdates.length > 0) {
    console.info('[knowledge-rename-propagation] preserved dirty docs in memory', {
      memoryOnlyCount: memoryOnlyUpdates.length,
      diskUpdateCount: diskUpdates.length,
      paths: memoryOnlyUpdates.map((update) => update.path),
    })
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function resetNoteLifecycleRuntime(): void {
  renameQueue.length = 0
  renameDraining = false
}

function resolveAuthorityBackedDocumentBody(
  path: AbsoluteDocPath,
  authority: ReturnType<typeof getDocumentAuthorityProjection>,
): string | undefined {
  if (pathsEqual(authority.runtime.activePath, path)) {
    return authority.runtime.content
  }
  for (const [cachedPath, content] of Object.entries(authority.derivedTabBodies)) {
    if (pathsEqual(cachedPath, path)) return content
  }
  return undefined
}

function shouldKeepRenameRewriteInMemory(
  path: AbsoluteDocPath,
  authority: ReturnType<typeof getDocumentAuthorityProjection>,
): boolean {
  const runtime = authority.runtime
  const isOpen =
    pathsEqual(runtime.activePath, path) ||
    runtime.openedTabs.some((tabPath) => pathsEqual(tabPath, path))
  if (!isOpen) return false
  return Object.entries(runtime.dirtyByPath).some(([dirtyPath, dirty]) => dirty && pathsEqual(dirtyPath, path))
}

function applyRenameRewriteToMemory(
  path: AbsoluteDocPath,
  content: string,
  _authority: ReturnType<typeof getDocumentAuthorityProjection>,
): void {
  void dispatchDocumentCommand({
    type: 'UPDATE_OPEN_DOCUMENT_CONTENT',
    path,
    content,
    source: 'knowledge-rename-propagation-memory',
  })
}
