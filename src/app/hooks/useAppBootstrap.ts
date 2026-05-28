import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { hasAnyDirtyDocument, listDirtyDocumentPaths } from '../../lib/documentDirty'
import { installNavigationRuntimeFirewall } from '../../navigation/navigationRuntimeFirewall'
import { dispatchRestoreNavigation } from '../../navigation/navigationFactory'
import { recordNavigationSideEffect } from '../../navigation/navigationEventValidator'
import { ensureLunaDirs } from '../../lunaPaths'
import { flushLunaWorkspaceSnapshotWrites, readLunaWorkspaceSnapshot, workspaceIdFromRoot } from '../../lunaPersistence'
import { loadAppSettingsFromDisk, saveAppSettingsToDisk } from '../../settings/appSettingsPersistence'
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
    rootDir,
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

  useEffect(() => {
    if (!isTauri() || !rootDir.trim()) return
    void (async () => {
      const settings = await loadAppSettingsFromDisk()
      await saveAppSettingsToDisk({
        ...settings,
        lastWorkspaceRoot: rootDir,
        lastWorkspaceId: workspaceIdFromRoot(rootDir),
      })
    })()
  }, [rootDir])

  const restoredWorkspaceRef = useRef(false)
  useEffect(() => {
    if (!isTauri() || restoredWorkspaceRef.current) return
    restoredWorkspaceRef.current = true
    void (async () => {
      try {
        console.log('[LAUNCH] ensure_luna_dirs')
        await ensureLunaDirs()
        const settings = await loadAppSettingsFromDisk()
        const savedWorkspaceRoot = settings.lastWorkspaceRoot?.trim()
        const savedWorkspaceId = settings.lastWorkspaceId?.trim()
        if (!savedWorkspaceRoot && !savedWorkspaceId) return
        const workspaceId = savedWorkspaceId || workspaceIdFromRoot(savedWorkspaceRoot!)
        console.log('[LAUNCH] load_workspace', { workspaceId })
        const snap = await readLunaWorkspaceSnapshot(workspaceId)
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
        if (!savedRoot) return
        const savedPath = snap?.activePath?.trim() || null
        setRootDir(savedRoot)
        await loadNotes(savedRoot, savedPath, snap?.openTabs ?? [])
      } catch {
        workspaceRestoringRef.current = false
        pendingRestoreEventIdRef.current = null
        setRootDir('')
        setStatus(tRef.current('app.status.workspaceRestoreFailed'))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    void (async () => {
      unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
        if (mainPaneModeRef.current === 'visual' && visualEditorRef.current) {
          let body: string
          try {
            body = visualEditorRef.current.flushPendingMarkdownSync()
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
          if (path && body !== sessionGuardRef.current.content) {
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
    })()
    return () => {
      unlisten?.()
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
