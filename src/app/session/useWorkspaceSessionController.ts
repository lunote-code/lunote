import { useEffect, useSyncExternalStore, type MutableRefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { useWorkspaceLoader, type WorkspaceLoaderDeps } from '../hooks/useWorkspaceLoader'
import {
  useWorkspaceExternalSync,
  type WorkspaceExternalSyncParams,
} from '../hooks/useWorkspaceExternalSync'
import {
  getWorkspaceIndexProgressSnapshot,
  subscribeWorkspaceIndexProgress,
} from '../workspace/workspaceIndexProgressStore'
import type { AppStatusTone } from '../hooks/useAppStatus'

export type WorkspaceSessionControllerParams = {
  loaderDeps: WorkspaceLoaderDeps
  rootDirRef: MutableRefObject<string>
  externalSyncDeps: Omit<
    WorkspaceExternalSyncParams,
    'rootDir' | 'rootDirRef' | 'workspaceRestoringRef' | 'refreshFileTree'
  >
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  t: TranslateFn
}

/** Workspace loader, external sync, and index progress wiring extracted from AppRoot. */
export function useWorkspaceSessionController(params: WorkspaceSessionControllerParams) {
  const { loaderDeps, rootDirRef, externalSyncDeps, setStatus, t } = params

  const workspaceSession = useWorkspaceLoader(loaderDeps)
  const { rootDir, workspaceRestoringRef, refreshFileTree } = workspaceSession

  rootDirRef.current = rootDir

  useWorkspaceExternalSync({
    ...externalSyncDeps,
    rootDir,
    rootDirRef,
    workspaceRestoringRef,
    refreshFileTree,
  })

  const workspaceIndexProgress = useSyncExternalStore(
    subscribeWorkspaceIndexProgress,
    getWorkspaceIndexProgressSnapshot,
    getWorkspaceIndexProgressSnapshot,
  )

  useEffect(() => {
    if (!rootDir.trim() || !workspaceIndexProgress || workspaceIndexProgress.root !== rootDir) return
    if (workspaceIndexProgress.total <= 0) return
    const phaseLabel =
      workspaceIndexProgress.phase === 'writing'
        ? t('app.status.indexProgress.writing')
        : t('app.status.indexProgress.reading')
    setStatus(
      t('app.status.indexProgress', {
        phase: phaseLabel,
        processed: workspaceIndexProgress.processed,
        total: workspaceIndexProgress.total,
      }),
      'info',
    )
  }, [rootDir, setStatus, t, workspaceIndexProgress])

  return workspaceSession
}
