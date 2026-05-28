import {
  normPath,
  pathCompareKey,
  relativePathUnderRoot,
} from '../../lib/workspacePathUtils'
import { emitKnowledgeEvent } from './knowledgeEvents'
import { resetIncrementalIndexer, setIndexerVaultRoot } from './incrementalIndexer'
import { resetKnowledgeIndex } from './knowledgeIndex'
import { resetKnowledgeRegistry, setActiveVault } from './knowledgeRegistry'
import { resetLinkGraph } from './linkGraph'
import { resetLinkGraphIndex } from './linkGraphIndex'
import { resetBacklinkEngine } from './backlinkEngine'
import { resetTagIndex } from './tagIndex'
import { resetBlockReferenceIndex } from './blockReference'
import { resetSearchRuntime } from './searchRuntime'
import { resetWorkspaceRuntime } from './workspaceRuntime'
import { resetGraphRuntime } from './graphRuntime'
import { resetLinkIndexState } from './linkIndexState'
import { resetHeadingLinkTargets } from './headingLinkTargets'
import { resetWorkspaceLinkGraphBootstrap } from './workspaceLinkGraphBootstrap'
import type { AbsoluteDocPath, DocKey, VaultSession } from './types'

const sessions = new Map<string, VaultSession>()
let activeVaultId: string | null = null

export function vaultIdFromRoot(rootDir: string): string {
  return pathCompareKey(rootDir)
}

export function absolutePathToDocKey(rootDir: string, absolutePath: AbsoluteDocPath): DocKey {
  const rel = relativePathUnderRoot(rootDir, absolutePath)
  const relPath = rel ?? normPath(absolutePath)
  const key = relPath.replace(/\.md$/iu, '')
  return key || 'index'
}

export function docKeyToDisplayTitle(docKey: DocKey): string {
  const base = docKey.split('/').pop() ?? docKey
  return base || docKey
}

export function openVault(rootDir: string): VaultSession {
  const vaultId = vaultIdFromRoot(rootDir)
  const existing = sessions.get(vaultId)
  if (existing) {
    activeVaultId = vaultId
    setActiveVault(existing)
    setIndexerVaultRoot(rootDir)
    emitKnowledgeEvent('vault-opened', { vaultId, rootDir })
    return existing
  }
  const session: VaultSession = {
    vaultId,
    rootDir: normPath(rootDir),
    openedAt: performance.now(),
  }
  sessions.set(vaultId, session)
  activeVaultId = vaultId
  setActiveVault(session)
  setIndexerVaultRoot(rootDir)
  emitKnowledgeEvent('vault-opened', { vaultId, rootDir })
  return session
}

export function closeVault(vaultId?: string): void {
  const id = vaultId ?? activeVaultId
  if (!id) return
  sessions.delete(id)
  if (activeVaultId === id) {
    activeVaultId = null
    resetKnowledgeRuntime()
    emitKnowledgeEvent('vault-closed', { vaultId: id })
  }
}

export function getActiveVaultSession(): VaultSession | null {
  if (!activeVaultId) return null
  return sessions.get(activeVaultId) ?? null
}

export function getVaultRootDir(): string | null {
  return getActiveVaultSession()?.rootDir ?? null
}

export function notifyDocumentAdded(absolutePath: AbsoluteDocPath): void {
  const vault = getActiveVaultSession()
  if (!vault) return
  const docKey = absolutePathToDocKey(vault.rootDir, absolutePath)
  emitKnowledgeEvent('document-added', { docKey, absolutePath })
}

export function notifyDocumentRenamed(fromPath: AbsoluteDocPath, toPath: AbsoluteDocPath): void {
  const vault = getActiveVaultSession()
  if (!vault) return
  const fromKey = absolutePathToDocKey(vault.rootDir, fromPath)
  const toKey = absolutePathToDocKey(vault.rootDir, toPath)
  emitKnowledgeEvent('document-renamed', {
    fromKey,
    toKey,
    fromPath,
    toPath,
  })
}

export function resetKnowledgeRuntime(): void {
  setActiveVault(null)
  resetKnowledgeRegistry()
  resetKnowledgeIndex()
  resetLinkGraph()
  resetLinkGraphIndex()
  resetHeadingLinkTargets()
  resetBacklinkEngine()
  resetTagIndex()
  resetBlockReferenceIndex()
  resetIncrementalIndexer()
  resetSearchRuntime()
  resetWorkspaceRuntime()
  resetGraphRuntime()
  resetWorkspaceLinkGraphBootstrap()
  resetLinkIndexState()
}
