import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { open } from '@tauri-apps/plugin-dialog'

import type { TranslateFn } from '../../i18n'
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
import { clearTabEditorSessions } from '../document/tabEditorSessionStore'
import type { FsTreeNode } from '../workspace/types'
import {
  collectDirPaths,
  countMarkdownInTree,
  flattenWorkspaceFiles,
  firstMarkdownInTree,
  pathExistsInTree,
  resolveTreeFilePath,
} from '../workspace/workspaceTree'
import { togglePathInSet } from '../../lib/workspacePathUtils'
import { listWorkspaceTree } from '../../platform/tauri/workspaceService'
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
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  setStatus: (msg: string) => void
}

export function useWorkspaceLoader(deps: WorkspaceLoaderDeps) {
  const {
    t,
    activePath,
    content,
    openedTabs,
    confirmAppDialog,
    bufferBodiesRef,
    setBufferTabLabels,
    fileStatRef,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    setStatus,
  } = deps

  const [rootDir, setRootDir] = useState('')
  const [fileTree, setFileTree] = useState<FsTreeNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set())
  const workspaceRestoringRef = useRef(false)
  const pendingRestoreEventIdRef = useRef<string | null>(null)

  const loadNotes = useCallback(
    async (root: string, preferredPath?: string | null, restoredOpenTabs?: string[] | null) => {
          workspaceRestoringRef.current = true
          try {
          transitionWorkspaceSession({ state: 'restoring', rootDir: root, activePath: null, openTabs: [] })
          console.log('[LAUNCH] graph_bootstrap_start', { root })
          bootstrapKnowledgeOS(root)
          const tree = await listWorkspaceTree(root)
          setFileTree(tree)
          setExpandedDirs(new Set(collectDirPaths(tree)))
          const flat = flattenWorkspaceFiles(tree, root)
          const treeHas = (p: string) => pathExistsInTree(tree, p)
          const resolveInTree = (p: string | null | undefined): string | null =>
            p?.trim() ? resolveTreeFilePath(tree, p) : null
          const prefer = resolveInTree(preferredPath)
          const restoredTabs = (restoredOpenTabs ?? [])
            .map((p) => resolveInTree(p))
            .filter((p): p is string => Boolean(p))
          const { tabPaths, activePath: restoredActive } = getWorkspaceRestorePlan(treeHas, restoredTabs)
          const activeToOpen =
            prefer ??
            resolveInTree(restoredActive) ??
            tabPaths[tabPaths.length - 1] ??
            firstMarkdownInTree(tree)
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
            console.log('[LAUNCH] graph_bootstrap_done', { root, mdCount })
            transitionWorkspaceSession({ state: 'ready', rootDir: root, activePath: null, openTabs: [] })
            setStatus(t('app.status.indexedNotes', { count: mdCount }))
            return
          }
    
          transitionWorkspaceSession({ state: 'indexing', rootDir: root })
          await runWorkspaceIndexing(root, flat.map((f) => f.path))
          console.log('[LAUNCH] graph_bootstrap_done', { root, mdCount })
    
          if (activeToOpen) {
            transitionWorkspaceSession({
              state: 'openingInitialDocument',
              rootDir: root,
              activePath: activeToOpen,
              openTabs: tabPaths.length > 0 ? tabPaths : [activeToOpen],
            })
            console.log('[LAUNCH] restore_activePath', { activePath: activeToOpen })
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
    
          transitionWorkspaceSession({
            state: 'ready',
            rootDir: root,
            activePath: activeToOpen || null,
            openTabs: tabPaths.length > 0 ? tabPaths : activeToOpen ? [activeToOpen] : [],
          })
          setStatus(t('app.status.indexedNotes', { count: mdCount }))
          } finally {
            workspaceRestoringRef.current = false
            pendingRestoreEventIdRef.current = null
          }
    },
    [resetModeSwitchEditorBootstrap, bumpColdOpenGeneration, t, setStatus],
  )

  const refreshFileTree = useCallback(async () => {
        if (!rootDir) return
        const tree = await listWorkspaceTree(rootDir)
        setFileTree(tree)
        setExpandedDirs(new Set(collectDirPaths(tree)))
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
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: [],
            activePath: '',
            source: 'workspace-switch',
          })
          setRootDir(selected)
          await loadNotes(selected, null, [])
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
           
          console.error('[BOOT] chooseFolder failed:', e)
          setStatus(t('app.status.operationFailed', { message }))
        }
  }, [activePath, content, openedTabs, loadNotes, t, confirmAppDialog])

  const closeWorkspace = useCallback(async () => {
        if (!rootDir) return
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
  }, [
    activePath,
    content,
    rootDir,
    confirmAppDialog,
    t,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
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
  }
}
