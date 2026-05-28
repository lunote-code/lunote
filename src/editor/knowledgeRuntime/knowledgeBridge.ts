/**
 * Thin integration layer with App/Document Runtime (does not modify CBR).
 * Called when open/save/rename/delete workspace.
 */
import { propagateDocumentRename } from './backlinkEngine'
import { parseChangedDocument, removeDocumentFromIndex } from './incrementalIndexer'
import { resolveDocKey } from './knowledgeRegistry'
import { ensureGraphRuntimeListening, refreshGraphViewIncremental } from './graphRuntime'
import {
  absolutePathToDocKey,
  getActiveVaultSession,
  getVaultRootDir,
  notifyDocumentAdded,
  notifyDocumentRenamed,
  openVault,
} from './vaultRuntime'
import { bindWorkspaceVault, openDocumentTab } from './workspaceRuntime'
import type { AbsoluteDocPath } from './types'

export function onKnowledgeWorkspaceOpened(rootDir: string): void {
  const session = openVault(rootDir)
  bindWorkspaceVault(session.vaultId)
  ensureGraphRuntimeListening()
}

export function onKnowledgeDocumentOpened(absolutePath: AbsoluteDocPath, content?: string): void {
  const vault = getActiveVaultSession()
  if (!vault) return
  const docKey = absolutePathToDocKey(vault.rootDir, absolutePath)
  openDocumentTab(absolutePath, docKey)
  notifyDocumentAdded(absolutePath)
  if (content != null) {
    parseChangedDocument(absolutePath, content, vault.rootDir)
  }
}

export function onKnowledgeDocumentSaved(absolutePath: AbsoluteDocPath, content: string): void {
  const root = getVaultRootDir()
  if (!root) return
  parseChangedDocument(absolutePath, content, root)
}

export function onKnowledgeDocumentRenamed(fromPath: AbsoluteDocPath, toPath: AbsoluteDocPath): void {
  const vault = getActiveVaultSession()
  if (!vault) return
  const fromKey = absolutePathToDocKey(vault.rootDir, fromPath)
  const toKey = absolutePathToDocKey(vault.rootDir, toPath)
  propagateDocumentRename(fromKey, toKey)
  notifyDocumentRenamed(fromPath, toPath)
  refreshGraphViewIncremental()
}

export function onKnowledgeDocumentRemoved(absolutePath: AbsoluteDocPath): void {
  const vault = getActiveVaultSession()
  if (!vault) return
  const docKey =
    resolveDocKey(absolutePathToDocKey(vault.rootDir, absolutePath)) ??
    absolutePathToDocKey(vault.rootDir, absolutePath)
  removeDocumentFromIndex(docKey, absolutePath)
}
