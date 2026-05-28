/**
 * Knowledge OS Vault — File system is the only truth, runtime only indexes/caches.
 */
import { normPath } from '../../lib/workspacePathUtils'
import {
  absolutePathToDocKey,
  closeVault,
  getActiveVaultSession,
  getVaultRootDir,
  openVault,
} from '../knowledgeRuntime'
import type { AbsoluteDocPath, DocKey, VaultSession } from '../knowledgeRuntime/types'
import type { VaultFileAdapter } from './types'

let fileAdapter: VaultFileAdapter | null = null

export function registerVaultFileAdapter(adapter: VaultFileAdapter | null): void {
  fileAdapter = adapter
}

export function getVaultFileAdapter(): VaultFileAdapter | null {
  return fileAdapter
}

export function docKeyToAbsolutePath(docKey: DocKey, rootDir?: string): AbsoluteDocPath {
  const root = normPath(rootDir ?? getVaultRootDir() ?? '')
  if (!root) return docKey
  const rel = docKey === 'index' ? 'index' : docKey.replace(/\\/g, '/')
  return `${root}/${rel}.md`
}

export function absolutePathToDocKeyOs(
  absolutePath: AbsoluteDocPath,
  rootDir?: string,
): DocKey {
  const root = rootDir ?? getVaultRootDir()
  if (!root) return absolutePath.replace(/\.md$/iu, '')
  return absolutePathToDocKey(root, absolutePath)
}

export function openKnowledgeVault(rootDir: string): VaultSession {
  return openVault(rootDir)
}

export function closeKnowledgeVault(vaultId?: string): void {
  closeVault(vaultId)
}

export function getKnowledgeVaultSession(): VaultSession | null {
  return getActiveVaultSession()
}

export function getKnowledgeVaultRoot(): string | null {
  return getVaultRootDir()
}

export async function loadNoteContent(
  docKey: DocKey,
  absolutePath?: AbsoluteDocPath,
): Promise<string> {
  const path = absolutePath ?? docKeyToAbsolutePath(docKey)
  if (!fileAdapter) return ''
  return fileAdapter.read(path)
}

export async function saveNoteContent(
  docKey: DocKey,
  content: string,
  absolutePath?: AbsoluteDocPath,
): Promise<void> {
  const path = absolutePath ?? docKeyToAbsolutePath(docKey)
  if (!fileAdapter) return
  await fileAdapter.write(path, content)
}

export function noteTitleFromDocKey(docKey: DocKey): string {
  const base = docKey.split('/').pop() ?? docKey
  return base || docKey
}
