import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { normalizeLineEndings } from '../../lib/normalizeLineEndings'
import { clearExternalDiskDriftInState } from '../../lib/externalDiskDriftState'
import {
  captureFileStatGeneration,
  isFileStatGenerationStale,
} from '../../lib/fileStatGeneration'
import {
  pathsEqual,
  isLikelyRemoteWorkspaceRoot,
  pathCompareKey,
  getPathKeyedRecordValue,
  setPathKeyedRecordValue,
} from '../../lib/workspacePathUtils'
import { isPathDirty } from '../../lib/documentDirty'
import { deleteTabBody, getTabBody } from '../document/tabBodiesStore'
import { promptExternalDriftConflict } from '../document/saveConflictPrompt'
import type { SaveConflictState } from '../document/saveConflictState'
import { dispatchDocumentCommand, getDocumentRuntimeSnapshot, getDocumentSavedContent } from '../../documentRuntime/documentKernel'
import { readNote, statNoteFile } from '../../platform/tauri/documentService'
import { isBufferTabId } from '../workspace/constants'
import { subscribeWorkspaceBroadcast } from '../workspace/workspaceBroadcast'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import { unwatchWorkspace, watchWorkspace } from '../../platform/tauri/workspaceService'
import type { AppStatusTone } from './useAppStatus'

export type WorkspaceExternalSyncParams = {
  rootDir: string
  rootDirRef: MutableRefObject<string>
  t: TranslateFn
  tabLabel: (path: string) => string
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  setExternalDiskChangedPaths: Dispatch<SetStateAction<Set<string>>>
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  flushEditorToMemoryRef: MutableRefObject<(() => Promise<boolean>) | null>
  refreshFileTree: () => Promise<void>
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  fileStatRef: MutableRefObject<Record<string, { modifiedSecs: number; size: number }>>
  fileStatGenerationRef: MutableRefObject<number>
  externalReloadGenerationRef: MutableRefObject<number>
  suppressWorkspaceRefreshUntilRef: MutableRefObject<number>
  workspaceRestoringRef: MutableRefObject<boolean>
}

export function useWorkspaceExternalSync({
  rootDir,
  rootDirRef,
  t,
  tabLabel,
  setStatus,
  setExternalDiskChangedPaths,
  setSaveConflict,
  flushEditorToMemoryRef,
  refreshFileTree,
  resetModeSwitchEditorBootstrap,
  bumpColdOpenGeneration,
  fileStatRef,
  fileStatGenerationRef,
  externalReloadGenerationRef,
  suppressWorkspaceRefreshUntilRef,
  workspaceRestoringRef,
}: WorkspaceExternalSyncParams) {
  const refreshFileTreeDebouncedRef = useRef<number | null>(null)
  const remoteSyncHintShownRef = useRef<Set<string>>(new Set())

  const maybeShowRemoteSyncHint = useCallback(
    (root: string) => {
      const trimmed = root.trim()
      if (!trimmed || !isLikelyRemoteWorkspaceRoot(trimmed)) return
      const key = pathCompareKey(trimmed)
      if (remoteSyncHintShownRef.current.has(key)) return
      remoteSyncHintShownRef.current.add(key)
      setStatus(t('app.status.workspaceRemoteSyncHint'), 'info')
    },
    [setStatus, t],
  )

  const markExternalDiskDrift = useCallback(
    (path: string) => {
      setExternalDiskChangedPaths((prev) => {
        const next = new Set(prev)
        next.add(path)
        return next
      })
    },
    [setExternalDiskChangedPaths],
  )

  const clearExternalDiskDrift = useCallback(
    (path: string) => {
      setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, path))
    },
    [setExternalDiskChangedPaths],
  )

  const shouldApplyFileStatWrite = useCallback(
    (workspaceRootAtStart: string, capturedFileStatGeneration: number): boolean => {
      if (isFileStatGenerationStale(capturedFileStatGeneration, fileStatGenerationRef)) return false
      if (rootDirRef.current.trim() !== workspaceRootAtStart) return false
      return true
    },
    [fileStatGenerationRef, rootDirRef],
  )

  const reloadOpenFilesAfterExternalChange = useCallback(async () => {
    if (!rootDir) return
    const workspaceRoot = rootDirRef.current.trim()
    if (!workspaceRoot) return
    const generation = ++externalReloadGenerationRef.current
    const snap = getDocumentRuntimeSnapshot()
    const pathsToCheck = [...new Set([snap.activePath, ...snap.openedTabs].filter(Boolean))]
    for (const path of pathsToCheck) {
      if (externalReloadGenerationRef.current !== generation) return
      if (!path || isBufferTabId(path)) continue
      const capturedFileStatGeneration = captureFileStatGeneration(fileStatGenerationRef)
      let stat: { modifiedSecs: number; size: number }
      try {
        stat = await statNoteFile(workspaceRoot, path)
      } catch {
        continue
      }
      if (externalReloadGenerationRef.current !== generation) return
      if (!shouldApplyFileStatWrite(workspaceRoot, capturedFileStatGeneration)) return
      const prev = getPathKeyedRecordValue(fileStatRef.current, path)
      if (!prev || (prev.modifiedSecs === stat.modifiedSecs && prev.size === stat.size)) {
        setPathKeyedRecordValue(fileStatRef.current, path, stat)
        continue
      }
      setPathKeyedRecordValue(fileStatRef.current, path, stat)
      if (!pathsEqual(path, snap.activePath)) {
        if (isPathDirty(path)) {
          markExternalDiskDrift(path)
          setStatus(t('app.status.externalFileChangedInactive', { path: tabLabel(path) }), 'warning')
        } else {
          const saved = getDocumentSavedContent(path)
          if (saved !== undefined) {
            try {
              const disk = await readNote(workspaceRoot, path)
              if (externalReloadGenerationRef.current !== generation) return
              if (!shouldApplyFileStatWrite(workspaceRoot, capturedFileStatGeneration)) return
              if (normalizeLineEndings(disk) === normalizeLineEndings(saved)) {
                await dispatchDocumentCommand({
                  type: 'UPDATE_OPEN_DOCUMENT_CONTENT',
                  path,
                  content: saved,
                  source: 'external-fs-cache-sync',
                })
                continue
              }
            } catch {
              /* fall through to cache drop */
            }
          }
          deleteTabBody(path)
        }
        continue
      }
      if (isPathDirty(path)) {
        markExternalDiskDrift(path)
        if (pathsEqual(path, snap.activePath)) {
          await flushEditorToMemoryRef.current?.()
        }
        const local = getTabBody(path) ?? getDocumentSavedContent(path) ?? ''
        const result = await promptExternalDriftConflict({
          rootDir: workspaceRoot,
          path,
          local,
          setSaveConflict,
          setStatus,
          t,
        })
        if (externalReloadGenerationRef.current !== generation) return
        if (result === 'disk' || result === 'local') {
          clearExternalDiskDrift(path)
          resetModeSwitchEditorBootstrap()
          bumpColdOpenGeneration()
        } else {
          setStatus(t('app.status.externalFileChangedDirtyKept'), 'warning')
        }
        continue
      }
      clearExternalDiskDrift(path)
      await dispatchDocumentCommand({
        type: 'REVERT_DOCUMENT',
        root: workspaceRoot,
        path,
        source: 'external-fs-reload',
      })
    }
  }, [
    rootDir,
    rootDirRef,
    t,
    tabLabel,
    setStatus,
    setSaveConflict,
    flushEditorToMemoryRef,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    fileStatRef,
    fileStatGenerationRef,
    externalReloadGenerationRef,
    markExternalDiskDrift,
    clearExternalDiskDrift,
    shouldApplyFileStatWrite,
  ])

  const scheduleExternalWorkspaceRefresh = useCallback(() => {
    if (Date.now() < suppressWorkspaceRefreshUntilRef.current) return
    if (refreshFileTreeDebouncedRef.current != null) {
      window.clearTimeout(refreshFileTreeDebouncedRef.current)
    }
    refreshFileTreeDebouncedRef.current = window.setTimeout(() => {
      refreshFileTreeDebouncedRef.current = null
      void (async () => {
        await refreshFileTree()
        if (rootDir) {
          await refreshWorkspaceIndex(rootDir).catch(() => undefined)
          await reloadOpenFilesAfterExternalChange()
        }
      })()
    }, 500)
  }, [refreshFileTree, rootDir, reloadOpenFilesAfterExternalChange, suppressWorkspaceRefreshUntilRef])

  useEffect(() => {
    if (!isTauri() || !rootDir.trim()) return
    const watchedRoot = rootDir
    let cancelled = false
    let unlisten: (() => void) | undefined
    void watchWorkspace(watchedRoot)
      .then(() => {
        if (cancelled) return
        maybeShowRemoteSyncHint(watchedRoot)
      })
      .catch(() => {
        if (cancelled) return
        setStatus(t('app.status.workspaceWatchUnavailable'), 'warning')
      })
    void listen<{ root?: string }>('workspace-changed', (event) => {
      if (cancelled) return
      const changedRoot = event.payload?.root?.trim()
      if (!changedRoot || !pathsEqual(changedRoot, watchedRoot)) return
      if (workspaceRestoringRef.current) return
      scheduleExternalWorkspaceRefresh()
    }).then((off) => {
      if (cancelled) {
        off()
        return
      }
      unlisten = off
    })
    return () => {
      cancelled = true
      unlisten?.()
      void unwatchWorkspace(watchedRoot).catch(() => undefined)
      if (refreshFileTreeDebouncedRef.current != null) {
        window.clearTimeout(refreshFileTreeDebouncedRef.current)
      }
    }
  }, [rootDir, scheduleExternalWorkspaceRefresh, workspaceRestoringRef, maybeShowRemoteSyncHint, setStatus, t])

  useEffect(() => {
    if (!rootDir.trim()) return
    const watchedRoot = rootDir
    return subscribeWorkspaceBroadcast((message) => {
      if (message.type === 'document-saved' || message.type === 'workspace-touched') {
        if (!pathsEqual(message.root, watchedRoot)) return
        scheduleExternalWorkspaceRefresh()
      }
    })
  }, [rootDir, scheduleExternalWorkspaceRefresh])

  return { scheduleExternalWorkspaceRefresh, reloadOpenFilesAfterExternalChange }
}
