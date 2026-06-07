import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import {
  dispatchDocumentCommand,
  isDocumentContentDirty,
} from '../../documentRuntime/documentKernel'
import { hasAnyDirtyDocument, listDirtyDocumentPaths } from '../../lib/documentDirty'
import { installNavigationRuntimeFirewall } from '../../navigation/navigationRuntimeFirewall'
import { dispatchRestoreNavigation } from '../../navigation/navigationFactory'
import { recordNavigationSideEffect } from '../../navigation/navigationEventValidator'
import { logError, logWarn } from '../../lib/lunaLogger'
import { ensureLunaDirs } from '../../lunaPaths'
import { flushLunaWorkspaceSnapshotWrites, readLunaWorkspaceSnapshot, workspaceIdFromRoot } from '../../lunaPersistence'
import {
  getAppSettingsSnapshot,
  clearLastWorkspaceSettings,
  hydrateAppSettingsStore,
} from '../../settings/appSettingsStore'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'

export type AppBootstrapDeps = {
  tRef: RefObject<TranslateFn>
  rootDir: string
  setRootDir: (root: string) => void
  loadNotes: (root: string, prefer?: string | null, tabs?: string[] | null) => Promise<void>
  workspaceRestoringRef: MutableRefObject<boolean>
  pendingRestoreEventIdRef: MutableRefObject<string | null>
  setStatus: (msg: string) => void
  mainPaneModeRef: MutableRefObject<'visual' | 'source'>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  sessionGuardRef: MutableRefObject<{ activePath: string; content: string; openedTabs: string[] }>
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  bufferBodiesRef: MutableRefObject<Record<string, string>>
  saveAllDirtyDocumentsRef: MutableRefObject<(() => Promise<boolean>) | null>
  promptUnsavedChanges: (options: {
    title?: string
    message: string
    saveLabel?: string
    discardLabel?: string
    cancelLabel?: string
  }) => Promise<'save' | 'discard' | 'cancel'>
}

export function useAppBootstrap(deps: AppBootstrapDeps) {
  const {
    tRef,
    setRootDir,
    loadNotes,
    workspaceRestoringRef,
    pendingRestoreEventIdRef,
    setStatus,
    mainPaneModeRef,
    visualEditorRef,
    sessionGuardRef,
    activePathRef,
    contentRef,
    bufferBodiesRef,
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
    if (!isTauri()) return
    const generation = ++workspaceRestoreGenerationRef.current
    let cancelled = false
    void (async () => {
      console.info('[LAUNCH] workspace_restore start', { generation })
      try {
        await ensureLunaDirs()
        if (cancelled) {
          console.info('[LAUNCH] workspace_restore aborted (cancelled after ensureLunaDirs)', { generation })
          return
        }
        await hydrateAppSettingsStore({ force: true })
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
        const snap = await readLunaWorkspaceSnapshot(workspaceId)
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
        await loadNotes(savedRoot, savedPath, snap?.openTabs ?? [])
        console.info('[LAUNCH] workspace_restore loadNotes done', { generation, savedRoot })
      } catch (error) {
        const stale = workspaceRestoreGenerationRef.current !== generation
        logError('[LAUNCH] workspace_restore error', {
          generation,
          cancelled,
          stale,
          error: error instanceof Error ? error.message : String(error),
        })
        if (cancelled || stale) return
        const unavailable = isWorkspaceRestoreUnavailableError(error)
        if (unavailable) logWarn('[LAUNCH] workspace_restore_skipped', error)
        else logError('[LAUNCH] workspace_restore_failed', error)
        const message = error instanceof Error ? error.message : String(error)
        await clearLastWorkspaceSettings().catch((clearError) => {
          logWarn('[LAUNCH] workspace_restore_hint_clear_failed', clearError)
        })
        workspaceRestoringRef.current = false
        pendingRestoreEventIdRef.current = null
        setRootDir('')
        setStatus(
          unavailable
            ? tRef.current('app.status.workspaceRestoreFailed')
            : message
              ? tRef.current('app.status.operationFailed', { message })
              : tRef.current('app.status.workspaceRestoreFailed'),
        )
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
        await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
        const visual = visualEditorRef.current
        const mayHaveUnflushedVisualEdits =
          mainPaneModeRef.current === 'visual' &&
          Boolean(visual?.hasUserEditedSinceDocumentLoad())

        if (!hasAnyDirtyDocument() && !mayHaveUnflushedVisualEdits) {
          return
        }

        if (mainPaneModeRef.current === 'visual' && visual && mayHaveUnflushedVisualEdits) {
          let body: string
          try {
            // Do not emit editor onChange during close; forced serialize without user edits
            // can round-trip to markdown that differs from the on-disk baseline.
            body = visual.flushPendingMarkdownSync(true, false)
          } catch (error) {
            event.preventDefault()
            setStatus(
              tRef.current('app.status.saveFailed', {
                message: error instanceof Error ? error.message : String(error),
              }),
            )
            return
          }
          const path = sessionGuardRef.current.activePath || activePathRef.current
          if (path && isDocumentContentDirty(path, body)) {
            contentRef.current = body
            bufferBodiesRef.current[path] = body
            await dispatchDocumentCommand({
              type: 'DOCUMENT_CONTENT_CHANGED',
              path,
              content: body,
              source: 'window-close-flush',
            }).catch(() => undefined)
          }
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
    activePathRef,
    bufferBodiesRef,
    contentRef,
    mainPaneModeRef,
    promptUnsavedChanges,
    saveAllDirtyDocumentsRef,
    sessionGuardRef,
    setStatus,
    tRef,
    visualEditorRef,
  ])
}
