import type { Dispatch, SetStateAction } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { isHiddenAssetFolderName, isPathUnderWorkspace, pathsEqual } from '../../lib/workspacePathUtils'
import {
  importDroppedFilesIntoWorkspace,
  importExternalPathsIntoWorkspace,
  workspacePathIsDirectory,
} from '../../platform/tauri/workspaceImportService'
import { refreshWorkspaceIndex } from './workspaceIndexCoordinator'
import type { WorkspaceDragTarget } from './workspaceDrag'
import { resolveWorkspaceSidebarDropTarget } from './workspaceSidebarDropTarget'

const MD_OPEN_RE = /\.(md|markdown)$/iu

export type WorkspaceOsVaultImportDeps = {
  t: TranslateFn
  rootDir: string
  setStatus: (msg: string) => void
  setDragOverTarget: Dispatch<SetStateAction<WorkspaceDragTarget | null>>
  setExpandedDirs: Dispatch<SetStateAction<Set<string>>>
  refreshFileTree: () => Promise<void>
  handleMoveFileToFolder: (sourcePath: string | string[], destDir: string, isDirectory?: boolean) => Promise<void>
  dispatchOpenDocument?: (root: string, path: string, reason?: string) => Promise<void>
}

function folderLabelFromPath(destDir: string, rootDir: string): string {
  const normRoot = rootDir.replace(/[/\\]+$/u, '')
  if (pathsEqual(destDir, normRoot)) return ''
  const parts = destDir.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

function reportVaultImportStatus(
  t: TranslateFn,
  setStatus: (msg: string) => void,
  result: { fileCount: number; folderCount: number; movedCount: number },
  folderLabel: string,
): void {
  const total = result.fileCount + result.folderCount + result.movedCount
  if (total === 0) return
  if (result.movedCount > 0 && result.fileCount === 0 && result.folderCount === 0) {
    setStatus(t('app.drop.movedInVault', { count: result.movedCount }))
    return
  }
  if (folderLabel) {
    setStatus(t('app.drop.copiedToVaultFolder', { count: total, folder: folderLabel }))
  } else {
    setStatus(t('app.drop.copiedToVault', { count: total }))
  }
}

async function openFirstImportedMarkdown(
  rootDir: string,
  paths: string[],
  dispatchOpenDocument?: (root: string, path: string, reason?: string) => Promise<void>,
): Promise<void> {
  if (!dispatchOpenDocument) return
  const firstMd = paths.find((p) => MD_OPEN_RE.test(p))
  if (firstMd) await dispatchOpenDocument(rootDir, firstMd, 'vault-import')
}

export async function importOsEntriesIntoVaultFolder(
  deps: WorkspaceOsVaultImportDeps,
  destDir: string,
  options: { paths?: string[]; files?: File[] },
): Promise<void> {
  const {
    t,
    rootDir,
    setStatus,
    setExpandedDirs,
    refreshFileTree,
    handleMoveFileToFolder,
    dispatchOpenDocument,
  } = deps

  if (!rootDir.trim()) {
    setStatus(t('app.drop.needWorkspace'))
    return
  }

  const destName = destDir.replace(/[/\\]+$/u, '').split(/[/\\]/u).pop() ?? ''
  if (isHiddenAssetFolderName(destName)) {
    setStatus(t('app.drop.noAssetFolder'))
    return
  }

  const paths = options.paths ?? []
  const files = options.files ?? []
  if (paths.length === 0 && files.length === 0) return

  const inVault: string[] = []
  const external: string[] = []
  for (const p of paths) {
    if (isPathUnderWorkspace(rootDir, p)) inVault.push(p)
    else external.push(p)
  }

  let movedCount = 0
  for (const src of inVault) {
    try {
      const isDirectory = await workspacePathIsDirectory(rootDir, src)
      await handleMoveFileToFolder(src, destDir, isDirectory)
      movedCount += 1
    } catch {
      /* handleMoveFileToFolder reports status */
    }
  }

  let importedPaths: string[] = []
  let fileCount = 0
  let folderCount = 0

  try {
    if (external.length > 0 && isTauri()) {
      const result = await importExternalPathsIntoWorkspace(rootDir, destDir, external)
      importedPaths = result.importedPaths
      fileCount = result.fileCount
      folderCount = result.folderCount
    }
    if (files.length > 0) {
      if (!isTauri()) {
        setStatus(t('app.drop.desktopOnly'))
        return
      }
      const fromFiles = await importDroppedFilesIntoWorkspace(rootDir, destDir, files)
      importedPaths = [...importedPaths, ...fromFiles]
      fileCount += fromFiles.length
    }
  } catch (e) {
    setStatus(t('app.status.operationFailed', { message: e instanceof Error ? e.message : String(e) }))
    return
  }

  if (importedPaths.length > 0 || movedCount > 0) {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      next.add(destDir.replace(/[/\\]+$/u, ''))
      return next
    })
    await refreshFileTree()
    await refreshWorkspaceIndex(rootDir)
    await openFirstImportedMarkdown(rootDir, importedPaths, dispatchOpenDocument)
  }

  reportVaultImportStatus(
    t,
    setStatus,
    { fileCount, folderCount, movedCount },
    folderLabelFromPath(destDir, rootDir),
  )
}

export function resolveSidebarImportDest(
  clientX: number,
  clientY: number,
  rootDir: string,
): string | null {
  const target = resolveWorkspaceSidebarDropTarget(clientX, clientY, rootDir)
  return target?.destDir ?? null
}
