import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { open } from '@tauri-apps/plugin-dialog'

import type { TranslateFn } from '../../i18n'
import { logError } from '../../lib/lunaLogger'
import type { AppStatusTone } from './useAppStatus'
import { hasAnyDirtyDocument } from '../../lib/documentDirty'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import {
  bootstrapKnowledgeOS,
  getWorkspaceRestorePlan,
  teardownKnowledgeOS,
} from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { recordNavigationSideEffect } from '../../navigation/navigationEventValidator'
import { transitionWorkspaceSession } from '../../documentRuntime/workspaceSessionRuntime'
import { INITIAL_NOTE_MD, isBufferTabId } from '../workspace/constants'
import { clearTabBodies } from '../document/tabBodiesStore'
import { MAX_OPEN_DOCUMENT_TABS, clampOpenTabList } from '../document/openTabLimits'
import { clearTabEditorSessions } from '../document/tabEditorSessionStore'
import { ancestorDirPathsForPaths, pathsEqual } from '../../lib/workspacePathUtils'
import type { FsTreeNode } from '../workspace/types'
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
import { ensureWorkspaceAssetScope } from '../../platform/tauri/assetService'
import { runWorkspaceIndexing } from '../workspace/workspaceIndexCoordinator'

export type WorkspaceLoaderDeps = {
  t: TranslateFn
  activePath: string
  content: string
  openedTabs: string[]
  confirmAppDialog: (options: {
    title: string
    message: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
  bufferBodiesRef: MutableRefObject<Record<string, string>>
  setBufferTabLabels: Dispatch<SetStateAction<Record<string, string>>>
  fileStatRef: MutableRefObject<Record<string, { modifiedSecs: number; size: number }>>
  flushEditorToMemoryRef: MutableRefObject<(() => Promise<boolean>) | null>
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
}

export function useWorkspaceLoader(deps: WorkspaceLoaderDeps) {
  const {
    t,
    activePath,
    content,
    confirmAppDialog,
    bufferBodiesRef,
    setBufferTabLabels,
    fileStatRef,
    flushEditorToMemoryRef,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    setStatus,
  } = deps

  const [rootDir, setRootDir] = useState('')
  const [fileTree, setFileTree] = useState<FsTreeNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set())
  const workspaceRestoringRef = useRef(false)
  const pendingRestoreEventIdRef = useRef<string | null>(null)
  const [workspaceSyncTick, setWorkspaceSyncTick] = useState(0)

  const loadNotes = useCallback(
    async (root: string, preferredPath?: string | null, restoredOpenTabs?: string[] | null) => {
      console.info('[LAUNCH] loadNotes start', {
        root,
        preferredPath: preferredPath ?? null,
        restoredOpenTabs: restoredOpenTabs?.length ?? 0,
      })
      workspaceRestoringRef.current = true
      const commitWorkspaceRoot = async (): Promise<void> => {
        setRootDir(root)
        console.info('[LAUNCH] loadNotes commit root', { root })
        await setLastWorkspaceSettings(root).catch((error) => {
          console.warn('[LAUNCH] workspace_restore_hint_persist_failed', error)
        })
      }
      try {
        transitionWorkspaceSession({ state: 'restoring', rootDir: root, activePath: null, openTabs: [] })
        bootstrapKnowledgeOS(root)
        const tree = await listWorkspaceTree(root)
        setRootDir(root)
        await ensureWorkspaceAssetScope(root)
        setFileTree(tree)
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

        if (tabPaths.length > 0) {
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: tabPaths,
            activePath: activeToOpen ?? undefined,
            source: 'workspace-restore',
          })
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
          transitionWorkspaceSession({ state: 'indexing', rootDir: root, activePath: null, openTabs: [] })
          await runWorkspaceIndexing(root, flat.map((f) => f.path))
          await commitWorkspaceRoot()
          transitionWorkspaceSession({ state: 'ready', rootDir: root, activePath: null, openTabs: [] })
          setStatus(t('app.status.indexedNotes', { count: mdCount }))
          console.info('[LAUNCH] loadNotes done', { root, activePath: null })
          return
        }

        transitionWorkspaceSession({ state: 'indexing', rootDir: root })
        await runWorkspaceIndexing(root, flat.map((f) => f.path))

        if (activeToOpen) {
          transitionWorkspaceSession({
            state: 'openingInitialDocument',
            rootDir: root,
            activePath: activeToOpen,
            openTabs: tabPaths.length > 0 ? tabPaths : [activeToOpen],
          })
          if (pendingRestoreEventIdRef.current) {
            recordNavigationSideEffect(pendingRestoreEventIdRef.current, {
              kind: 'restoreActivePath',
              source: 'workspace',
              path: activeToOpen,
            })
          }
          await dispatchDocumentCommand({
            type: 'RESTORE_WORKSPACE',
            root,
            activePath: activeToOpen,
            openTabs: tabPaths.length > 0 ? tabPaths : [activeToOpen],
            source: 'workspace-restore',
          })
        }

        await commitWorkspaceRoot()
        transitionWorkspaceSession({
          state: 'ready',
          rootDir: root,
          activePath: activeToOpen || null,
          openTabs: tabPaths.length > 0 ? tabPaths : activeToOpen ? [activeToOpen] : [],
        })
        setStatus(t('app.status.indexedNotes', { count: mdCount }))
        console.info('[LAUNCH] loadNotes done', { root, activePath: activeToOpen ?? null })
      } catch (error) {
        logError('[LAUNCH] loadNotes failed', {
          root,
          error: error instanceof Error ? error.message : String(error),
        })
        teardownKnowledgeOS(root)
        throw error
      } finally {
        workspaceRestoringRef.current = false
        pendingRestoreEventIdRef.current = null
        setWorkspaceSyncTick((tick) => tick + 1)
      }
    },
    [resetModeSwitchEditorBootstrap, bumpColdOpenGeneration, t, setStatus],
  )

  const refreshFileTree = useCallback(async () => {
        if (!rootDir) return
        const tree = await listWorkspaceTree(rootDir)
        setFileTree(tree)
  }, [rootDir])

  const chooseFolder = useCallback(async () => {
        try {
          if (activePath && isBufferTabId(activePath)) {
            bufferBodiesRef.current[activePath] = content
          }
          if (hasAnyDirtyDocument()) {
            const ok = await confirmAppDialog({
              title: t('app.confirm.title'),
              message: t('app.confirm.switchWorkspaceDirty'),
              variant: 'warning',
            })
            if (!ok) {
              return
            }
          }
          const selected = await open({
            directory: true,
            multiple: false,
            title: t('app.dialog.pickWorkspace'),
          })
          if (!selected || Array.isArray(selected)) return
          if (rootDir) teardownKnowledgeOS(rootDir)
          bufferBodiesRef.current = {}
          clearTabBodies()
          clearTabEditorSessions()
          fileStatRef.current = {}
          setBufferTabLabels({})
          setRootDir('')
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: [],
            activePath: '',
            source: 'workspace-switch',
          })
          await loadNotes(selected, null, [])
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)

          logError('[BOOT] chooseFolder failed', e)
          setStatus(t('app.status.operationFailed', { message }))
        }
  }, [
    activePath,
    content,
    loadNotes,
    rootDir,
    t,
    confirmAppDialog,
    bufferBodiesRef,
    fileStatRef,
    setBufferTabLabels,
    setStatus,
  ])

  const closeWorkspace = useCallback(async () => {
        if (!rootDir) return
        const flushed = await flushEditorToMemoryRef.current?.()
        if (flushed === false) return
        if (activePath && isBufferTabId(activePath)) {
          bufferBodiesRef.current[activePath] = content
        }
        if (hasAnyDirtyDocument()) {
          const ok = await confirmAppDialog({
            title: t('app.confirm.title'),
            message: t('app.confirm.switchWorkspaceDirty'),
            variant: 'warning',
          })
          if (!ok) return
        }
        teardownKnowledgeOS(rootDir)
        bufferBodiesRef.current = {}
        clearTabBodies()
        clearTabEditorSessions()
        fileStatRef.current = {}
        setBufferTabLabels({})
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
    activePath,
    content,
    rootDir,
    confirmAppDialog,
    t,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    bufferBodiesRef,
    fileStatRef,
    flushEditorToMemoryRef,
    setBufferTabLabels,
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
    chooseFolder,
    closeWorkspace,
    toggleDir,
    workspaceRestoringRef,
    pendingRestoreEventIdRef,
    workspaceSyncTick,
  }
}
