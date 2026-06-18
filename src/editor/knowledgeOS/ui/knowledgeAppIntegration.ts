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
import {
  clearDocumentFrontmatter,
  migrateDocumentFrontmatterPath,
  syncDocumentFrontmatterFromMarkdown,
} from '../../documentFrontmatterStore'
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
  syncDocumentFrontmatterFromMarkdown(path, content)
  parseChangedDocument(path, content, rootDir)
  openNoteInWorkspace(path, absolutePathToDocKeyOs(path, rootDir))
}

export function notifyKnowledgeDocumentSave(path: AbsoluteDocPath, content: string): void {
  syncDocumentFrontmatterFromMarkdown(path, content)
  onKnowledgeDocumentSaved(path, content)
}

export function notifyKnowledgeDocumentRename(fromPath: AbsoluteDocPath, toPath: AbsoluteDocPath): void {
  migrateDocumentFrontmatterPath(fromPath, toPath)
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
  clearDocumentFrontmatter(path)
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

/** workspace restore: Luna snapshot tabs are the sole source of open tab paths */
export function getWorkspaceRestorePlan(
  treeHas: (path: string) => boolean,
  lunaOpenTabs: readonly string[],
): {
  tabPaths: string[]
  activePath: string | null
} {
  const lunaTabs = lunaOpenTabs.filter(treeHas)
  return {
    tabPaths: lunaTabs,
    activePath: lunaTabs[lunaTabs.length - 1] ?? null,
  }
}

export function openSearchHit(hit: SearchHit, openPath: (absolutePath: string) => void): void {
  if (hit.absolutePath) openPath(hit.absolutePath)
}

export function persistKnowledgeWorkspace(rootDir: string): void {
  if (!rootDir.trim()) return
  persistKnowledgeUILayout(vaultIdFromRoot(rootDir))
}

