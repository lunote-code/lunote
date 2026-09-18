import { useEffect, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import { getAppSettingsSnapshot, subscribeAppSettings } from '../../settings/appSettingsStore'
import {
  autoLockDelayMs,
  normalizeAutoLockMinutes,
} from '../../settings-runtime/workspaceAutoLock'
import {
  getWorkspaceEncryptionStatus,
  lockWorkspace,
  WORKSPACE_ENCRYPTION_CHANGED_EVENT,
} from '../../platform/tauri/workspaceEncryptionService'
import { ensureWorkspaceUnlocked, type WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'
import { lockWorkspaceAfterIdleWithDeps } from '../../workspace/lockWorkspaceAfterIdle'
import { listDirtyDocumentPaths } from '../../lib/documentDirty'
import { purgeLockedWorkspacePlaintext, reloadLockedWorkspaceSession } from '../workspace/purgeLockedWorkspacePlaintext'
import type { TranslateFn } from '../../i18n'
import type { AppStatusTone } from './useAppStatus'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'mousemove'] as const

export function readAutoLockMinutes(): number {
  return normalizeAutoLockMinutes(getAppSettingsSnapshot().security?.autoLockMinutes)
}

type Params = {
  rootDir: string
  rootDirRef: { current: string }
  activePathRef: { current: string }
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  t: TranslateFn
  saveAllDirtyDocuments: (mode?: 'manual' | 'autosave') => Promise<boolean>
  promptWorkspacePassword?: WorkspacePasswordPrompt
  bumpColdOpenGeneration: () => void
  resetModeSwitchEditorBootstrap: () => void
  captureActiveEditorSession?: () => void
  restoreActiveEditorSession?: () => void
}

export function useWorkspaceAutoLock({
  rootDir,
  rootDirRef,
  activePathRef,
  setStatus,
  t,
  saveAllDirtyDocuments,
  promptWorkspacePassword,
  bumpColdOpenGeneration,
  resetModeSwitchEditorBootstrap,
  captureActiveEditorSession,
  restoreActiveEditorSession,
}: Params): void {
  const busyRef = useRef(false)
  const lastActivityAtRef = useRef(0)
  const activityGenerationRef = useRef(0)
  const needsReloadAfterUnlockRef = useRef(false)
  const saveAllDirtyDocumentsRef = useRef(saveAllDirtyDocuments)
  saveAllDirtyDocumentsRef.current = saveAllDirtyDocuments
  const promptWorkspacePasswordRef = useRef(promptWorkspacePassword)
  promptWorkspacePasswordRef.current = promptWorkspacePassword
  const bumpColdOpenGenerationRef = useRef(bumpColdOpenGeneration)
  bumpColdOpenGenerationRef.current = bumpColdOpenGeneration
  const resetModeSwitchEditorBootstrapRef = useRef(resetModeSwitchEditorBootstrap)
  resetModeSwitchEditorBootstrapRef.current = resetModeSwitchEditorBootstrap
  const captureActiveEditorSessionRef = useRef(captureActiveEditorSession)
  captureActiveEditorSessionRef.current = captureActiveEditorSession
  const restoreActiveEditorSessionRef = useRef(restoreActiveEditorSession)
  restoreActiveEditorSessionRef.current = restoreActiveEditorSession
  const setStatusRef = useRef(setStatus)
  setStatusRef.current = setStatus
  const tRef = useRef(t)
  tRef.current = t
  const [autoLockMinutes, setAutoLockMinutes] = useState(readAutoLockMinutes)

  useEffect(
    () =>
      subscribeAppSettings(() => {
        setAutoLockMinutes(readAutoLockMinutes())
      }),
    [],
  )

  useEffect(() => {
    if (!rootDir.trim() || !isTauri()) return
    const onEncryptionChanged = (event: Event) => {
      const eventRoot = (event as CustomEvent<{ root?: string }>).detail?.root?.trim()
      if (!eventRoot || eventRoot !== rootDirRef.current.trim()) return
      if (!needsReloadAfterUnlockRef.current) return
      void (async () => {
        const status = await getWorkspaceEncryptionStatus(eventRoot)
        if (!status.unlocked) return
        if (rootDirRef.current.trim() !== eventRoot) return
        needsReloadAfterUnlockRef.current = false
        try {
          await reloadLockedWorkspaceSession(eventRoot, activePathRef.current)
          restoreActiveEditorSessionRef.current?.()
          bumpColdOpenGenerationRef.current()
        } catch {
          needsReloadAfterUnlockRef.current = true
        }
      })()
    }
    window.addEventListener(WORKSPACE_ENCRYPTION_CHANGED_EVENT, onEncryptionChanged)
    return () => window.removeEventListener(WORKSPACE_ENCRYPTION_CHANGED_EVENT, onEncryptionChanged)
  }, [activePathRef, rootDir, rootDirRef])

  useEffect(() => {
    if (!rootDir.trim() || !isTauri()) return
    const delay = autoLockDelayMs(autoLockMinutes)
    if (delay == null) return

    lastActivityAtRef.current = Date.now()
    activityGenerationRef.current += 1
    let timer: number | null = null

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const isStillCurrent = (generationAtStart: number) =>
      rootDirRef.current === rootDir && activityGenerationRef.current === generationAtStart

    const schedule = () => {
      clearTimer()
      if (busyRef.current) return
      timer = window.setTimeout(() => {
        void runIdleLock()
      }, delay)
    }

    const markActivity = () => {
      lastActivityAtRef.current = Date.now()
      activityGenerationRef.current += 1
      if (!busyRef.current) schedule()
    }

    const runIdleLock = async () => {
      if (busyRef.current) return
      const generationAtStart = activityGenerationRef.current
      const idleMs = Date.now() - lastActivityAtRef.current
      busyRef.current = true
      try {
        const result = await lockWorkspaceAfterIdleWithDeps(
          {
            rootDir,
            autoLockMinutes,
            idleMs,
          },
          {
            getStatus: getWorkspaceEncryptionStatus,
            saveDirtyDocuments: async () => saveAllDirtyDocumentsRef.current('autosave'),
            lockWorkspace,
            purgePlaintextSession: () => {
              captureActiveEditorSessionRef.current?.()
              needsReloadAfterUnlockRef.current = true
              purgeLockedWorkspacePlaintext({ previousRoot: rootDir })
              bumpColdOpenGenerationRef.current()
              resetModeSwitchEditorBootstrapRef.current()
            },
            ensureUnlocked: async (root) => {
              const prompt = promptWorkspacePasswordRef.current
              if (!prompt) return false
              return ensureWorkspaceUnlocked(root, prompt, tRef.current)
            },
            isStillCurrent: () => isStillCurrent(generationAtStart),
            isWorkspaceStillOpen: () => rootDirRef.current === rootDir,
            listRemainingDirtyPaths: listDirtyDocumentPaths,
          },
        )
        if (result === 'save-failed') {
          setStatusRef.current(tRef.current('app.status.workspaceAutoLockSaveFailed'), 'error')
        } else if (result === 'unsaved-remaining') {
          setStatusRef.current(tRef.current('app.status.workspaceAutoLockUnsavedRemaining'), 'warning')
        } else if (result === 'lock-failed') {
          setStatusRef.current(tRef.current('workspace.encryption.autoLock.lockFailed'), 'error')
        } else if (result === 'locked') {
          if (rootDirRef.current === rootDir) {
            setStatusRef.current(tRef.current('app.status.workspaceAutoLocked'), 'warning')
          }
        }
      } finally {
        busyRef.current = false
        if (rootDirRef.current === rootDir) schedule()
      }
    }

    schedule()
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActivity, true)
    }
    return () => {
      clearTimer()
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActivity, true)
      }
    }
  }, [autoLockMinutes, rootDir, rootDirRef])
}
