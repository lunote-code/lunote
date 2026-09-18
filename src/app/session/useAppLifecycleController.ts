import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

import type { TranslateFn } from '../../i18n'
import { hasAnyDirtyDocument, listDirtyDocumentPaths } from '../../lib/documentDirty'
import { raiseMainWindow } from '../../platform/tauri/raiseMainWindow'
import {
  resolveOrCreateDailyNotePath,
  shouldOpenDailyNoteOnStartup,
} from '../../templates/dailyNoteService'
import { ensureDefaultTemplateFiles } from '../../templates/templateService'
import { flushLunaWorkspaceSnapshotWrites } from '../../lunaPersistence'
import { persistWorkspaceSnapshotNow } from '../../documentRuntime/persistWorkspaceSnapshot'
import { flushNoteCalendarEditsWrites } from '../noteCalendar/noteCalendarEditStore'
import type { AppStatusTone } from '../hooks/useAppStatus'

export type AppLifecycleControllerParams = {
  t: TranslateFn
  rootDir: string
  flushEditorToMemoryRef: MutableRefObject<(() => Promise<boolean>) | null>
  saveAllDirtyDocumentsRef: MutableRefObject<(() => Promise<boolean>) | null>
  promptUnsavedChanges: (args: {
    title: string
    message: string
    saveLabel: string
    discardLabel: string
    cancelLabel: string
  }) => Promise<'save' | 'discard' | 'cancel'>
  setStatus: (message: string, toneOverride?: AppStatusTone) => void
  dispatchOpenDocumentInTab: (root: string, path: string, reason?: string) => Promise<void>
}

/** App quit flow and daily-note startup extracted from AppRoot. */
export function useAppLifecycleController(params: AppLifecycleControllerParams) {
  const {
    t,
    rootDir,
    flushEditorToMemoryRef,
    saveAllDirtyDocumentsRef,
    promptUnsavedChanges,
    setStatus,
    dispatchOpenDocumentInTab,
  } = params

  const quitAppSafely = useCallback(async () => {
    await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
    const flushed = await flushEditorToMemoryRef.current?.()
    if (flushed === false) {
      return
    }

    if (hasAnyDirtyDocument()) {
      try {
        if (isTauri()) await raiseMainWindow()
        const dirtyCount = listDirtyDocumentPaths().length
        const choice = await promptUnsavedChanges({
          title: t('menu.native.app.quit'),
          message:
            dirtyCount > 1
              ? t('app.unsaved.quitMessageMany', { count: dirtyCount })
              : t('app.unsaved.quitMessage'),
          saveLabel: t('app.unsaved.saveAll'),
          discardLabel: t('app.unsaved.quitWithoutSaving'),
          cancelLabel: t('app.unsaved.cancel'),
        })
        if (choice === 'cancel') return
        if (choice === 'save') {
          const saved = await saveAllDirtyDocumentsRef.current?.()
          if (!saved) return
          await flushNoteCalendarEditsWrites().catch(() => undefined)
        } else if (choice === 'discard') {
          persistWorkspaceSnapshotNow({ clearRecoveryDrafts: true })
          await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus(t('app.status.operationFailed', { message }), 'error')
        return
      }
    }

    await flushNoteCalendarEditsWrites().catch(() => undefined)
    if (isTauri()) await getCurrentWindow().destroy()
    else window.close()
  }, [flushEditorToMemoryRef, promptUnsavedChanges, saveAllDirtyDocumentsRef, setStatus, t])

  const openDailyNoteWithOffset = useCallback(
    async (dayOffset = 0) => {
      if (!rootDir.trim()) return 'no-workspace'
      const when = new Date()
      when.setDate(when.getDate() + dayOffset)
      const path = await resolveOrCreateDailyNotePath(rootDir, { date: when })
      if (!path) return 'disabled'
      await dispatchOpenDocumentInTab(rootDir, path, 'daily-note')
      return 'opened'
    },
    [dispatchOpenDocumentInTab, rootDir],
  )

  const dailyStartupRootRef = useRef('')
  useEffect(() => {
    if (!rootDir.trim()) return
    if (dailyStartupRootRef.current === rootDir) return
    dailyStartupRootRef.current = rootDir
    void (async () => {
      try {
        await ensureDefaultTemplateFiles(rootDir)
        if (await shouldOpenDailyNoteOnStartup(rootDir)) {
          await openDailyNoteWithOffset(0)
        }
      } catch {
        /* non-fatal */
      }
    })()
  }, [openDailyNoteWithOffset, rootDir])

  return {
    quitAppSafely,
    openDailyNoteWithOffset,
  }
}
