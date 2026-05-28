import { isTauri } from '@tauri-apps/api/core'
import { readDocument, writeDocument } from '../../../io/documentIO'
import { relativePathUnderRoot } from '../../../lib/workspacePathUtils'
import { deleteNote, moveNote, renameNote } from '../../../platform/tauri/documentService'
import {
  bootstrapWorkspaceLinkGraphIndex,
  onKnowledgeDocumentRemoved,
  onKnowledgeDocumentRenamed,
  onKnowledgeDocumentSaved,
  parseChangedDocument,
  vaultIdFromRoot,
} from '../../knowledgeRuntime'
import { persistKnowledgeUILayout } from '../knowledgeWorkspaceRuntime'
import {
  absolutePathToDocKeyOs,
  docKeyToAbsolutePath,
  getVaultFileAdapter,
  initKnowledgeOS,
  navigateToWikiLink,
  onKnowledgeOSWorkspaceOpened,
  onKnowledgeOSWorkspaceClosing,
  openNoteInWorkspace,
  registerVaultFileAdapter,
  getKnowledgeWorkspaceSnapshot,
} from '../index'
import { enqueueRenameLinkPropagation } from '../noteLifecycleRuntime'
import type { AbsoluteDocPath, SearchHit, WikiLinkTarget } from '../../knowledgeRuntime/types'
import type { VaultFileAdapter } from '../types'

export function createTauriVaultFileAdapter(rootDir: string): VaultFileAdapter {
  const root = rootDir.replace(/[/\\]+$/u, '')
  const toAbsolutePath = (path: string): string => {
    if (/^(?:[A-Za-z]:[\\/]|\/|\\\\)/u.test(path)) return path
    const rel = path.replace(/^[/\\]+/u, '')
    return `${root}/${rel}`.replace(/\/+/g, '/')
  }
  return {
    read: async (path) => readDocument(root, path),
    write: async (path, content) => {
      await writeDocument(root, path, content)
    },
    create: async (path, content = '') => {
      await writeDocument(root, path, content)
    },
    delete: async (path) => {
      await deleteNote(root, path)
    },
    rename: async (from, to) => {
      const fromAbsolute = toAbsolutePath(from).replace(/\\/g, '/')
      const toAbsolute = toAbsolutePath(to).replace(/\\/g, '/')
      const fromDir = fromAbsolute.replace(/\/[^/]+$/u, '')
      const toDir = toAbsolute.replace(/\/[^/]+$/u, '')
      const newName = toAbsolute.split('/').pop() ?? ''

      let currentPath = fromAbsolute
      if (fromDir !== toDir) {
        currentPath = await moveNote({
          root,
          oldPath: fromAbsolute,
          destDir: toDir,
        })
      }

      const currentName = currentPath.replace(/\\/g, '/').split('/').pop() ?? ''
      if (newName && currentName !== newName) {
        const currentRelativePath = relativePathUnderRoot(root, currentPath) ?? currentPath
        await renameNote({ root, oldPath: currentRelativePath, newName })
      }
    },
  }
}

export function bootstrapKnowledgeOS(rootDir: string): void {
  if (!rootDir.trim()) return
  const windowWithTauri = typeof window !== 'undefined' ? (window as Window & { __TAURI_INTERNALS__?: unknown }) : null
  const hasTauriBridge =
    isTauri() ||
    (windowWithTauri !== null && typeof windowWithTauri.__TAURI_INTERNALS__ !== 'undefined')
  const adapter = hasTauriBridge ? createTauriVaultFileAdapter(rootDir) : null
  if (adapter && !getVaultFileAdapter()) {
    registerVaultFileAdapter(adapter)
  }
  initKnowledgeOS({
    fileAdapter: adapter ?? undefined,
    contentResolver: async (docKey) => {
      if (!hasTauriBridge) return null
      const path = docKeyToAbsolutePath(docKey, rootDir)
      try {
        return await readDocument(rootDir.replace(/[/\\]+$/u, ''), path)
      } catch {
        return null
      }
    },
  })
  onKnowledgeOSWorkspaceOpened(rootDir)
}

export function teardownKnowledgeOS(rootDir: string): void {
  if (rootDir.trim()) onKnowledgeOSWorkspaceClosing(rootDir)
}

export function indexWorkspaceFiles(
  rootDir: string,
  paths: AbsoluteDocPath[],
  options?: { activeDocKey?: string | null },
): Promise<number> {
  const root = rootDir.replace(/[/\\]+$/u, '')
  const readContent = (path: AbsoluteDocPath) => readDocument(root, path)
  return bootstrapWorkspaceLinkGraphIndex(rootDir, paths, readContent, options)
}

export function notifyKnowledgeDocumentOpen(path: AbsoluteDocPath, content: string, rootDir: string): void {
  parseChangedDocument(path, content, rootDir)
  openNoteInWorkspace(path, absolutePathToDocKeyOs(path, rootDir))
}

export function notifyKnowledgeDocumentSave(path: AbsoluteDocPath, content: string): void {
  onKnowledgeDocumentSaved(path, content)
}

export function notifyKnowledgeDocumentRename(fromPath: AbsoluteDocPath, toPath: AbsoluteDocPath): void {
  onKnowledgeDocumentRenamed(fromPath, toPath)
}

/**
 * After a note file path changes on disk, refresh the link graph and rewrite [[ ]] refs in other notes.
 * Obsidian migrants expect renames not to orphan wiki links across the vault.
 */
export function syncKnowledgeVaultFilePathChange(
  rootDir: string,
  fromPath: AbsoluteDocPath,
  toPath: AbsoluteDocPath,
): void {
  if (!rootDir.trim() || !fromPath || !toPath) return
  notifyKnowledgeDocumentRename(fromPath, toPath)
  const fromKey = absolutePathToDocKeyOs(fromPath, rootDir)
  const toKey = absolutePathToDocKeyOs(toPath, rootDir)
  if (fromKey && toKey && fromKey !== toKey) {
    enqueueRenameLinkPropagation(fromKey, toKey)
  }
}

export function notifyKnowledgeDocumentRemove(path: AbsoluteDocPath): void {
  onKnowledgeDocumentRemoved(path)
}

export type WikiNavigationHooks = {
  beforeNavigate?: () => void
  afterNavigate?: () => void
}

export function navigateWikiLink(
  target: WikiLinkTarget,
  openPath: (absolutePath: string) => void,
  hooks?: WikiNavigationHooks,
): boolean {
  hooks?.beforeNavigate?.()
  const entry = navigateToWikiLink(target)
  if (!entry?.absolutePath) return false
  openPath(entry.absolutePath)
  hooks?.afterNavigate?.()
  return true
}

/** workspace restore: Prioritize Luna snapshot tabs; no longer roll back Knowledge sessions when openTabs (containing []) are explicitly passed in*/
export function getWorkspaceRestorePlan(
  treeHas: (path: string) => boolean,
  lunaOpenTabs?: readonly string[] | null,
): {
  tabPaths: string[]
  activePath: string | null
} {
  if (lunaOpenTabs !== undefined && lunaOpenTabs !== null) {
    const lunaTabs = lunaOpenTabs.filter(treeHas)
    return {
      tabPaths: lunaTabs,
      activePath: lunaTabs[lunaTabs.length - 1] ?? null,
    }
  }
  const tabPaths = restoreKnowledgeTabsFromRuntime().filter(treeHas)
  const active = restoreKnowledgeActivePath()
  const activePath = active && treeHas(active) ? active : tabPaths[0] ?? null
  return { tabPaths, activePath }
}

export function openSearchHit(hit: SearchHit, openPath: (absolutePath: string) => void): void {
  if (hit.absolutePath) openPath(hit.absolutePath)
}

export function persistKnowledgeWorkspace(rootDir: string): void {
  if (!rootDir.trim()) return
  persistKnowledgeUILayout(vaultIdFromRoot(rootDir))
}

export function restoreKnowledgeTabsFromRuntime(): string[] {
  const snap = getKnowledgeWorkspaceSnapshot()
  return snap.tabs.map((t) => t.absolutePath).filter(Boolean)
}

export function restoreKnowledgeActivePath(): string | null {
  const snap = getKnowledgeWorkspaceSnapshot()
  const active = snap.tabs.find((t) => t.active)
  return active?.absolutePath ?? null
}
