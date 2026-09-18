import { useEffect, useRef, useState } from 'react'

import { getAppSettingsSnapshot, subscribeAppSettings } from '../../settings/appSettingsStore'
import { hasAnyDirtyDocument, isPathDirty, listDirtyDocumentPaths } from '../../lib/documentDirty'
import { filterAutosaveEligibleDirtyPaths } from '../../lib/autosavePathEligibility'
import { shouldAnnounceAutosaveComplete } from '../../lib/autosaveStatusPolicy'
import { isBufferTabId } from '../workspace/constants'
import { getDocumentRuntimeSnapshot } from '../../documentRuntime/documentKernel'
import { isTauri } from '@tauri-apps/api/core'
import type { TranslateFn } from '../../i18n'
import { isAutosaveSuspended } from '../../documentHistory/historyRestoreState'
import type { AppStatusTone } from './useAppStatus'

export type AutosaveScope = 'allDirty' | 'activeOnly'

export type AutosaveSettings = {
  enabled: boolean
  intervalSec: number
  scope: AutosaveScope
}

/** Default autosave scope is active tab only; allDirty must be opted in via settings. */
const DEFAULT_AUTOSAVE: AutosaveSettings = {
  enabled: true,
  intervalSec: 60,
  scope: 'activeOnly',
}

export function readAutosaveSettings(): AutosaveSettings {
  const editor = getAppSettingsSnapshot().appearance?.editor as
    | { autosaveEnabled?: boolean; autosaveIntervalSec?: number; autosaveScope?: AutosaveScope }
    | undefined
  const intervalSec = Math.max(30, Math.min(600, Number(editor?.autosaveIntervalSec) || DEFAULT_AUTOSAVE.intervalSec))
  const scope = editor?.autosaveScope === 'allDirty' ? 'allDirty' : 'activeOnly'
  return {
    enabled: editor?.autosaveEnabled !== false,
    intervalSec,
    scope,
  }
}

type Params = {
  rootDir: string
  activePath: string
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  t: TranslateFn
  saveAllDirtyDocuments: (mode?: 'manual' | 'autosave') => Promise<boolean>
  saveDocumentAtPath: (path: string, mode?: 'manual' | 'autosave') => Promise<boolean>
}

export function useAutosave({
  rootDir,
  activePath: _activePath,
  setStatus,
  t,
  saveAllDirtyDocuments,
  saveDocumentAtPath,
}: Params): void {
  const busyRef = useRef(false)
  const pendingRef = useRef(false)
  const lastAutosaveFailureAtRef = useRef(0)
  const settingsRef = useRef(readAutosaveSettings())
  const [intervalSec, setIntervalSec] = useState(() => readAutosaveSettings().intervalSec)

  useEffect(
    () =>
      subscribeAppSettings(() => {
        const next = readAutosaveSettings()
        settingsRef.current = next
        setIntervalSec(next.intervalSec)
      }),
    [],
  )

  useEffect(() => {
    if (!rootDir || !isTauri()) return
    const runAutosave = () => {
      const cfg = settingsRef.current
      if (!cfg.enabled || !hasAnyDirtyDocument()) return
      if (busyRef.current) {
        pendingRef.current = true
        return
      }

      busyRef.current = true
      const run =
        cfg.scope === 'allDirty'
          ? (async () => {
              const dirty = filterAutosaveEligibleDirtyPaths(
                listDirtyDocumentPaths(),
                isBufferTabId,
                isAutosaveSuspended,
              )
              if (dirty.length === 0) return true
              return saveAllDirtyDocuments('autosave')
            })()
          : (async () => {
              // Read active path from kernel snapshot at tick time to avoid
              // saving a stale React closure path during rapid tab switching.
              const targetPath = getDocumentRuntimeSnapshot().activePath
              if (!targetPath || isBufferTabId(targetPath) || !isPathDirty(targetPath)) return true
              if (isAutosaveSuspended(targetPath)) return true
              return saveDocumentAtPath(targetPath, 'autosave')
            })()

      void run
        .then((ok) => {
          if (!ok) {
            const now = Date.now()
            if (now - lastAutosaveFailureAtRef.current >= 60_000) {
              lastAutosaveFailureAtRef.current = now
              setStatus(t('app.status.autosaveFailed'), 'error')
            }
            return
          }
          const stillDirty = hasAnyDirtyDocument()
          const latestActivePath = getDocumentRuntimeSnapshot().activePath
          const activeStillDirty =
            latestActivePath && !isBufferTabId(latestActivePath) ? isPathDirty(latestActivePath) : false
          if (
            shouldAnnounceAutosaveComplete({
              scope: cfg.scope,
              stillDirty,
              activeStillDirty,
            })
          ) {
            setStatus(t('app.status.autosaved'), 'success')
          }
        })
        .finally(() => {
          busyRef.current = false
          if (pendingRef.current) {
            pendingRef.current = false
            runAutosave()
          }
        })
    }

    const onWindowBlur = () => {
      runAutosave()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        runAutosave()
      }
    }

    const id = window.setInterval(runAutosave, intervalSec * 1000)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [rootDir, intervalSec, saveAllDirtyDocuments, saveDocumentAtPath, setStatus, t])
}
