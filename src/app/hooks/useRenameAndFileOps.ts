import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { removeDocumentReferences } from '../../assets/assetReferenceTracker'
import {
  filterOutPath,
  isPathUnderWorkspace,
  normPath,
  parentDirectoryOfFile,
  pathCompareKey,
  pathsEqual,
  replacePathInList,
} from '../../lib/workspacePathUtils'
import {
  collectDirPaths,
  firstMarkdownInTree,
  normalizeNewNoteStemInput,
  noteFileStem,
} from '../workspace/workspaceTree'
import type { FsTreeNode } from '../workspace/types'
import type { RenameDialogState } from '../workspace/types'
import { renameTabBodyPath } from '../document/tabBodiesStore'
import { syncKnowledgeVaultFilePathChange } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import type {
  EditorDocMenuState,
  FileContextMenuPick,
  FileContextMenuState,
  FileContextTarget,
} from '../workspace/contextMenuTypes'
import {
  isValidMoveDest,
  resolveWorkspacePath,
} from '../workspace/workspaceDrag'
import {
  createNote,
  deleteNote,
  moveNote,
  renameNote,
} from '../../platform/tauri/documentService'
import { revealInExplorer } from '../../platform/tauri/platformShellService'
import {
  createWorkspaceFolder,
  listWorkspaceTree,
} from '../../platform/tauri/workspaceService'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'

export type RenameAndFileOpsDeps = {
  t: TranslateFn
  rootDir: string
  activePath: string
  openedTabs: string[]
  renameDialog: RenameDialogState | null
  renameInputValue: string
  setRenameDialog: Dispatch<SetStateAction<RenameDialogState | null>>
  setRenameInputValue: Dispatch<SetStateAction<string>>
  setRenameError: Dispatch<SetStateAction<string>>
  setRenameSubmitting: Dispatch<SetStateAction<boolean>>
  setFileContextMenu: Dispatch<SetStateAction<FileContextMenuState | null>>
  setEditorDocMenu: Dispatch<SetStateAction<EditorDocMenuState | null>>
  setRecentFiles: Dispatch<SetStateAction<string[]>>
  setFileTree: Dispatch<SetStateAction<FsTreeNode[]>>
  setExpandedDirs: Dispatch<SetStateAction<Set<string>>>
  setDraggingWorkspaceFile: Dispatch<SetStateAction<string | null>>
  setDragOverTarget: Dispatch<SetStateAction<import('../workspace/workspaceDrag').WorkspaceDragTarget | null>>
  dispatchOpenDocument: (root: string, path: string) => Promise<void>
  refreshFileTree: () => Promise<void>
  confirmDeleteFile: (options: { title: string; message: string; fileLabel: string }) => Promise<boolean>
  resetModeSwitchEditorBootstrap: () => void
  setStatus: (msg: string) => void
}

export function useRenameAndFileOps(deps: RenameAndFileOpsDeps) {
  const {
    t,
    rootDir,
    activePath,
    openedTabs,
    renameDialog,
    renameInputValue,
    setRenameDialog,
    setRenameInputValue,
    setRenameError,
    setRenameSubmitting,
    setFileContextMenu,
    setEditorDocMenu,
    setRecentFiles,
    setFileTree,
    setExpandedDirs,
    setDraggingWorkspaceFile,
    setDragOverTarget,
    dispatchOpenDocument,
    refreshFileTree,
    confirmDeleteFile,
    resetModeSwitchEditorBootstrap,
    setStatus,
  } = deps

  const openRenameDialog = useCallback(
(root: string, oldPath: string, isDirectory: boolean) => {
        const oldName = oldPath.replace(/\\/g, '/').split('/').pop() ?? ''
        setFileContextMenu(null)
        setEditorDocMenu(null)
        setRenameError('')
        setRenameSubmitting(false)
        setRenameInputValue(oldName)
        setRenameDialog({ root, oldPath, isDirectory, mode: 'rename', parentPath: '' })
  }, [])

  const openNewFolderDialog = useCallback((root: string, parentPath: string) => {
          setFileContextMenu(null)
          setEditorDocMenu(null)
          setRenameError('')
          setRenameSubmitting(false)
          setRenameInputValue(t('app.defaults.newFolderName'))
          setRenameDialog({ root, oldPath: '', isDirectory: true, mode: 'newFolder', parentPath })
  }, [t])

  const openNewNoteDialog = useCallback(
(root: string, parentPath: string, openInTab = false) => {
        setFileContextMenu(null)
        setEditorDocMenu(null)
        setRenameError('')
        setRenameSubmitting(false)
        setRenameInputValue('')
        setRenameDialog({ root, oldPath: '', isDirectory: false, mode: 'newNote', parentPath, openInTab })
  }, [])

  const submitRename = useCallback(async () => {
        if (!renameDialog) return
        const { root, oldPath, isDirectory, mode, parentPath } = renameDialog
        const rawName = renameInputValue.trim()
        if (mode === 'newNote') {
          const defaultStem = t('app.defaults.newNoteStem')
          const stem = normalizeNewNoteStemInput(renameInputValue, defaultStem)
          if (/[/\\]/.test(stem) || stem === '.' || stem === '..') {
            setRenameError(t('app.rename.invalidName'))
            return
          }
          const { openInTab } = renameDialog
          setRenameSubmitting(true)
          setRenameError('')
          try {
            const newPath = await createNote({
              root,
              parentPath: parentPath || root,
              stem,
            })
            await refreshFileTree()
            await refreshWorkspaceIndex(root)
            if (openInTab) {
              await dispatchDocumentCommand({
                type: 'OPEN_DOCUMENT_IN_TAB',
                root,
                path: newPath,
                source: 'new-note-dialog',
              })
            } else {
              await dispatchOpenDocument(root, newPath)
            }
            setExpandedDirs((prev) => {
              const next = new Set(prev)
              next.add(parentPath || root)
              return next
            })
            setStatus(t('app.menu.noteCreated'))
            setRenameDialog(null)
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setRenameError(msg)
            setStatus(t('app.menu.noteCreateFailed', { message: msg }))
          } finally {
            setRenameSubmitting(false)
          }
          return
        }
        const newName = rawName
        if (!newName) {
          setRenameError(t('app.rename.empty'))
          return
        }
        if (mode === 'newFolder') {
          setRenameSubmitting(true)
          setRenameError('')
          try {
            const newDirPath = await createWorkspaceFolder(root, parentPath, newName)
            await refreshFileTree()
            await refreshWorkspaceIndex(root)
            setExpandedDirs((prev) => {
              const next = new Set(prev)
              next.add(parentPath)
              next.add(newDirPath)
              return next
            })
            setStatus(t('app.menu.folderCreated'))
            setRenameDialog(null)
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setRenameError(msg)
            setStatus(t('app.status.operationFailed', { message: msg }))
          } finally {
            setRenameSubmitting(false)
          }
          return
        }
        const oldName = oldPath.replace(/\\/g, '/').split('/').pop() ?? ''
        if (newName === oldName) {
          setRenameError(t('app.rename.unchanged'))
          return
        }
        setRenameSubmitting(true)
        setRenameError('')
        try {
          const resolveOldPath = (baseRoot: string, p: string): string => {
            if (/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(p)) return p
            const base = baseRoot.replace(/[/\\]+$/u, '')
            const rel = p.replace(/^[/\\]+/u, '')
            return `${base}/${rel}`.replace(/\/+/g, '/')
          }
          const tryRename = async (oldPathCandidate: string): Promise<string> =>
            renameNote({ root, oldPath: oldPathCandidate, newName })
    
          const firstOldPath = resolveOldPath(root, oldPath)
          let appliedOldPath = firstOldPath
          let newPath: string
          try {
            newPath = await tryRename(firstOldPath)
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            const canRetryWithActive =
              !isDirectory &&
              (msg.includes('Unable to resolve path') || msg.includes('Invalid path')) &&
              activePath &&
              isPathUnderWorkspace(root, activePath) &&
              !pathsEqual(activePath, firstOldPath)
            if (!canRetryWithActive) throw e
            appliedOldPath = activePath
            newPath = await tryRename(activePath)
          }
          setRecentFiles((prev) => {
            const next = [newPath, ...filterOutPath(filterOutPath(filterOutPath(prev, appliedOldPath), oldPath), newPath)].slice(0, 8)
            localStorage.setItem('recentFiles', JSON.stringify(next))
            return next
          })
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: replacePathInList(replacePathInList(openedTabs, oldPath, newPath), appliedOldPath, newPath),
            activePath:
              pathsEqual(activePath, oldPath) || pathsEqual(activePath, appliedOldPath) ? newPath : activePath,
            source: 'rename',
          })
          if (!isDirectory) {
            renameTabBodyPath(appliedOldPath, newPath)
            if (!pathsEqual(oldPath, appliedOldPath)) renameTabBodyPath(oldPath, newPath)
            syncKnowledgeVaultFilePathChange(root, appliedOldPath, newPath)
          }
          await refreshFileTree()
          await refreshWorkspaceIndex(root)
          if (!isDirectory) {
            if (pathsEqual(activePath, oldPath) || pathsEqual(activePath, appliedOldPath)) {
              await dispatchOpenDocument(root, newPath)
            }
          } else {
            const oldDirKey = pathCompareKey(appliedOldPath).replace(/\/+$/u, '')
            const activeKey = pathCompareKey(activePath)
            if (activeKey.startsWith(`${oldDirKey}/`)) {
              const rel = normPath(activePath).slice(normPath(appliedOldPath).replace(/\/+$/u, '').length + 1)
              const newDir = normPath(newPath).replace(/\/+$/u, '')
              const useBs = activePath.includes('\\') && !activePath.includes('/')
              const sep = useBs ? '\\' : '/'
              const nextPath = `${newDir.replace(/\//g, sep)}${sep}${rel.replace(/\//g, sep)}`
              await dispatchOpenDocument(root, nextPath)
            }
          }
          setStatus(t('app.status.renamed'))
          setRenameDialog(null)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          setRenameError(msg)
          setStatus(t('app.status.renameFailed', { message: msg }))
        } finally {
          setRenameSubmitting(false)
        }
  }, [
    renameDialog,
    renameInputValue,
    setRecentFiles,
    refreshFileTree,
    activePath,
    openedTabs,
    dispatchOpenDocument,
    setExpandedDirs,
    t,
  ])

  const handleFileContextPick = useCallback((action: FileContextMenuPick, ctx: FileContextTarget) => {
          const { path, isDirectory, variant } = ctx
          setFileContextMenu(null)
          if (!rootDir) return
          void (async () => {
            const parentForNewChildren = (): string => {
              if (variant === 'blank') return rootDir.replace(/[/\\]+$/u, '')
              if (isDirectory) return path
              const p = parentDirectoryOfFile(path)
              const base = rootDir.replace(/[/\\]+$/u, '')
              return p.length > 0 ? p : base
            }
            try {
              switch (action) {
                case 'open':
                  if (isDirectory) return
                  await dispatchOpenDocument(rootDir, path)
                  return
                case 'openTab':
                  if (isDirectory) return
                  await dispatchDocumentCommand({
                    type: 'OPEN_DOCUMENT_IN_TAB',
                    root: rootDir,
                    path,
                    source: 'file-context',
                  })
                  return
                case 'newFile': {
                  openNewNoteDialog(rootDir, parentForNewChildren())
                  return
                }
                case 'newFolder': {
                  openNewFolderDialog(rootDir, parentForNewChildren())
                  return
                }
                case 'rename': {
                  openRenameDialog(rootDir, path, isDirectory)
                  return
                }
                case 'delete': {
                  if (isDirectory) return
                  const fileLabel = noteFileStem(path) || path.replace(/\\/g, '/').split('/').pop() || path
                  const confirmed = await confirmDeleteFile({
                    title: t('ctx.file.delete'),
                    message: t('app.confirm.deleteEntry'),
                    fileLabel,
                  })
                  if (!confirmed) return
                  removeDocumentReferences(path)
                  await deleteNote(rootDir, path)
                  await dispatchDocumentCommand({
                    type: 'CLOSE_TAB',
                    path,
                    source: 'file-context-delete',
                  })
                  setRecentFiles((prev) => {
                    const next = filterOutPath(prev, path).slice(0, 8)
                    localStorage.setItem('recentFiles', JSON.stringify(next))
                    return next
                  })
                  const tree = await listWorkspaceTree(rootDir)
                  setFileTree(tree)
                  setExpandedDirs(new Set(collectDirPaths(tree)))
                  if (pathsEqual(activePath, path)) {
                    const next = firstMarkdownInTree(tree)
                    if (next) await dispatchOpenDocument(rootDir, next)
                    else {
                      resetModeSwitchEditorBootstrap()
                      const initialContent =
                        '# New note\n\nStart writing your ideas...\n\n```ts\nconsole.log("hello markdown")\n```\n\n<!-- This comment is hidden in preview -->\n'
                      await dispatchDocumentCommand({
                        type: 'REPLACE_ACTIVE_DOCUMENT',
                        path: '',
                        content: initialContent,
                        source: 'file-context-delete',
                      })
                    }
                  }
                  await refreshWorkspaceIndex(rootDir)
                  setStatus(t('app.menu.deleted'))
                  return
                }
                case 'copyPath':
                  await navigator.clipboard.writeText(variant === 'blank' ? rootDir : path)
                  setStatus(t('app.menu.pathCopied'))
                  return
                case 'reveal': {
                  if (!isTauri()) {
                    setStatus(t('app.status.revealDesktopOnly'))
                    return
                  }
                  if (!rootDir) {
                    setStatus(t('app.menu.noSavedFileToReveal'))
                    return
                  }
                  const revealPath = variant === 'blank' ? rootDir : path
                  await revealInExplorer(revealPath, rootDir)
                  return
                }
                default:
                  return
              }
            } catch (e) {
              setStatus(t('app.status.operationFailed', { message: e instanceof Error ? e.message : String(e) }))
            }
          })()
    },
    [
      rootDir,
      activePath,
      dispatchOpenDocument,
      refreshFileTree,
      setRecentFiles,
      setFileTree,
      setExpandedDirs,
      openRenameDialog,
      openNewFolderDialog,
      openNewNoteDialog,
      confirmDeleteFile,
      resetModeSwitchEditorBootstrap,
      setStatus,
      t,
    ],
  )

  const handleMoveFileToFolder = useCallback(async (filePath: string, destDir: string) => {
          if (!rootDir) return
          const resolvedFile = resolveWorkspacePath(rootDir, filePath)
          const resolvedDest = resolveWorkspacePath(rootDir, destDir)
          if (!isValidMoveDest(resolvedFile, resolvedDest)) {
            setDraggingWorkspaceFile(null)
            setDragOverTarget(null)
            return
          }
          try {
            const newPath = await moveNote({
              root: rootDir,
              oldPath: resolvedFile,
              destDir: resolvedDest,
            })
            setRecentFiles((prev) => {
              const next = [newPath, ...filterOutPath(filterOutPath(prev, resolvedFile), newPath)].slice(0, 8)
              localStorage.setItem('recentFiles', JSON.stringify(next))
              return next
            })
            await dispatchDocumentCommand({
              type: 'SET_TABS',
              tabs: replacePathInList(openedTabs, resolvedFile, newPath),
              activePath: pathsEqual(activePath, resolvedFile) ? newPath : activePath,
              source: 'move-file',
            })
            renameTabBodyPath(resolvedFile, newPath)
            syncKnowledgeVaultFilePathChange(rootDir, resolvedFile, newPath)
            await refreshFileTree()
            await refreshWorkspaceIndex(rootDir)
            setExpandedDirs((prev) => {
              const next = new Set(prev)
              next.add(resolvedDest)
              return next
            })
            if (pathsEqual(activePath, resolvedFile)) await dispatchOpenDocument(rootDir, newPath)
            setDraggingWorkspaceFile(null)
            setDragOverTarget(null)
            setStatus(t('app.status.moved'))
          } catch (e) {
            setStatus(t('app.status.operationFailed', { message: e instanceof Error ? e.message : String(e) }))
          } finally {
            setDraggingWorkspaceFile(null)
            setDragOverTarget(null)
          }
    },
    [
      rootDir,
      activePath,
      openedTabs,
      refreshFileTree,
      dispatchOpenDocument,
      setRecentFiles,
      setStatus,
      t,
    ],
  )

  return {
    openRenameDialog,
    openNewFolderDialog,
    openNewNoteDialog,
    submitRename,
    handleFileContextPick,
    handleMoveFileToFolder,
  }
}
