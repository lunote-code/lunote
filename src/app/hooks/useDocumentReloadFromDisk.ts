import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react'

import type { TranslateFn } from '../../i18n'
import { isPathDirty } from '../../lib/documentDirty'
import { clearExternalDiskDriftInState } from '../../lib/externalDiskDriftState'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { dispatchDocumentCommand, getDocumentSavedContent } from '../../documentRuntime/documentKernel'
import { getTabBody } from '../document/tabBodiesStore'
import { promptExternalDriftConflict } from '../document/saveConflictPrompt'
import type { SaveConflictState } from '../document/saveConflictState'
import { isBufferTabId } from '../workspace/constants'
import type { AppStatusTone } from './useAppStatus'

type Params = {
  rootDir: string
  activePathRef: RefObject<string>
  t: TranslateFn
  setStatus: (message: string, toneOverride?: AppStatusTone) => void
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setExternalDiskChangedPaths: Dispatch<SetStateAction<Set<string>>>
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  refreshActiveEditorAfterPathReload: (path: string) => void
  confirmAppDialog: (args: {
    title: string
    message: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
}

export function useDocumentReloadFromDisk({
  rootDir,
  activePathRef,
  t,
  setStatus,
  setSaveConflict,
  setExternalDiskChangedPaths,
  resetModeSwitchEditorBootstrap,
  bumpColdOpenGeneration,
  refreshActiveEditorAfterPathReload,
  confirmAppDialog,
}: Params) {
  const clearExternalDiskDrift = useCallback(
    (path: string) => {
      setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, path))
    },
    [setExternalDiskChangedPaths],
  )

  const reloadDocumentFromDisk = useCallback(
    async (path: string) => {
      if (!rootDir || !path || isBufferTabId(path)) {
        setStatus(t('app.status.noRevertTarget'), 'warning')
        return false
      }

      if (isPathDirty(path)) {
        const local = getTabBody(path) ?? getDocumentSavedContent(path) ?? ''
        const result = await promptExternalDriftConflict({
          rootDir,
          path,
          local,
          setSaveConflict,
          setStatus,
          t,
        })
        if (result === 'disk' || result === 'local') {
          clearExternalDiskDrift(path)
          resetModeSwitchEditorBootstrap()
          bumpColdOpenGeneration()
          if (pathsEqual(path, activePathRef.current)) {
            refreshActiveEditorAfterPathReload(path)
          }
          return true
        }
        return false
      }

      const ok = await confirmAppDialog({
        title: t('app.confirm.title'),
        message: t('app.confirm.revertFile'),
        variant: 'warning',
      })
      if (!ok) return false

      try {
        await dispatchDocumentCommand({
          type: 'REVERT_DOCUMENT',
          root: rootDir,
          path,
          source: 'external-reload-cta',
        })
        clearExternalDiskDrift(path)
        if (pathsEqual(path, activePathRef.current)) {
          refreshActiveEditorAfterPathReload(path)
        }
        setStatus(t('app.menu.revertedFromDisk'), 'success')
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus(t('app.status.operationFailed', { message }), 'error')
        return false
      }
    },
    [
      activePathRef,
      bumpColdOpenGeneration,
      clearExternalDiskDrift,
      confirmAppDialog,
      refreshActiveEditorAfterPathReload,
      resetModeSwitchEditorBootstrap,
      rootDir,
      setSaveConflict,
      setStatus,
      t,
    ],
  )

  return reloadDocumentFromDisk
}
