import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { isPathDirty } from '../../lib/documentDirty'
import { deleteTabBody } from '../document/tabBodiesStore'
import { dispatchDocumentCommand, getDocumentRuntimeSnapshot } from '../../documentRuntime/documentKernel'
import { isBufferTabId } from '../workspace/constants'
import { subscribeWorkspaceBroadcast } from '../workspace/workspaceBroadcast'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import { statNoteFile } from '../../platform/tauri/documentService'
import { unwatchWorkspace, watchWorkspace } from '../../platform/tauri/workspaceService'

export type WorkspaceExternalSyncParams = {
  rootDir: string
  t: TranslateFn
  tabLabel: (path: string) => string
  setStatus: (msg: string) => void
  setExternalDiskChangedPaths: Dispatch<SetStateAction<Set<string>>>
  refreshFileTree: () => Promise<void>
  confirmAppDialog: (options: {
    title: string
    message: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  fileStatRef: MutableRefObject<Record<string, { modifiedSecs: number; size: number }>>
  externalReloadGenerationRef: MutableRefObject<number>
  suppressWorkspaceRefreshUntilRef: MutableRefObject<number>
  workspaceRestoringRef: MutableRefObject<boolean>
}

export function useWorkspaceExternalSync({
  rootDir,
  t,
  tabLabel,
  setStatus,
  setExternalDiskChangedPaths,
  refreshFileTree,
  confirmAppDialog,
  resetModeSwitchEditorBootstrap,
  bumpColdOpenGeneration,
  fileStatRef,
  externalReloadGenerationRef,
  suppressWorkspaceRefreshUntilRef,
  workspaceRestoringRef,
}: WorkspaceExternalSyncParams) {
  const refreshFileTreeDebouncedRef = useRef<number | null>(null)

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
      setExternalDiskChangedPaths((prev) => {
        const next = new Set(prev)
        for (const current of [...next]) {
          if (pathsEqual(current, path)) next.delete(current)
        }
        return next
      })
    },
    [setExternalDiskChangedPaths],
  )

  const reloadOpenFilesAfterExternalChange = useCallback(async () => {
    if (!rootDir) return
    const generation = ++externalReloadGenerationRef.current
    const snap = getDocumentRuntimeSnapshot()
    const pathsToCheck = [...new Set([snap.activePath, ...snap.openedTabs].filter(Boolean))]
    for (const path of pathsToCheck) {
      if (externalReloadGenerationRef.current !== generation) return
      if (!path || isBufferTabId(path)) continue
      let stat: { modifiedSecs: number; size: number }
      try {
        stat = await statNoteFile(rootDir, path)
      } catch {
        continue
      }
      const prev = fileStatRef.current[path]
      if (!prev || (prev.modifiedSecs === stat.modifiedSecs && prev.size === stat.size)) {
        fileStatRef.current[path] = stat
        continue
      }
      fileStatRef.current[path] = stat
      if (!pathsEqual(path, snap.activePath)) {
        if (isPathDirty(path)) {
          markExternalDiskDrift(path)
          setStatus(t('app.status.externalFileChangedInactive', { path: tabLabel(path) }))
        } else {
          deleteTabBody(path)
        }
        continue
      }
      if (isPathDirty(path)) {
        const ok = await confirmAppDialog({
          title: t('app.confirm.title'),
          message: t('app.confirm.externalFileChangedDirty'),
          variant: 'warning',
        })
        if (!ok) {
          markExternalDiskDrift(path)
          setStatus(t('app.status.saveConflict'))
          continue
        }
      }
      clearExternalDiskDrift(path)
      await dispatchDocumentCommand({
        type: 'REVERT_DOCUMENT',
        root: rootDir,
        path,
        source: 'external-fs-reload',
      })
      resetModeSwitchEditorBootstrap()
      bumpColdOpenGeneration()
    }
  }, [
    rootDir,
    t,
    tabLabel,
    setStatus,
    setExternalDiskChangedPaths,
    confirmAppDialog,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    fileStatRef,
    externalReloadGenerationRef,
    markExternalDiskDrift,
    clearExternalDiskDrift,
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
    void watchWorkspace(watchedRoot).catch(() => undefined)
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
  }, [rootDir, scheduleExternalWorkspaceRefresh, workspaceRestoringRef])

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
