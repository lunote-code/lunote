import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { transitionWorkspaceSession } from '../../documentRuntime/workspaceSessionRuntime'
import { hasAnyDirtyDocument, listDirtyDocumentPaths } from '../../lib/documentDirty'
import type { AppStatusTone } from './useAppStatus'
import { installNavigationRuntimeFirewall } from '../../navigation/navigationRuntimeFirewall'
import { dispatchRestoreNavigation } from '../../navigation/navigationFactory'
import { recordNavigationSideEffect } from '../../navigation/navigationEventValidator'
import { logError, logInfo, logWarn } from '../../lib/lunaLogger'
import { ensureLunaDirs } from '../../lunaPaths'
import { flushLunaWorkspaceSnapshotWrites, readLunaWorkspaceSnapshot, workspaceIdFromRoot } from '../../lunaPersistence'
import {
  getAppSettingsSnapshot,
  clearLastWorkspaceSettings,
  hydrateAppSettingsStore,
} from '../../settings/appSettingsStore'
import { isCloseToTrayAvailable } from '../../platform/tauri/quickCapture'
import {
  QA_APP_ROOT_OUTLINE_NOTE_B,
  isQaAppRootOutlineMode,
} from '../qa/qaAppRootOutlineHarness'
import { QA_KNOWLEDGE_ROOT } from '../qa/qaKnowledgeFixtures'
import { markBootPhase, measureBootSince } from '../bootPerf'
import { persistWorkspaceSnapshotNow } from '../../documentRuntime/persistWorkspaceSnapshot'
import { readNote, statNoteFile } from '../../platform/tauri/documentService'
import { shouldRestoreRecoveryDraft } from '../workspace/recoveryDraftRestore'
import { INITIAL_NOTE_MD } from '../workspace/constants'
import { isWorkspaceLoadSupersededError } from './useWorkspaceLoader'

export type AppBootstrapDeps = {
  tRef: RefObject<TranslateFn>
  setRootDir: (root: string) => void
  loadNotes: (root: string, prefer?: string | null, tabs?: string[] | null) => Promise<boolean>
  pendingRestoreEventIdRef: MutableRefObject<string | null>
  acquireWorkspaceRestoreBarrier: () => void
  releaseWorkspaceRestoreBarrier: () => void
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  saveAllDirtyDocumentsRef: MutableRefObject<(() => Promise<boolean>) | null>
  flushEditorToMemoryRef: MutableRefObject<(() => Promise<boolean>) | null>
  promptUnsavedChanges: (options: {
    title?: string
    message: string
    saveLabel?: string
    discardLabel?: string
    cancelLabel?: string
  }) => Promise<'save' | 'discard' | 'cancel'>
}

const CLOSE_TO_TRAY_HINT_STORAGE_KEY = 'luna.window.closeToTrayHintShown'

function shouldShowCloseToTrayHint(): boolean {
  try {
    return localStorage.getItem(CLOSE_TO_TRAY_HINT_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

function markCloseToTrayHintShown(): void {
  try {
    localStorage.setItem(CLOSE_TO_TRAY_HINT_STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

function isCloseToTrayEnabled(): boolean {
  return getAppSettingsSnapshot().appearance?.window?.closeToTrayEnabled !== false
}

async function hideMainWindowToBackground(
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void,
  t: TranslateFn,
): Promise<boolean> {
  if (!isCloseToTrayEnabled() || !isCloseToTrayAvailable()) return false
  await getCurrentWindow().hide().catch(() => undefined)
  if (shouldShowCloseToTrayHint()) {
    markCloseToTrayHintShown()
    setStatus(t('app.status.windowHiddenToTray'), 'info')
  }
  return true
}

async function flushWindowCloseEdits(deps: {
  flushEditorToMemoryRef: MutableRefObject<(() => Promise<boolean>) | null>
}): Promise<boolean> {
  await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
  const flushEditorToMemory = deps.flushEditorToMemoryRef.current
  if (!flushEditorToMemory) return true
  return flushEditorToMemory()
}

async function restoreWorkspaceRecoveryDrafts(
  rootDir: string,
  drafts: Record<string, { content: string; updatedAt: number }> | undefined,
): Promise<number> {
  if (!drafts) return 0
  const entries = Object.entries(drafts).filter(
    ([path, draft]) => Boolean(path) && typeof draft?.content === 'string',
  )
  if (entries.length === 0) return 0
  let restored = 0
  for (const [path, draft] of entries) {
    let shouldRestore: boolean
    try {
      const [diskContent, stat] = await Promise.all([
        readNote(rootDir, path),
        statNoteFile(rootDir, path),
      ])
      shouldRestore = shouldRestoreRecoveryDraft({
        draft,
        diskContent,
        diskModifiedSecs: stat.modifiedSecs,
      })
    } catch {
      shouldRestore = shouldRestoreRecoveryDraft({ draft })
    }
    if (!shouldRestore) continue
    try {
      await dispatchDocumentCommand({
        type: 'UPDATE_OPEN_DOCUMENT_CONTENT',
        path,
        content: draft.content,
        source: 'workspace-recovery-restore',
      })
      restored += 1
    } catch {
      // Ignore per-note restore failures so other drafts can still recover.
    }
  }
  return restored
}

function perfNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function perfDurationMs(startedAt: number): number {
  return Math.round((perfNowMs() - startedAt) * 10) / 10
}

export function useAppBootstrap(deps: AppBootstrapDeps) {
  const {
    tRef,
    setRootDir,
    loadNotes,
    pendingRestoreEventIdRef,
    acquireWorkspaceRestoreBarrier,
    releaseWorkspaceRestoreBarrier,
    setStatus,
    flushEditorToMemoryRef,
    saveAllDirtyDocumentsRef,
    promptUnsavedChanges,
  } = deps

  useEffect(() => {
    installNavigationRuntimeFirewall()
    if (!isTauri()) return
    void ensureLunaDirs()
  }, [])

  const workspaceRestoreGenerationRef = useRef(0)

  const isWorkspaceRestoreUnavailableError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error)
    return /Failed to read directory|Operation not permitted|No such file|Permission denied|not available|unavailable/i.test(
      message,
    )
  }

  useEffect(() => {
    const generation = ++workspaceRestoreGenerationRef.current
    let cancelled = false
    void (async () => {
      acquireWorkspaceRestoreBarrier()
      markBootPhase('workspace_restore_effect_start', { generation })
      const restoreStartedAt = perfNowMs()
      const logRestoreStage = (stage: string, extra: Record<string, unknown> = {}) => {
        logInfo('[PERF] workspace_restore_stage', {
          generation,
          stage,
          elapsedMs: perfDurationMs(restoreStartedAt),
          ...extra,
        })
      }
      console.info('[LAUNCH] workspace_restore start', { generation })
      logRestoreStage('start', {
        bootReadyToRestoreStartMs: measureBootSince('theme_applied', 'workspace_restore_effect_start'),
        appChunkReadyToRestoreStartMs: measureBootSince('app_chunk_ready', 'workspace_restore_effect_start'),
      })
      try {
        if (isQaAppRootOutlineMode()) {
          await loadNotes(QA_KNOWLEDGE_ROOT, QA_APP_ROOT_OUTLINE_NOTE_B, [QA_APP_ROOT_OUTLINE_NOTE_B])
          return
        }
        if (!isTauri()) return
        const ensureDirsStartedAt = perfNowMs()
        await ensureLunaDirs()
        logRestoreStage('ensureLunaDirs', { durationMs: perfDurationMs(ensureDirsStartedAt) })
        if (cancelled) {
          console.info('[LAUNCH] workspace_restore aborted (cancelled after ensureLunaDirs)', { generation })
          return
        }
        const hydrateStartedAt = perfNowMs()
        await hydrateAppSettingsStore()
        logRestoreStage('hydrateAppSettingsStore', { durationMs: perfDurationMs(hydrateStartedAt) })
        if (cancelled) {
          console.info('[LAUNCH] workspace_restore aborted (cancelled after settings hydrate)', { generation })
          return
        }
        const settings = getAppSettingsSnapshot()
        const savedWorkspaceRoot = settings.lastWorkspaceRoot?.trim()
        const savedWorkspaceId = settings.lastWorkspaceId?.trim()
        console.info('[LAUNCH] workspace_restore hints', {
          generation,
          savedWorkspaceRoot: savedWorkspaceRoot ?? null,
          savedWorkspaceId: savedWorkspaceId ?? null,
          language: settings.language,
        })
        if (!savedWorkspaceRoot && !savedWorkspaceId) {
          console.info('[LAUNCH] workspace_restore skip (no hints in memory)', { generation })
          return
        }
        const workspaceId = savedWorkspaceId || workspaceIdFromRoot(savedWorkspaceRoot!)
        const readSnapshotStartedAt = perfNowMs()
        const snap = await readLunaWorkspaceSnapshot(workspaceId)
        logRestoreStage('readLunaWorkspaceSnapshot', {
          durationMs: perfDurationMs(readSnapshotStartedAt),
          workspaceId,
        })
        if (cancelled) {
          console.info('[LAUNCH] workspace_restore aborted (cancelled after snapshot read)', { generation })
          return
        }
        console.info('[LAUNCH] workspace_restore snapshot', {
          generation,
          workspaceId,
          rootDir: snap?.rootDir ?? null,
          activePath: snap?.activePath ?? null,
          openTabs: snap?.openTabs?.length ?? 0,
        })
        const restoreEvent = dispatchRestoreNavigation('system', snap?.activePath ?? undefined, {
          workspaceId,
          rootDir: snap?.rootDir ?? savedWorkspaceRoot,
          openTabs: snap?.openTabs ?? [],
        })
        pendingRestoreEventIdRef.current = restoreEvent.id
        recordNavigationSideEffect(restoreEvent.id, {
          kind: 'loadWorkspaceSnapshot',
          source: 'workspace',
          path: snap?.activePath ?? undefined,
          meta: {
            workspaceId,
            openTabs: snap?.openTabs?.length ?? 0,
          },
        })
        const savedRoot = snap?.rootDir?.trim() || savedWorkspaceRoot
        if (!savedRoot) {
          console.info('[LAUNCH] workspace_restore skip (empty savedRoot)', { generation })
          return
        }
        const savedPath = snap?.activePath?.trim() || null
        console.info('[LAUNCH] workspace_restore loadNotes start', {
          generation,
          savedRoot,
          savedPath,
          openTabs: snap?.openTabs?.length ?? 0,
        })
        const loadNotesStartedAt = perfNowMs()
        const didLoadWorkspace = await loadNotes(savedRoot, savedPath, snap?.openTabs ?? [])
        if (!didLoadWorkspace || cancelled || workspaceRestoreGenerationRef.current !== generation) return
        const restoredRecoveryDraftCount = await restoreWorkspaceRecoveryDrafts(savedRoot, snap?.recoveryDrafts)
        if (restoredRecoveryDraftCount > 0) {
          setStatus(tRef.current('app.status.recoveryRestored', { count: restoredRecoveryDraftCount }), 'warning')
        }
        logRestoreStage('loadNotes', {
          durationMs: perfDurationMs(loadNotesStartedAt),
          savedRoot,
          savedPath,
          openTabs: snap?.openTabs?.length ?? 0,
          restoredRecoveryDraftCount,
        })
        console.info('[LAUNCH] workspace_restore loadNotes done', { generation, savedRoot })
        logRestoreStage('done', {
          totalDurationMs: perfDurationMs(restoreStartedAt),
          savedRoot,
        })
      } catch (error) {
        const stale = workspaceRestoreGenerationRef.current !== generation
        logError('[LAUNCH] workspace_restore error', {
          generation,
          cancelled,
          stale,
          error: error instanceof Error ? error.message : String(error),
        })
        if (isWorkspaceLoadSupersededError(error)) return
        if (cancelled || stale) return
        const unavailable = isWorkspaceRestoreUnavailableError(error)
        if (unavailable) logWarn('[LAUNCH] workspace_restore_skipped', error)
        else logError('[LAUNCH] workspace_restore_failed', error)
        const message = error instanceof Error ? error.message : String(error)
        if (!unavailable) {
          await clearLastWorkspaceSettings().catch((clearError) => {
            logWarn('[LAUNCH] workspace_restore_hint_clear_failed', clearError)
          })
        }
        pendingRestoreEventIdRef.current = null
        setRootDir('')
        await dispatchDocumentCommand({
          type: 'RESTORE_WORKSPACE',
          root: '',
          activePath: null,
          openTabs: [],
          emptyContent: INITIAL_NOTE_MD,
          source: 'workspace-restore-failed',
        }).catch((clearError) => {
          logWarn('[LAUNCH] workspace_restore_tabs_clear_failed', clearError)
        })
        transitionWorkspaceSession({ state: 'idle', rootDir: null, activePath: null, openTabs: [] })
        setStatus(
          unavailable
            ? tRef.current('app.status.workspaceRestoreFailed')
            : message
              ? tRef.current('app.status.operationFailed', { message })
              : tRef.current('app.status.workspaceRestoreFailed'),
        )
      } finally {
        releaseWorkspaceRestoreBarrier()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    let unlisten: (() => void) | undefined
    void (async () => {
      const off = await getCurrentWindow().onCloseRequested(async (event) => {
        const hideToBackground = isCloseToTrayEnabled() && isCloseToTrayAvailable()
        if (hideToBackground) {
          event.preventDefault()
          await hideMainWindowToBackground(setStatus, tRef.current)
          void flushWindowCloseEdits({
            flushEditorToMemoryRef,
          })
          return
        }

        try {
          const flushed = await flushWindowCloseEdits({
            flushEditorToMemoryRef,
          })
          if (!flushed) {
            event.preventDefault()
            return
          }
        } catch (error) {
          event.preventDefault()
          setStatus(
            tRef.current('app.status.saveFailed', {
              message: error instanceof Error ? error.message : String(error),
            }),
          )
          return
        }

        if (!hasAnyDirtyDocument()) return

        event.preventDefault()
        try {
          const dirtyCount = listDirtyDocumentPaths().length
          const choice = await promptUnsavedChanges({
            title: tRef.current('app.closeWindow.title'),
            message:
              dirtyCount > 1
                ? tRef.current('app.unsaved.quitMessageMany', { count: dirtyCount })
                : tRef.current('app.unsaved.quitMessage'),
            saveLabel: tRef.current('app.unsaved.saveAll'),
            discardLabel: tRef.current('app.unsaved.quitWithoutSaving'),
            cancelLabel: tRef.current('app.unsaved.cancel'),
          })
          if (choice === 'cancel') return
          if (choice === 'save') {
            const saved = await saveAllDirtyDocumentsRef.current?.()
            if (!saved) return
          } else if (choice === 'discard') {
            persistWorkspaceSnapshotNow({ clearRecoveryDrafts: true })
            await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
          }
          await getCurrentWindow().destroy()
        } catch {
          /*The dialog box is not forced to close when there is an exception*/
        }
      })
      if (cancelled) {
        off()
        return
      }
      unlisten = off
    })()
    return () => {
      cancelled = true
      const off = unlisten
      unlisten = undefined
      off?.()
    }
  }, [
    promptUnsavedChanges,
    flushEditorToMemoryRef,
    saveAllDirtyDocumentsRef,
    setStatus,
    tRef,
  ])
}
