import { open } from '@tauri-apps/plugin-dialog'

import type { AppMenuContext, AppMenuFileTreeNode, AppMenuUiDeps } from './menu.types'
import { exportNotePayload } from '../lib/tauriScopedInvoke'
import { ancestorDirPathsForFile, filterOutPath, isPathUnderWorkspace, parentDirectoryOfFile } from '../lib/workspacePathUtils'
import { deleteNote, exportNote } from '../platform/tauri/documentService'
import { revealInExplorer } from '../platform/tauri/platformShellService'
import { importMarkdownViaDialog, listWorkspaceTree } from '../platform/tauri/workspaceService'
import { refreshWorkspaceIndex } from '../app/workspace/workspaceIndexCoordinator'
import { isTauri } from '@tauri-apps/api/core'

type AppActionHandler = (m: AppMenuContext, ui: AppMenuUiDeps) => Promise<boolean>

const BUFFER_TAB_PREFIX = 'luna:buf:'

function isBufferTabId(path: string): boolean {
  return path.startsWith(BUFFER_TAB_PREFIX)
}

function collectDirPaths(nodes: AppMenuFileTreeNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.kind === 'dir') out.push(n.path, ...collectDirPaths(n.children))
  }
  return out
}

function firstMarkdownInTree(nodes: AppMenuFileTreeNode[]): string | null {
  for (const n of nodes) {
    if (n.kind === 'file') return n.path
    const nested = firstMarkdownInTree(n.children)
    if (nested) return nested
  }
  return null
}

const FILE_APP_ACTIONS: Record<string, AppActionHandler> = {
  'file-recent-placeholder': async (m, ui) => {
    const recentPath = m.recentFiles[0]
    if (!recentPath) {
      m.setStatus(m.t('menu.native.recentEmpty'))
      return true
    }
    let targetRoot = m.rootDir
    let loadedWorkspace = false
    if (!targetRoot || !isPathUnderWorkspace(targetRoot, recentPath)) {
      targetRoot = parentDirectoryOfFile(recentPath)
      if (!targetRoot) {
        m.setStatus(m.t('app.menu.recentDirUnavailable'))
        return true
      }
      m.setRootDir(targetRoot)
      await m.loadNotes(targetRoot, recentPath)
      loadedWorkspace = true
    }
    ui.setFocusMode(false)
    ui.setSidebarVisible(true)
    const ancestors = ancestorDirPathsForFile(targetRoot, recentPath)
    m.setExpandedDirs((prev) => {
      const next = new Set(prev)
      for (const d of ancestors) next.add(d)
      return next
    })
    if (!loadedWorkspace) {
      await m.dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: targetRoot,
        path: recentPath,
        source: 'menu-recent-placeholder',
      })
    }
    return true
  },
  'file-reveal': async (m) => {
    if (!m.activePath) {
      m.setStatus(m.t('app.menu.noSavedFileToReveal'))
      return true
    }
    if (isBufferTabId(m.activePath)) {
      m.setStatus(m.t('app.menu.unnamedTabNotOnDisk'))
      return true
    }
    await revealInExplorer(m.activePath, m.rootDir)
    return true
  },
  'file-delete': async (m, ui) => {
    if (!m.activePath) return true
    if (isBufferTabId(m.activePath)) {
      m.setStatus(m.t('app.menu.unnamedTabCloseHint'))
      return true
    }
    if (!m.rootDir) return true
    const fileLabel = m.activePath.replace(/\\/g, '/').split('/').pop() ?? m.activePath
    const confirmed = await m.confirmDeleteFile({
      title: m.t('menu.file.delete'),
      message: m.t('app.confirm.deleteFile'),
      fileLabel,
    })
    if (!confirmed) return true
    const deletedPath = m.activePath
    await deleteNote(m.rootDir, deletedPath)
    await m.dispatchDocumentCommand({
      type: 'CLOSE_TAB',
      path: deletedPath,
      source: 'menu-delete',
    })
    m.setRecentFiles((prev) => {
      const next = filterOutPath(prev, deletedPath).slice(0, 8)
      localStorage.setItem('recentFiles', JSON.stringify(next))
      return next
    })
    const tree = await listWorkspaceTree(m.rootDir)
    m.setFileTree(tree)
    m.setExpandedDirs(new Set(collectDirPaths(tree)))
    const next = firstMarkdownInTree(tree)
    if (next) {
      await m.dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: m.rootDir,
        path: next,
        source: 'menu-delete',
      })
    } else {
      await m.dispatchDocumentCommand({
        type: 'REPLACE_ACTIVE_DOCUMENT',
        path: '',
        content: ui.initialNoteContent,
        source: 'menu-delete',
      })
    }
    await refreshWorkspaceIndex(m.rootDir)
    m.setStatus(m.t('app.menu.deleted'))
    return true
  },
  'file-close': async (m, ui) => {
    if (m.activePath) ui.closeActiveTab?.(m.activePath)
    return true
  },
  'file-close-workspace': async (m) => {
    await m.closeWorkspace()
    return true
  },
  'file-save-as': async (m) => {
    void m.saveAsCurrent?.()
    return true
  },
  'file-copy-path': async (m) => {
    if (!m.activePath) {
      m.setStatus(m.t('app.menu.noPathToCopy'))
      return true
    }
    void navigator.clipboard.writeText(m.activePath).then(() => m.setStatus(m.t('app.menu.pathCopied')))
    return true
  },
  'file-rename': async (m) => {
    if (!m.rootDir || !m.activePath) return true
    m.openRenameDialog(m.rootDir, m.activePath, false)
    return true
  },
  'file-revert': async (m) => {
    if (!m.rootDir || !m.activePath) {
      m.setStatus(m.t('app.menu.noRevertTarget'))
      return true
    }
    const ok = await m.confirmAppDialog({
      title: m.t('app.confirm.title'),
      message: m.t('app.confirm.revertFile'),
      variant: 'warning',
    })
    if (!ok) return true
    await m.dispatchDocumentCommand({
      type: 'REVERT_DOCUMENT',
      root: m.rootDir,
      path: m.activePath,
      source: 'menu-revert',
    })
    m.setStatus(m.t('app.menu.revertedFromDisk'))
    return true
  },
  'file-save-all': async (m) => {
    void m.saveAllOpenTabs()
    return true
  },
  'file-import': async (m) => {
    if (!m.rootDir) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    const path = await importMarkdownViaDialog(m.rootDir)
    if (!path) return true
    await m.refreshFileTree()
    await refreshWorkspaceIndex(m.rootDir)
    await m.dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT',
      root: m.rootDir,
      path,
      source: 'menu-import',
    })
    m.setStatus(m.t('app.menu.importedToWorkspace'))
    return true
  },
  'file-export-pdf': async (m) => {
    void m.runAppExportFormat('pdf')
    return true
  },
  'file-export-html': async (m) => {
    void m.runAppExportFormat('html')
    return true
  },
  'file-export-html-plain': async (m) => {
    void m.runAppExportFormat('htmlPlain')
    return true
  },
  'file-export-image': async (m) => {
    void m.runAppExportFormat('image')
    return true
  },
  'file-export-word': async (m) => {
    void m.runAppExportFormat('word')
    return true
  },
  'file-export-markdown': async (m) => {
    if (!isTauri()) {
      m.setStatus(m.t('app.status.exportNeedDesktop'))
      return true
    }
    if (!m.activePath) {
      m.setStatus(m.t('app.status.exportNoFile'))
      return true
    }
    try {
      const defaultName =
        m.activePath.replace(/\\/g, '/').split('/').pop() ?? m.t('app.defaults.exportMarkdownBasename')
      const out = await open({
        title: m.t('app.dialog.exportAs'),
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
        multiple: false,
        directory: false,
      })
      if (!out || Array.isArray(out)) return true
      await exportNote(exportNotePayload(out, m.content, m.rootDir || ''))
      m.setStatus(m.t('app.status.exported'))
    } catch (error) {
      m.setStatus(
        m.t('app.status.exportFailed', { message: error instanceof Error ? error.message : String(error) }),
      )
    }
    return true
  },
  'file-print': async () => {
    window.print()
    return true
  },
  'open-folder': async (m) => {
    void m.chooseFolder()
    return true
  },
  save: async (m) => {
    void m.saveCurrent(true)
    return true
  },
}

export async function tryDispatchFileAppAction(
  action: string,
  m: AppMenuContext,
  ui: AppMenuUiDeps,
): Promise<boolean> {
  const handler = FILE_APP_ACTIONS[action]
  if (!handler) return false
  return handler(m, ui)
}
