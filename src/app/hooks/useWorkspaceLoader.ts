import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { open } from '@tauri-apps/plugin-dialog'

import type { TranslateFn } from '../../i18n'
import { logError, logInfo } from '../../lib/lunaLogger'
import type { AppStatusTone } from './useAppStatus'
import { hasAnyDirtyDocument } from '../../lib/documentDirty'
import { dispatchDocumentCommand, isDocumentRuntimeTornDownError } from '../../documentRuntime/documentKernel'
import {
  bootstrapKnowledgeOS,
  getWorkspaceRestorePlan,
  teardownKnowledgeOS,
} from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { absolutePathToDocKeyOs } from '../../editor/knowledgeOS/vaultRuntime'
import { recordNavigationSideEffect } from '../../navigation/navigationEventValidator'
import { transitionWorkspaceSession } from '../../documentRuntime/workspaceSessionRuntime'
import { INITIAL_NOTE_MD } from '../workspace/constants'
import { finalizeLeavingWorkspace } from '../workspace/finalizeLeavingWorkspace'
import {
  shouldLeavePreviousWorkspace,
  shouldResetWorkspaceSessionOnUnlockCancel,
} from '../workspace/workspaceSwitchLifecycle'
import { MAX_OPEN_DOCUMENT_TABS, clampOpenTabList } from '../document/openTabLimits'
import { ancestorDirPathsForPaths, pathsEqual } from '../../lib/workspacePathUtils'
import type { FsTreeNode } from '../workspace/types'
import { buildQaKnowledgeFileTree, isQaAppRootOutlineMode } from '../qa/qaAppRootOutlineHarness'
import {
  countMarkdownInTree,
  flattenWorkspaceFiles,
  firstMarkdownInTree,
  pathExistsInTree,
  resolveTreeFilePath,
} from '../workspace/workspaceTree'
import { togglePathInSet } from '../../lib/workspacePathUtils'
import { clearLastWorkspaceSettings, setLastWorkspaceSettings } from '../../settings/appSettingsStore'
import { listWorkspaceTree } from '../../platform/tauri/workspaceService'
import { patchFileTreeModifiedAt } from '../workspace/workspaceTree'
import { ensureWorkspaceAssetScope } from '../../platform/tauri/assetService'
import { startBackgroundWorkspaceIndexing, cancelBackgroundWorkspaceIndexing } from '../workspace/workspaceIndexCoordinator'
import { persistWorkspaceSnapshotNow } from '../../documentRuntime/persistWorkspaceSnapshot'
import { flushLunaWorkspaceSnapshotWrites } from '../../lunaPersistence'
import { flushNoteCalendarEditsWrites } from '../noteCalendar/noteCalendarEditStore'
import { ensureWorkspaceUnlocked } from '../../workspace/workspaceEncryptionRuntime'
import type { WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'

const WORKSPACE_LOAD_SUPERSEDED_ERROR = 'WORKSPACE_LOAD_SUPERSEDED'

export function isWorkspaceLoadSupersededError(error: unknown): boolean {
  return (
    (error instanceof Error && error.message === WORKSPACE_LOAD_SUPERSEDED_ERROR) ||
    isDocumentRuntimeTornDownError(error)
  )
}

export type WorkspaceLoaderDeps = {
  t: TranslateFn
  activePath: string
  content: string
  openedTabs: string[]
  onWorkspaceOpened?: (root: string) => void
  promptUnsavedChanges: (options: {
    title?: string
    message: string
    saveLabel?: string
    discardLabel?: string
    cancelLabel?: string
  }) => Promise<'save' | 'discard' | 'cancel'>
  promptWorkspacePassword: WorkspacePasswordPrompt
  setBufferTabLabels: Dispatch<SetStateAction<Record<string, string>>>
  fileStatRef: MutableRefObject<Record<string, { modifiedSecs: number; size: number }>>
  fileStatGenerationRef: MutableRefObject<number>
  flushEditorToMemoryRef: MutableRefObject<(() => Promise<boolean>) | null>
  saveAllDirtyDocumentsRef: MutableRefObject<(() => Promise<boolean>) | null>
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  setExternalDiskChangedPaths?: Dispatch<SetStateAction<Set<string>>>
}

function perfNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function perfDurationMs(startedAt: number): number {
  return Math.round((perfNowMs() - startedAt) * 10) / 10
}

export function useWorkspaceLoader(deps: WorkspaceLoaderDeps) {
  const {
    t,
    promptUnsavedChanges,
    promptWorkspacePassword,
    setBufferTabLabels,
    fileStatRef,
    fileStatGenerationRef,
    flushEditorToMemoryRef,
    saveAllDirtyDocumentsRef,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    setStatus,
    onWorkspaceOpened,
    setExternalDiskChangedPaths,
  } = deps

  const [rootDir, setRootDir] = useState('')
  const [fileTree, setFileTree] = useState<FsTreeNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set())
  const workspaceRestoringRef = useRef(false)
  const pendingRestoreEventIdRef = useRef<string | null>(null)
  const rootDirRef = useRef('')
  const [workspaceSyncTick, setWorkspaceSyncTick] = useState(0)
  const workspaceRestoreBarrierDepthRef = useRef(0)
  const workspaceLoadVersionRef = useRef(0)
  const workspaceLoadQueueRef = useRef<Promise<unknown>>(Promise.resolve())

  rootDirRef.current = rootDir

  const syncWorkspaceRestoringFlag = useCallback(() => {
    workspaceRestoringRef.current = workspaceRestoreBarrierDepthRef.current > 0
  }, [])

  const acquireWorkspaceRestoreBarrier = useCallback(() => {
    workspaceRestoreBarrierDepthRef.current += 1
    syncWorkspaceRestoringFlag()
  }, [syncWorkspaceRestoringFlag])

  const releaseWorkspaceRestoreBarrier = useCallback(() => {
    workspaceRestoreBarrierDepthRef.current = Math.max(0, workspaceRestoreBarrierDepthRef.current - 1)
    syncWorkspaceRestoringFlag()
  }, [syncWorkspaceRestoringFlag])

  const loadNotes = useCallback(
    async (root: string, preferredPath?: string | null, restoredOpenTabs?: string[] | null): Promise<boolean> => {
      const requestVersion = ++workspaceLoadVersionRef.current
      cancelBackgroundWorkspaceIndexing()
      const waitForTurn = workspaceLoadQueueRef.current.catch(() => undefined)
      const runLoad = async (): Promise<boolean> => {
        acquireWorkspaceRestoreBarrier()
        const loadNotesStartedAt = perfNowMs()
        const throwIfSuperseded = (stage: string): void => {
          if (requestVersion === workspaceLoadVersionRef.current) return
          logInfo('[LAUNCH] loadNotes superseded', { root, requestVersion, stage })
          throw new Error(WORKSPACE_LOAD_SUPERSEDED_ERROR)
        }
        const logLoadNotesStage = (stage: string, extra: Record<string, unknown> = {}) => {
          logInfo('[PERF] loadNotes_stage', {
            root,
            stage,
            requestVersion,
            elapsedMs: perfDurationMs(loadNotesStartedAt),
            preferredPath: preferredPath ?? null,
            restoredOpenTabs: restoredOpenTabs?.length ?? 0,
            ...extra,
          })
        }
        console.info('[LAUNCH] loadNotes start', {
          root,
          requestVersion,
          preferredPath: preferredPath ?? null,
          restoredOpenTabs: restoredOpenTabs?.length ?? 0,
        })
        logLoadNotesStage('start')
        const previousRoot = rootDirRef.current.trim()
        const leavingPreviousRoot = shouldLeavePreviousWorkspace(previousRoot, root)
        const memoryCleanupOptions = {
          previousRoot,
          fileStatRef,
          fileStatGenerationRef,
          setBufferTabLabels,
          setExternalDiskChangedPaths,
        }
        const commitWorkspaceRoot = async (): Promise<void> => {
          throwIfSuperseded('before_commit_root')
          setRootDir(root)
          console.info('[LAUNCH] loadNotes commit root', { root, requestVersion })
          onWorkspaceOpened?.(root)
          await setLastWorkspaceSettings(root).catch((error) => {
            console.warn('[LAUNCH] workspace_restore_hint_persist_failed', error)
          })
          throwIfSuperseded('after_commit_root')
        }
        try {
          throwIfSuperseded('before_transition')
          const unlocked = await ensureWorkspaceUnlocked(root, promptWorkspacePassword, t)
          if (!unlocked) {
            if (shouldResetWorkspaceSessionOnUnlockCancel(previousRoot)) {
              transitionWorkspaceSession({ state: 'idle', rootDir: null, activePath: null, openTabs: [] })
            }
            setStatus(t('workspace.encryption.unlock.cancelled'), 'warning')
            return false
          }
          throwIfSuperseded('after_unlock')
          if (leavingPreviousRoot) {
            await finalizeLeavingWorkspace(previousRoot, memoryCleanupOptions)
            throwIfSuperseded('after_finalize_previous_workspace')
            await dispatchDocumentCommand({
              type: 'SET_TABS',
              tabs: [],
              activePath: '',
              source: 'workspace-switch',
            })
            throwIfSuperseded('after_clear_tabs_for_switch')
          }
          transitionWorkspaceSession({ state: 'restoring', rootDir: root, activePath: null, openTabs: [], error: undefined })
          const bootstrapStartedAt = perfNowMs()
          bootstrapKnowledgeOS(root)
          logLoadNotesStage('bootstrapKnowledgeOS', { durationMs: perfDurationMs(bootstrapStartedAt) })
          throwIfSuperseded('after_bootstrap')
          const listTreeStartedAt = perfNowMs()
          const assetScopePromise = isQaAppRootOutlineMode()
            ? Promise.resolve()
            : ensureWorkspaceAssetScope(root).catch((error) => {
                console.warn('[LAUNCH] ensureWorkspaceAssetScope failed', error)
              })
          const tree = isQaAppRootOutlineMode()
            ? buildQaKnowledgeFileTree()
            : await listWorkspaceTree(root)
          await assetScopePromise
          throwIfSuperseded('after_listWorkspaceTree')
          logLoadNotesStage('listWorkspaceTree', { durationMs: perfDurationMs(listTreeStartedAt) })
          setFileTree(tree)
          const planStartedAt = perfNowMs()
          const flat = flattenWorkspaceFiles(tree, root)
          const treeHas = (p: string) => pathExistsInTree(tree, p)
          const resolveInTree = (p: string | null | undefined): string | null =>
            p?.trim() ? resolveTreeFilePath(tree, p) : null
          const prefer = resolveInTree(preferredPath)
          const restoredTabs = (restoredOpenTabs ?? [])
            .map((p) => resolveInTree(p))
            .filter((p): p is string => Boolean(p))
          let { tabPaths, activePath: restoredActive } = getWorkspaceRestorePlan(treeHas, restoredTabs)
          const droppedTabCount = Math.max(0, tabPaths.length - MAX_OPEN_DOCUMENT_TABS)
          if (droppedTabCount > 0) {
            tabPaths = clampOpenTabList(tabPaths)
            if (restoredActive && !tabPaths.some((p) => pathsEqual(p, restoredActive!))) {
              restoredActive = tabPaths[tabPaths.length - 1] ?? null
            }
            setStatus(
              t('app.status.openTabLimitRestored', {
                max: MAX_OPEN_DOCUMENT_TABS,
                dropped: droppedTabCount,
              }),
              'warning',
            )
          }
          const activeToOpen =
            prefer ??
            resolveInTree(restoredActive) ??
            tabPaths[tabPaths.length - 1] ??
            firstMarkdownInTree(tree)
          const pathsToReveal = [
            ...(activeToOpen ? [activeToOpen] : []),
            ...tabPaths,
          ]
          setExpandedDirs(new Set(ancestorDirPathsForPaths(root, pathsToReveal)))
          const mdCount = countMarkdownInTree(tree)
          logLoadNotesStage('workspacePlan', {
            durationMs: perfDurationMs(planStartedAt),
            markdownCount: mdCount,
            flatFileCount: flat.length,
            restoredTabCount: tabPaths.length,
          })
          throwIfSuperseded('after_workspace_plan')

          const commitRootStartedAt = perfNowMs()
          await commitWorkspaceRoot()
          logLoadNotesStage('commitWorkspaceRoot', { durationMs: perfDurationMs(commitRootStartedAt) })

          if (tabPaths.length > 0) {
            await dispatchDocumentCommand({
              type: 'SET_TABS',
              tabs: tabPaths,
              activePath: activeToOpen ?? undefined,
              source: 'workspace-restore',
            })
            throwIfSuperseded('after_set_tabs')
            if (pendingRestoreEventIdRef.current) {
              recordNavigationSideEffect(pendingRestoreEventIdRef.current, {
                kind: 'restoreTabs',
                source: 'workspace',
                meta: { openTabs: tabPaths.length },
              })
            }
          } else if (activeToOpen) {
            await dispatchDocumentCommand({
              type: 'SET_TABS',
              tabs: [activeToOpen],
              activePath: activeToOpen,
              source: 'workspace-restore',
            })
            throwIfSuperseded('after_set_single_tab')
            if (pendingRestoreEventIdRef.current) {
              recordNavigationSideEffect(pendingRestoreEventIdRef.current, {
                kind: 'restoreTabs',
                source: 'workspace',
                path: activeToOpen,
                meta: { openTabs: 1 },
              })
            }
          } else {
            resetModeSwitchEditorBootstrap()
            bumpColdOpenGeneration()
            await dispatchDocumentCommand({
              type: 'RESTORE_WORKSPACE',
              root,
              activePath: null,
              openTabs: [],
              emptyContent: INITIAL_NOTE_MD,
              source: 'workspace-restore',
            })
            throwIfSuperseded('after_restore_empty_workspace')
            transitionWorkspaceSession({ state: 'ready', rootDir: root, activePath: null, openTabs: [] })
            if (!isQaAppRootOutlineMode()) {
              startBackgroundWorkspaceIndexing(root, flat.map((f) => f.path), {
                activeDocKey: activeToOpen ? absolutePathToDocKeyOs(activeToOpen, root) : null,
                onComplete: ({ noteCount }) => {
                  setStatus(t('app.status.indexedNotes', { count: noteCount }))
                },
                onError: (error) => {
                  console.warn('[LAUNCH] background indexing failed', error)
                  setStatus(t('app.status.indexingFailed'), 'warning')
                },
              })
              setStatus(t('app.status.indexingInBackground', { count: mdCount }))
            } else {
              setStatus(t('app.status.indexedNotes', { count: mdCount }))
            }
            console.info('[LAUNCH] loadNotes done', { root, requestVersion, activePath: null })
            logLoadNotesStage('done', { totalDurationMs: perfDurationMs(loadNotesStartedAt), activePath: null, markdownCount: mdCount })
            return true
          }

          if (activeToOpen) {
            transitionWorkspaceSession({
              state: 'openingInitialDocument',
              rootDir: root,
              activePath: activeToOpen,
              openTabs: tabPaths.length > 0 ? tabPaths : [activeToOpen],
              error: undefined,
            })
            if (pendingRestoreEventIdRef.current) {
              recordNavigationSideEffect(pendingRestoreEventIdRef.current, {
                kind: 'restoreActivePath',
                source: 'workspace',
                path: activeToOpen,
              })
            }
            const restoreWorkspaceStartedAt = perfNowMs()
            try {
              await dispatchDocumentCommand({
                type: 'RESTORE_WORKSPACE',
                root,
                activePath: activeToOpen,
                openTabs: tabPaths.length > 0 ? tabPaths : [activeToOpen],
                source: 'workspace-restore',
              })
              throwIfSuperseded('after_restore_workspace')
              logLoadNotesStage('restoreActiveDocument', {
                durationMs: perfDurationMs(restoreWorkspaceStartedAt),
                activePath: activeToOpen,
                restoredTabCount: tabPaths.length > 0 ? tabPaths.length : 1,
              })
            } catch (restoreError) {
              if (isWorkspaceLoadSupersededError(restoreError)) throw restoreError
              logError('[LAUNCH] restoreActiveDocument failed', {
                root,
                requestVersion,
                activePath: activeToOpen,
                error: restoreError instanceof Error ? restoreError.message : String(restoreError),
              })
              setStatus(
                t('app.status.openFailed', {
                  message: restoreError instanceof Error ? restoreError.message : String(restoreError),
                }),
                'error',
              )
            }
          }

          transitionWorkspaceSession({
            state: 'ready',
            rootDir: root,
            activePath: activeToOpen || null,
            openTabs: tabPaths.length > 0 ? tabPaths : activeToOpen ? [activeToOpen] : [],
            error: undefined,
          })
          if (!isQaAppRootOutlineMode()) {
            startBackgroundWorkspaceIndexing(root, flat.map((f) => f.path), {
              activeDocKey: activeToOpen ? absolutePathToDocKeyOs(activeToOpen, root) : null,
              onComplete: ({ noteCount }) => {
                setStatus(t('app.status.indexedNotes', { count: noteCount }))
              },
              onError: (error) => {
                console.warn('[LAUNCH] background indexing failed', error)
                setStatus(t('app.status.indexingFailed'), 'warning')
              },
            })
            setStatus(t('app.status.indexingInBackground', { count: mdCount }))
          } else {
            setStatus(t('app.status.indexedNotes', { count: mdCount }))
          }
          console.info('[LAUNCH] loadNotes done', { root, requestVersion, activePath: activeToOpen ?? null })
          logLoadNotesStage('done', {
            totalDurationMs: perfDurationMs(loadNotesStartedAt),
            activePath: activeToOpen ?? null,
            markdownCount: mdCount,
            restoredTabCount: tabPaths.length,
          })
          return true
        } catch (error) {
          if (isWorkspaceLoadSupersededError(error)) {
            teardownKnowledgeOS(root)
            return false
          }
          logError('[LAUNCH] loadNotes failed', {
            root,
            requestVersion,
            error: error instanceof Error ? error.message : String(error),
          })
          transitionWorkspaceSession({
            state: 'failed',
            rootDir: root,
            error: error instanceof Error ? error.message : String(error),
          })
          teardownKnowledgeOS(root)
          throw error
        } finally {
          if (requestVersion === workspaceLoadVersionRef.current) {
            pendingRestoreEventIdRef.current = null
          }
          releaseWorkspaceRestoreBarrier()
          setWorkspaceSyncTick((tick) => tick + 1)
        }
      }
      const task = waitForTurn.then(runLoad)
      workspaceLoadQueueRef.current = task.catch(() => undefined)
      return task
    },
    [acquireWorkspaceRestoreBarrier, bumpColdOpenGeneration, fileStatRef, fileStatGenerationRef, onWorkspaceOpened, promptWorkspacePassword, releaseWorkspaceRestoreBarrier, resetModeSwitchEditorBootstrap, setBufferTabLabels, setExternalDiskChangedPaths, setStatus, t],
  )

  const refreshFileTree = useCallback(async () => {
        if (!rootDir) return
        const tree = await listWorkspaceTree(rootDir)
        setFileTree(tree)
  }, [rootDir])

  const touchWorkspaceFileModifiedAt = useCallback((path: string, modifiedAtMs = Date.now()) => {
    setFileTree((prev) => patchFileTreeModifiedAt(prev, path, modifiedAtMs))
  }, [])

  const resolveWorkspaceSwitchUnsavedChoice = useCallback(async (): Promise<'save' | 'discard' | 'cancel'> => {
        if (!hasAnyDirtyDocument()) return 'discard'
        return promptUnsavedChanges({
          title: t('app.unsaved.title'),
          message: t('app.confirm.switchWorkspaceDirty'),
          saveLabel: t('app.unsaved.saveAll'),
          discardLabel: t('app.unsaved.discard'),
          cancelLabel: t('app.unsaved.cancel'),
        })
  }, [promptUnsavedChanges, t])

  const chooseFolder = useCallback(async () => {
        try {
          const flushed = await flushEditorToMemoryRef.current?.()
          if (flushed === false) return
          const dirtyChoice = await resolveWorkspaceSwitchUnsavedChoice()
          if (dirtyChoice === 'cancel') return
          if (dirtyChoice === 'save') {
            const saved = await saveAllDirtyDocumentsRef.current?.()
            if (!saved) return
            await flushNoteCalendarEditsWrites().catch(() => undefined)
          } else if (hasAnyDirtyDocument()) {
            persistWorkspaceSnapshotNow({ clearRecoveryDrafts: true })
            await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
            await flushNoteCalendarEditsWrites().catch(() => undefined)
          }
          const selected = await open({
            directory: true,
            multiple: false,
            title: t('app.dialog.pickWorkspace'),
          })
          if (!selected || Array.isArray(selected)) return
          if (pathsEqual(rootDir.trim(), selected)) return
          const loaded = await loadNotes(selected, null, [])
          if (!loaded) return
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)

          logError('[BOOT] chooseFolder failed', e)
          setStatus(t('app.status.operationFailed', { message }))
        }
  }, [
    loadNotes,
    rootDir,
    t,
    resolveWorkspaceSwitchUnsavedChoice,
    flushEditorToMemoryRef,
    saveAllDirtyDocumentsRef,
    setStatus,
  ])

  const closeWorkspace = useCallback(async () => {
        if (!rootDir) return
        const closingRoot = rootDir
        cancelBackgroundWorkspaceIndexing()
        const flushed = await flushEditorToMemoryRef.current?.()
        if (flushed === false) return
        const dirtyChoice = await resolveWorkspaceSwitchUnsavedChoice()
        if (dirtyChoice === 'cancel') return
        if (dirtyChoice === 'save') {
          const saved = await saveAllDirtyDocumentsRef.current?.()
          if (!saved) return
          await flushNoteCalendarEditsWrites().catch(() => undefined)
        } else if (hasAnyDirtyDocument()) {
          persistWorkspaceSnapshotNow({ clearRecoveryDrafts: true })
          await flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
          await flushNoteCalendarEditsWrites().catch(() => undefined)
        }
        await finalizeLeavingWorkspace(closingRoot, {
          previousRoot: closingRoot,
          fileStatRef,
          fileStatGenerationRef,
          setBufferTabLabels,
          setExternalDiskChangedPaths,
        })
        setFileTree([])
        setExpandedDirs(new Set())
        resetModeSwitchEditorBootstrap()
        bumpColdOpenGeneration()
        await dispatchDocumentCommand({
          type: 'RESTORE_WORKSPACE',
          root: '',
          activePath: null,
          openTabs: [],
          emptyContent: INITIAL_NOTE_MD,
          source: 'workspace-close',
        })
        transitionWorkspaceSession({ state: 'idle', rootDir: null, activePath: null, openTabs: [] })
        setRootDir('')
        await clearLastWorkspaceSettings()
  }, [
    rootDir,
    resolveWorkspaceSwitchUnsavedChoice,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    fileStatRef,
    fileStatGenerationRef,
    flushEditorToMemoryRef,
    saveAllDirtyDocumentsRef,
    setBufferTabLabels,
    setExternalDiskChangedPaths,
    setFileTree,
    setExpandedDirs,
  ])

  const toggleDir = useCallback((path: string) => {
        setExpandedDirs((prev) => togglePathInSet(prev, path))
  }, [])

  return {
    rootDir,
    setRootDir,
    fileTree,
    setFileTree,
    expandedDirs,
    setExpandedDirs,
    loadNotes,
    refreshFileTree,
    touchWorkspaceFileModifiedAt,
    chooseFolder,
    closeWorkspace,
    toggleDir,
    workspaceRestoringRef,
    pendingRestoreEventIdRef,
    workspaceSyncTick,
    acquireWorkspaceRestoreBarrier,
    releaseWorkspaceRestoreBarrier,
  }
}
