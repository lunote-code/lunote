import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { removeDocumentReferences } from '../../assets/assetReferenceTracker'
import {
  ancestorDirPathsForFile,
  filterOutPath,
  filterPathsOutsideDirectory,
  isPathInsideDirectory,
  isPathUnderWorkspace,
  parentDirectoryOfFile,
  pathsEqual,
  remapPathAfterDirectoryRename,
  replacePathInList,
} from '../../lib/workspacePathUtils'
import {
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
  isValidBulkMoveDest,
  isValidMoveDest,
  resolveWorkspacePath,
} from '../workspace/workspaceDrag'
import {
  createNote,
  deleteNote,
  moveNote,
  renameNote,
} from '../../platform/tauri/documentService'
import { resolveNewNoteContent } from '../../templates/templateService'
import { revealInExplorer } from '../../platform/tauri/platformShellService'
import {
  createWorkspaceFolder,
  listWorkspaceTree,
} from '../../platform/tauri/workspaceService'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import { readWorkspaceConfig } from '../../workspace/workspaceConfig'
import { INITIAL_NOTE_MD } from '../workspace/constants'

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
  setDraggingWorkspaceFile: Dispatch<SetStateAction<string[] | null>>
  setDragOverTarget: Dispatch<SetStateAction<import('../workspace/workspaceDrag').WorkspaceDragTarget | null>>
  dispatchOpenDocument: (root: string, path: string, reason?: string) => Promise<void>
  refreshFileTree: () => Promise<void>
  confirmDeleteFile: (options: { title: string; message: string; fileLabel: string }) => Promise<boolean>
  resetModeSwitchEditorBootstrap: () => void
  setStatus: (msg: string) => void
  clearWorkspaceFileSelectionRef: MutableRefObject<(() => void) | null>
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
    clearWorkspaceFileSelectionRef,
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
  }, [
    setEditorDocMenu,
    setFileContextMenu,
    setRenameDialog,
    setRenameError,
    setRenameInputValue,
    setRenameSubmitting,
  ])

  const openNewFolderDialog = useCallback((root: string, parentPath: string) => {
          setFileContextMenu(null)
          setEditorDocMenu(null)
          setRenameError('')
          setRenameSubmitting(false)
          setRenameInputValue(t('app.defaults.newFolderName'))
          setRenameDialog({ root, oldPath: '', isDirectory: true, mode: 'newFolder', parentPath })
  }, [
    t,
    setEditorDocMenu,
    setFileContextMenu,
    setRenameDialog,
    setRenameError,
    setRenameInputValue,
    setRenameSubmitting,
  ])

  const openNewNoteDialog = useCallback(
(root: string, parentPath: string, openInTab = false, templatePath?: string) => {
        setFileContextMenu(null)
        setEditorDocMenu(null)
        setRenameError('')
        setRenameSubmitting(false)
        setRenameInputValue('')
        setRenameDialog({
          root,
          oldPath: '',
          isDirectory: false,
          mode: templatePath?.trim() ? 'newNoteFromTemplate' : 'newNote',
          parentPath,
          openInTab,
          templatePath: templatePath?.trim() || undefined,
        })
  }, [
    setEditorDocMenu,
    setFileContextMenu,
    setRenameDialog,
    setRenameError,
    setRenameInputValue,
    setRenameSubmitting,
  ])

  const openNewNoteFromTemplateDialog = useCallback(
    async (root: string, parentPath: string, openInTab = false) => {
      let templatePath = 'Templates/Default.md'
      try {
        const config = await readWorkspaceConfig(root)
        templatePath = config.templates?.defaultNewNote ?? templatePath
      } catch {
        /* use fallback */
      }
      openNewNoteDialog(root, parentPath, openInTab, templatePath)
    },
    [openNewNoteDialog],
  )

  const submitRename = useCallback(async () => {
        if (!renameDialog) return
        const { root, oldPath, isDirectory, mode, parentPath } = renameDialog
        const rawName = renameInputValue.trim()
        if (mode === 'newNote' || mode === 'newNoteFromTemplate') {
          if (mode === 'newNoteFromTemplate' && !renameDialog.templatePath?.trim()) {
            setRenameError(t('app.dialog.noteTemplateRequired'))
            return
          }
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
            const content = await resolveNewNoteContent(root, {
              stem,
              parentPath: parentPath || root,
              templatePath: renameDialog.templatePath,
            })
            const newPath = await createNote({
              root,
              parentPath: parentPath || root,
              stem,
              content,
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
        if (isDirectory && pathsEqual(oldPath, root)) {
          setRenameError(t('app.confirm.cannotDeleteWorkspaceRoot'))
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
          if (isDirectory && pathsEqual(firstOldPath, root)) {
            setRenameError(t('app.confirm.cannotDeleteWorkspaceRoot'))
            return
          }
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

          const remapUnderDir = (p: string) => remapPathAfterDirectoryRename(p, appliedOldPath, newPath)

          if (isDirectory) {
            for (const tabPath of openedTabs) {
              if (!isPathInsideDirectory(tabPath, appliedOldPath)) continue
              const remapped = remapUnderDir(tabPath)
              renameTabBodyPath(tabPath, remapped)
              syncKnowledgeVaultFilePathChange(root, tabPath, remapped)
            }
          } else {
            renameTabBodyPath(appliedOldPath, newPath)
            if (!pathsEqual(oldPath, appliedOldPath)) renameTabBodyPath(oldPath, newPath)
            syncKnowledgeVaultFilePathChange(root, appliedOldPath, newPath)
          }

          const nextTabs = isDirectory
            ? openedTabs.map((tabPath) =>
                isPathInsideDirectory(tabPath, appliedOldPath) ? remapUnderDir(tabPath) : tabPath,
              )
            : replacePathInList(replacePathInList(openedTabs, oldPath, newPath), appliedOldPath, newPath)

          const nextActive = isDirectory
            ? activePath && isPathInsideDirectory(activePath, appliedOldPath)
              ? remapUnderDir(activePath)
              : activePath
            : pathsEqual(activePath, oldPath) || pathsEqual(activePath, appliedOldPath)
              ? newPath
              : activePath

          setRecentFiles((prev) => {
            const next = (
              isDirectory
                ? prev.map((p) => (isPathInsideDirectory(p, appliedOldPath) ? remapUnderDir(p) : p))
                : [newPath, ...filterOutPath(filterOutPath(filterOutPath(prev, appliedOldPath), oldPath), newPath)]
            ).slice(0, 8)
            localStorage.setItem('recentFiles', JSON.stringify(next))
            return next
          })

          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: nextTabs,
            activePath: nextActive,
            source: 'rename',
          })

          if (isDirectory) {
            setExpandedDirs((prev) => {
              const next = new Set<string>()
              for (const dir of prev) {
                if (pathsEqual(dir, appliedOldPath) || isPathInsideDirectory(dir, appliedOldPath)) {
                  next.add(remapUnderDir(dir))
                } else {
                  next.add(dir)
                }
              }
              next.add(newPath)
              return next
            })
          }

          await refreshFileTree()
          await refreshWorkspaceIndex(root)

          if (!isDirectory) {
            if (pathsEqual(activePath, oldPath) || pathsEqual(activePath, appliedOldPath)) {
              await dispatchOpenDocument(root, newPath)
            }
          } else if (nextActive && activePath && !pathsEqual(activePath, nextActive)) {
            await dispatchOpenDocument(root, nextActive)
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
    setRenameDialog,
    setRenameError,
    setRenameSubmitting,
    setStatus,
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
                  await dispatchOpenDocument(rootDir, path, 'file-context-open')
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
                case 'newFileFromTemplate': {
                  openNewNoteFromTemplateDialog(rootDir, parentForNewChildren())
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
                  if (isDirectory && pathsEqual(path, rootDir)) {
                    setStatus(t('app.confirm.cannotDeleteWorkspaceRoot'))
                    return
                  }

                  const bulkPaths = ctx.bulkDeletePaths?.filter((p) => p.trim().length > 0) ?? []
                  if (!isDirectory && bulkPaths.length > 1) {
                    const confirmed = await confirmDeleteFile({
                      title: t('ctx.file.delete'),
                      message: t('app.confirm.deleteMultiple', { count: bulkPaths.length }),
                      fileLabel: t('app.confirm.deleteMultipleLabel', { count: bulkPaths.length }),
                    })
                    if (!confirmed) return

                    for (const filePath of bulkPaths) {
                      removeDocumentReferences(filePath)
                      await deleteNote(rootDir, filePath)
                      await dispatchDocumentCommand({
                        type: 'CLOSE_TAB',
                        path: filePath,
                        source: 'file-context-delete-bulk',
                      })
                    }
                    setRecentFiles((prev) => {
                      let next = prev
                      for (const filePath of bulkPaths) {
                        next = filterOutPath(next, filePath)
                      }
                      next = next.slice(0, 8)
                      localStorage.setItem('recentFiles', JSON.stringify(next))
                      return next
                    })
                    const tree = await listWorkspaceTree(rootDir)
                    setFileTree(tree)
                    const activeWasDeleted = bulkPaths.some((p) => pathsEqual(activePath, p))
                    if (activeWasDeleted) {
                      const next = firstMarkdownInTree(tree)
                      if (next) {
                        setExpandedDirs((prev) => {
                          const expanded = new Set(prev)
                          for (const dir of ancestorDirPathsForFile(rootDir, next)) expanded.add(dir)
                          return expanded
                        })
                        await dispatchOpenDocument(rootDir, next)
                      } else {
                        resetModeSwitchEditorBootstrap()
                        await dispatchDocumentCommand({
                          type: 'REPLACE_ACTIVE_DOCUMENT',
                          path: '',
                          content: INITIAL_NOTE_MD,
                          source: 'file-context-delete-bulk',
                        })
                      }
                    }
                    await refreshWorkspaceIndex(rootDir)
                    clearWorkspaceFileSelectionRef.current?.()
                    setStatus(t('app.menu.deletedMultiple', { count: bulkPaths.length }))
                    return
                  }

                  const entryLabel =
                    path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ||
                    (isDirectory ? path : noteFileStem(path)) ||
                    path
                  const confirmed = await confirmDeleteFile({
                    title: isDirectory ? t('ctx.file.deleteFolder') : t('ctx.file.delete'),
                    message: isDirectory ? t('app.confirm.deleteFolder') : t('app.confirm.deleteEntry'),
                    fileLabel: entryLabel,
                  })
                  if (!confirmed) return

                  if (isDirectory) {
                    const tabsToClose = openedTabs.filter((tabPath) => isPathInsideDirectory(tabPath, path))
                    for (const tabPath of tabsToClose) {
                      removeDocumentReferences(tabPath)
                      await dispatchDocumentCommand({
                        type: 'CLOSE_TAB',
                        path: tabPath,
                        source: 'file-context-delete-folder',
                      })
                    }
                    await deleteNote(rootDir, path)
                    setRecentFiles((prev) => {
                      const next = filterPathsOutsideDirectory(prev, path).slice(0, 8)
                      localStorage.setItem('recentFiles', JSON.stringify(next))
                      return next
                    })
                    const tree = await listWorkspaceTree(rootDir)
                    setFileTree(tree)
                    if (isPathInsideDirectory(activePath, path)) {
                      const next = firstMarkdownInTree(tree)
                      if (next) {
                        setExpandedDirs((prev) => {
                          const expanded = new Set(prev)
                          for (const dir of ancestorDirPathsForFile(rootDir, next)) expanded.add(dir)
                          return expanded
                        })
                        await dispatchOpenDocument(rootDir, next)
                      }
                      else {
                        resetModeSwitchEditorBootstrap()
                        await dispatchDocumentCommand({
                          type: 'REPLACE_ACTIVE_DOCUMENT',
                          path: '',
                          content: INITIAL_NOTE_MD,
                          source: 'file-context-delete-folder',
                        })
                      }
                    }
                    await refreshWorkspaceIndex(rootDir)
                    setStatus(t('app.menu.folderDeleted'))
                    return
                  }

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
                  if (pathsEqual(activePath, path)) {
                    const next = firstMarkdownInTree(tree)
                    if (next) {
                      setExpandedDirs((prev) => {
                        const expanded = new Set(prev)
                        for (const dir of ancestorDirPathsForFile(rootDir, next)) expanded.add(dir)
                        return expanded
                      })
                      await dispatchOpenDocument(rootDir, next)
                    }
                    else {
                      resetModeSwitchEditorBootstrap()
                      await dispatchDocumentCommand({
                        type: 'REPLACE_ACTIVE_DOCUMENT',
                        path: '',
                        content: INITIAL_NOTE_MD,
                        source: 'file-context-delete',
                      })
                    }
                  }
                  await refreshWorkspaceIndex(rootDir)
                  clearWorkspaceFileSelectionRef.current?.()
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
      openedTabs,
      dispatchOpenDocument,
      setRecentFiles,
      setFileTree,
      setExpandedDirs,
      openRenameDialog,
      openNewFolderDialog,
      openNewNoteDialog,
      openNewNoteFromTemplateDialog,
      confirmDeleteFile,
      resetModeSwitchEditorBootstrap,
      setFileContextMenu,
      setStatus,
      t,
    ],
  )

  const handleMoveFileToFolder = useCallback(
    async (sourcePath: string | string[], destDir: string, isDirectory = false) => {
          if (!rootDir) return
          const resolvedDest = resolveWorkspacePath(rootDir, destDir)

          if (Array.isArray(sourcePath)) {
            const resolvedSources = sourcePath.map((p) => resolveWorkspacePath(rootDir, p))
            if (!isValidBulkMoveDest(resolvedSources, resolvedDest)) {
              setDraggingWorkspaceFile(null)
              setDragOverTarget(null)
              return
            }
            const pathMap = new Map<string, string>()
            try {
              for (const resolvedSource of resolvedSources) {
                if (!isValidMoveDest(resolvedSource, resolvedDest)) continue
                const newPath = await moveNote({
                  root: rootDir,
                  oldPath: resolvedSource,
                  destDir: resolvedDest,
                })
                pathMap.set(resolvedSource, newPath)
              }
              if (pathMap.size === 0) return
              let nextTabs = openedTabs
              let nextActive = activePath
              for (const [oldPath, newPath] of pathMap) {
                nextTabs = replacePathInList(nextTabs, oldPath, newPath)
                renameTabBodyPath(oldPath, newPath)
                syncKnowledgeVaultFilePathChange(rootDir, oldPath, newPath)
                if (pathsEqual(nextActive, oldPath)) nextActive = newPath
              }
              setRecentFiles((prev) => {
                let next = prev
                for (const [oldPath, newPath] of pathMap) {
                  next = [newPath, ...filterOutPath(filterOutPath(next, oldPath), newPath)]
                }
                next = next.slice(0, 8)
                localStorage.setItem('recentFiles', JSON.stringify(next))
                return next
              })
              await dispatchDocumentCommand({
                type: 'SET_TABS',
                tabs: nextTabs,
                activePath: nextActive,
                source: 'move-files-bulk',
              })
              await refreshFileTree()
              await refreshWorkspaceIndex(rootDir)
              setExpandedDirs((prev) => {
                const next = new Set(prev)
                next.add(resolvedDest)
                return next
              })
              if (nextActive && activePath && !pathsEqual(activePath, nextActive)) {
                await dispatchOpenDocument(rootDir, nextActive)
              }
              clearWorkspaceFileSelectionRef.current?.()
              setStatus(
                pathMap.size === 1
                  ? t('app.status.moved')
                  : t('app.status.movedMultiple', { count: pathMap.size }),
              )
            } catch (e) {
              setStatus(t('app.status.operationFailed', { message: e instanceof Error ? e.message : String(e) }))
            } finally {
              setDraggingWorkspaceFile(null)
              setDragOverTarget(null)
            }
            return
          }

          const resolvedSource = resolveWorkspacePath(rootDir, sourcePath)
          if (!isValidMoveDest(resolvedSource, resolvedDest)) {
            setDraggingWorkspaceFile(null)
            setDragOverTarget(null)
            return
          }
          try {
            const newPath = await moveNote({
              root: rootDir,
              oldPath: resolvedSource,
              destDir: resolvedDest,
            })
            const remapUnderDir = (p: string) => remapPathAfterDirectoryRename(p, resolvedSource, newPath)

            if (isDirectory) {
              for (const tabPath of openedTabs) {
                if (!isPathInsideDirectory(tabPath, resolvedSource)) continue
                const remapped = remapUnderDir(tabPath)
                renameTabBodyPath(tabPath, remapped)
                syncKnowledgeVaultFilePathChange(rootDir, tabPath, remapped)
              }
            } else {
              setRecentFiles((prev) => {
                const next = [newPath, ...filterOutPath(filterOutPath(prev, resolvedSource), newPath)].slice(0, 8)
                localStorage.setItem('recentFiles', JSON.stringify(next))
                return next
              })
              await dispatchDocumentCommand({
                type: 'SET_TABS',
                tabs: replacePathInList(openedTabs, resolvedSource, newPath),
                activePath: pathsEqual(activePath, resolvedSource) ? newPath : activePath,
                source: 'move-file',
              })
              renameTabBodyPath(resolvedSource, newPath)
              syncKnowledgeVaultFilePathChange(rootDir, resolvedSource, newPath)
              await refreshFileTree()
              await refreshWorkspaceIndex(rootDir)
              setExpandedDirs((prev) => {
                const next = new Set(prev)
                next.add(resolvedDest)
                return next
              })
              if (pathsEqual(activePath, resolvedSource)) await dispatchOpenDocument(rootDir, newPath)
              setDraggingWorkspaceFile(null)
              setDragOverTarget(null)
              setStatus(t('app.status.moved'))
              return
            }

            const nextTabs = openedTabs.map((tabPath) =>
              isPathInsideDirectory(tabPath, resolvedSource) ? remapUnderDir(tabPath) : tabPath,
            )
            const nextActive =
              activePath && isPathInsideDirectory(activePath, resolvedSource)
                ? remapUnderDir(activePath)
                : activePath

            setRecentFiles((prev) => {
              const next = prev
                .map((p) => (isPathInsideDirectory(p, resolvedSource) ? remapUnderDir(p) : p))
                .slice(0, 8)
              localStorage.setItem('recentFiles', JSON.stringify(next))
              return next
            })
            await dispatchDocumentCommand({
              type: 'SET_TABS',
              tabs: nextTabs,
              activePath: nextActive,
              source: 'move-folder',
            })
            setExpandedDirs((prev) => {
              const next = new Set<string>()
              for (const dir of prev) {
                if (pathsEqual(dir, resolvedSource) || isPathInsideDirectory(dir, resolvedSource)) {
                  next.add(remapUnderDir(dir))
                } else {
                  next.add(dir)
                }
              }
              next.add(newPath)
              next.add(resolvedDest)
              return next
            })
            await refreshFileTree()
            await refreshWorkspaceIndex(rootDir)
            if (nextActive && activePath && !pathsEqual(activePath, nextActive)) {
              await dispatchOpenDocument(rootDir, nextActive)
            }
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
      setExpandedDirs,
      setDraggingWorkspaceFile,
      setDragOverTarget,
      t,
    ],
  )

  return {
    openRenameDialog,
    openNewFolderDialog,
    openNewNoteDialog,
    openNewNoteFromTemplateDialog,
    submitRename,
    handleFileContextPick,
    handleMoveFileToFolder,
  }
}
