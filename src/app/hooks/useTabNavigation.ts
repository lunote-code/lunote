import {
  useCallback,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react'
import { INITIAL_NOTE_MD, isBufferTabId, newBufferTabId } from '../workspace/constants'
import { dismissDocumentHistoryIfOpen } from '../workspace/documentHistoryNavigation'
import { deleteTabBody, getTabBody, pruneTabBodiesExcept, clearLiveTabBody } from '../document/tabBodiesStore'
import {
  MAX_OPEN_DOCUMENT_TABS,
  isPathInOpenTabs,
  wouldExceedOpenTabLimit,
  wouldExceedOpenTabLimitForPaths,
} from '../document/openTabLimits'
import { openSaveConflictDialog, type SaveConflictState } from '../document/saveConflictState'
import { promptExternalDriftConflict } from '../document/saveConflictPrompt'
import { resolveLatestDocumentBody } from '../../documentRuntime/documentAuthority'
import {
  deleteTabEditorSession,
  getTabEditorSession,
  setTabEditorSession,
  type TabEditorSession,
} from '../document/tabEditorSessionStore'
import { EditorOpenReason } from '../../editor/editorOpenReason'
import type { EditorView } from '@codemirror/view'
import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  getDocumentSavedContent,
} from '../../documentRuntime/documentKernel'
import { isAutosaveSuspended } from '../../documentHistory/historyRestoreState'
import { persistWorkspaceSnapshotNow } from '../../documentRuntime/persistWorkspaceSnapshot'
import { postWorkspaceBroadcast } from '../workspace/workspaceBroadcast'
import { useAutosave } from './useAutosave'
import { useWorkspaceAutoLock } from './useWorkspaceAutoLock'
import { isPathDirty, listDirtyDocumentPaths } from '../../lib/documentDirty'
import { decideMemoryFlushCommit } from '../../lib/memoryFlushDirty'
import {
  bodyOffsetToSourceOffset,
  computeLeadingFrontmatterPrefixLength,
  sourceSelectionToBodySelection,
  splitFullSourceMarkdown,
} from '../../editor/documentFrontmatterOffsets'
import { getSourceModeIdentity } from '../../editor/sourceModeIdentity'
import type { FlushEditorToMemoryOptions } from '../../lib/editorContentSync'
import {
  commitLatestDocumentBodyToMemory,
  diskMarkdownForDocumentSave,
  projectDocumentMemorySurfaces,
  resolveActiveAwareSaveBodyFallback,
  tryResolveBoundEditorMarkdown,
} from '../../lib/editorContentSync'
import { enqueueSave } from '../../lib/saveQueue'
import { enqueueTabMutationOperation } from '../../lib/tabOperationQueue'
import { moveItemInArray } from '../../lib/moveItemInArray'
import {
  filterOutPath,
  pathInList,
  pathsEqual,
  upsertPathInList,
} from '../../lib/workspacePathUtils'
import { evictStepLog } from '../../vm/vmStepLog'
import { removeDocumentReferences } from '../../assets/assetReferenceTracker'
import type { TranslateFn } from '../../i18n'
import type { EditorDocMenuState, FileContextMenuState, TabContextMenuPick } from '../workspace/contextMenuTypes'
import type { AtomicVisualDocumentEnter, TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { runAfterReactCommit } from '../../editor/reactCommitScheduler'
import { schedulePrimeEditorDiagramPreviews } from '../../editor/runtimeEngine/primeEditorDiagramPreviews'
import type { AppStatusTone } from './useAppStatus'
import {
  checkBlankContentSuspect,
  logTabNav,
  snapshotDocumentBodyMeta,
} from '../../lib/tabNavigationDebug'
import { waitForEditorSurfaceReady } from '../../lib/waitForEditorSurfaceReady'
import { clearExternalDiskDriftInState, hasExternalDiskDriftInState } from '../../lib/externalDiskDriftState'
import type { WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'
import {
  StaleWorkspaceSaveAbortedError,
  WorkspaceSaveUnlockCancelledError,
  dispatchSaveDocumentWithEncryptionRetry,
} from '../../workspace/encryptedDocumentSave'
import {
  formatWorkspaceEncryptionErrorMessage,
} from '../../workspace/workspaceEncryptionErrors'
import { isWorkspaceMigratingError } from '../../platform/tauri/workspaceEncryptionService'
import { readDocument } from '../../io/documentIO'

export type TabNavigationDeps = {
  t: TranslateFn
  rootDir: string
  rootDirRef: MutableRefObject<string>
  activePath: string
  openedTabs: string[]
  mainPaneMode: 'visual' | 'source'
  externalDiskChangedPaths: Set<string>
  documentHistoryOpen: boolean
  closeDocumentHistoryDialog: () => void
  setExternalDiskChangedPaths: Dispatch<SetStateAction<Set<string>>>
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setSavedAt: Dispatch<SetStateAction<string>>
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  setBufferTabLabels: Dispatch<SetStateAction<Record<string, string>>>
  setTabContextMenu: Dispatch<SetStateAction<{
    x: number
    y: number
    path: string
    index: number
    total: number
  } | null>>
  setFileContextMenu: Dispatch<SetStateAction<FileContextMenuState | null>>
  setEditorDocMenu: Dispatch<SetStateAction<EditorDocMenuState | null>>
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: RefObject<EditorView | null>
  sourceCodeMirrorBootSelectionRef: MutableRefObject<{
    from: number
    to: number
    scrollTop?: number
    scrollRatio?: number
  } | null>
  setAtomicVisualDocumentEnter: Dispatch<SetStateAction<AtomicVisualDocumentEnter | null>>
  setEditorOpenReason: Dispatch<SetStateAction<import('../../editor/editorOpenReason').EditorOpenReason>>
  documentNavigationInProgressRef: MutableRefObject<boolean>
  setEditorDocumentLoading: Dispatch<SetStateAction<boolean>>
  tabNavGenerationRef: MutableRefObject<number>
  suppressWorkspaceRefreshUntilRef: MutableRefObject<number>
  saveAllDirtyDocumentsRef: MutableRefObject<(() => Promise<boolean>) | null>
  leaveCurrentTabRef: MutableRefObject<(() => Promise<boolean>) | null>
  flushEditorToMemoryRef: MutableRefObject<(() => Promise<boolean>) | null>
  saveCurrent: (manual?: boolean) => Promise<void>
  confirmAppDialog: (opts: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
  promptUnsavedChanges: (opts: { message: string }) => Promise<'save' | 'discard' | 'cancel'>
  showAppAlert: (opts: { title: string; message: string; okLabel?: string }) => Promise<void>
  workspaceRestoringRef: MutableRefObject<boolean>
  focusActiveEditor: () => void
  resetModeSwitchEditorBootstrap: () => void
  logModeSwitchState: (phase: string) => void
  bumpColdOpenGeneration: () => void
  beginNavigationReveal: () => number
  revealNavigationAnchorAfterOpen: (path: string, markdown: string, generation: number) => Promise<void>
  flushPendingKernelContentDebounce: () => Promise<void>
  promptWorkspacePassword?: WorkspacePasswordPrompt
  onWorkspaceDocumentSaved?: (path: string, savedAtMs?: number) => void
}

export function useTabNavigation(deps: TabNavigationDeps) {
  const {
    t,
    rootDir,
    rootDirRef,
    activePath,
    openedTabs,
    mainPaneMode,
    externalDiskChangedPaths,
    documentHistoryOpen,
    closeDocumentHistoryDialog,
    setExternalDiskChangedPaths,
    setSaveConflict,
    setSavedAt,
    setStatus,
    setBufferTabLabels,
    setTabContextMenu,
    setFileContextMenu,
    setEditorDocMenu,
    activePathRef,
    contentRef,
    visualEditorRef,
    editorViewRef,
    sourceCodeMirrorBootSelectionRef,
    setAtomicVisualDocumentEnter,
    setEditorOpenReason,
    documentNavigationInProgressRef,
    setEditorDocumentLoading,
    tabNavGenerationRef,
    suppressWorkspaceRefreshUntilRef,
    saveAllDirtyDocumentsRef,
    leaveCurrentTabRef,
    flushEditorToMemoryRef,
    saveCurrent,
    promptUnsavedChanges,
    showAppAlert,
    workspaceRestoringRef,
    focusActiveEditor,
    resetModeSwitchEditorBootstrap,
    logModeSwitchState,
    bumpColdOpenGeneration,
    beginNavigationReveal,
    revealNavigationAnchorAfterOpen,
    flushPendingKernelContentDebounce,
    promptWorkspacePassword,
    onWorkspaceDocumentSaved,
  } = deps

  const dismissHistoryOverlayForNavigation = useCallback(() => {
    dismissDocumentHistoryIfOpen({
      documentHistoryOpen,
      closeDocumentHistoryDialog,
    })
  }, [closeDocumentHistoryDialog, documentHistoryOpen])

  const warnOpenTabLimitReached = useCallback(async () => {
    await showAppAlert({
      title: t('app.confirm.openTabLimit.title'),
      message: t('app.confirm.openTabLimit.message', { max: MAX_OPEN_DOCUMENT_TABS }),
    })
    setStatus(t('app.status.openTabLimit', { max: MAX_OPEN_DOCUMENT_TABS }), 'warning')
  }, [showAppAlert, setStatus, t])

  const captureTabEditorSession = useCallback(
    (tabPath: string) => {
      if (!tabPath) return
      const session: TabEditorSession = {}
      if (mainPaneMode === 'visual') {
        const surface = visualEditorRef.current
        const bound = surface?.getBoundDocumentKey() ?? ''
        if (surface && pathsEqual(bound, tabPath)) {
          const pm = surface.getEditor()
          if (pm) {
            session.visual = {
              pmAnchor: pm.state.selection.anchor,
              pmHead: pm.state.selection.head,
              scrollRatio: surface.getProseMirrorScrollRatio() ?? undefined,
            }
          }
        }
      } else {
        if (!pathsEqual(activePathRef.current, tabPath)) return
        const view = editorViewRef.current
        if (view) {
          const fullMd = view.state.doc.toString()
          const { anchor, head } = view.state.selection.main
          const { body, frontmatterPrefixLength } = splitFullSourceMarkdown(fullMd)
          const bodySel = sourceSelectionToBodySelection(
            anchor,
            head,
            frontmatterPrefixLength,
            body.length,
          )
          session.source = {
            bodyFrom: bodySel.bodyAnchor,
            bodyTo: bodySel.bodyHead,
            scrollTop: view.scrollDOM.scrollTop,
          }
        }
      }
      if (session.visual || session.source) {
        setTabEditorSession(tabPath, session)
      }
    },
    [activePathRef, editorViewRef, mainPaneMode, visualEditorRef],
  )

  const applyTabEditorSession = useCallback(
    (tabPath: string) => {
      const session = getTabEditorSession(tabPath)
      if (!session) return
      if (mainPaneMode === 'visual' && session.visual) {
        setAtomicVisualDocumentEnter({
          documentKey: tabPath,
          pmAnchor: session.visual.pmAnchor,
          pmHead: session.visual.pmHead,
          scrollRatio: session.visual.scrollRatio,
        })
        setEditorOpenReason(EditorOpenReason.ModeSwitchRestore)
      } else if (mainPaneMode === 'source' && session.source) {
        const snap = getDocumentRuntimeSnapshot()
        const identity =
          getSourceModeIdentity(tabPath) ||
          (pathsEqual(snap.activePath, tabPath) ? snap.content : '') ||
          ''
        const prefix = computeLeadingFrontmatterPrefixLength(identity)
        const sourceLen = identity.length
        sourceCodeMirrorBootSelectionRef.current = {
          from: bodyOffsetToSourceOffset(session.source.bodyFrom, prefix, sourceLen),
          to: bodyOffsetToSourceOffset(session.source.bodyTo, prefix, sourceLen),
          scrollTop: session.source.scrollTop,
        }
        setEditorOpenReason(EditorOpenReason.ModeSwitchRestore)
      }
    },
    [
      mainPaneMode,
      setAtomicVisualDocumentEnter,
      setEditorOpenReason,
      sourceCodeMirrorBootSelectionRef,
    ],
  )

  /** Prefer tab body cache whenever present; cold load only after explicit cache invalidation. */
  const shouldUseCachedBody = useCallback((path: string, cached: string | undefined): cached is string => {
    if (cached == null) return false
    if (isBufferTabId(path)) return true
    // An empty cache for a disk-backed tab usually means "never loaded", not an empty file.
    return cached.length > 0
  }, [])

  const resolveDocumentBodyForPath = useCallback(
    (path: string, contentFallback?: string) => {
      return resolveLatestDocumentBody(path, { contentFallback })
    },
    [],
  )

  const beginDocumentNavigation = useCallback(() => {
    documentNavigationInProgressRef.current = true
    setEditorDocumentLoading(true)
  }, [documentNavigationInProgressRef, setEditorDocumentLoading])

  const endDocumentNavigation = useCallback(() => {
    documentNavigationInProgressRef.current = false
    setEditorDocumentLoading(false)
  }, [documentNavigationInProgressRef, setEditorDocumentLoading])

  const finishDocumentNavigation = useCallback(
    async (path?: string) => {
      if (path?.trim()) {
        await waitForEditorSurfaceReady({
          mainPaneMode,
          visualEditorRef,
          path: path.trim(),
          contentRef,
        })
      }
      endDocumentNavigation()
    },
    [contentRef, endDocumentNavigation, mainPaneMode, visualEditorRef],
  )

  const isSuspiciousWhitespaceCache = useCallback((path: string, cached: string | undefined): boolean => {
    if (!path || isBufferTabId(path) || cached == null) return false
    return cached.length <= 2 && cached.trim().length === 0
  }, [])

  const isSuspiciousVisualFlushShrink = useCallback(
    (nextBody: string, previousBody: string | undefined, savedBody: string | undefined): boolean => {
      const trimmedNext = nextBody.trim()
      if (trimmedNext.length > 0) return false
      const previousLength = previousBody?.trim().length ?? 0
      const savedLength = savedBody?.trim().length ?? 0
      return nextBody.length <= 2 && (previousLength > 32 || savedLength > 32)
    },
    [],
  )

  const normalizeDocumentContentIfNeeded = useCallback(
    async (path: string, body: string, source: string) => {
      const projected = projectDocumentMemorySurfaces(path, body)
      commitLatestDocumentBodyToMemory({
        path,
        body: projected.editorSurface,
        sourceIdentity: projected.sourceIdentity,
        contentRef,
      })
      await dispatchDocumentCommand({
        type: 'NORMALIZE_DOCUMENT_CONTENT',
        path,
        content: body,
        source,
      })
    },
    [contentRef],
  )

  /** Write the current editor text to the document kernel, without writing to disk*/
  const flushEditorToMemory = useCallback(async (options?: FlushEditorToMemoryOptions): Promise<boolean> => {
    await flushPendingKernelContentDebounce()
    try {
    const pathToLeave = activePathRef.current
    if (!pathToLeave) return true
    if (!isPathDirty(pathToLeave)) {
      if (!options?.skipTabSessionCapture) {
        captureTabEditorSession(pathToLeave)
      }
      return true
    }
    const contentSnapshot = contentRef.current
    const tabBodySnapshot = resolveDocumentBodyForPath(pathToLeave, contentSnapshot)
    const savedBeforeFlush = getDocumentSavedContent(pathToLeave)
    let body: string
    let bodySource: 'editor' | 'fallback' = 'fallback'
    const visualSurface = visualEditorRef.current
    const editorBoundToLeaving =
      mainPaneMode === 'visual' &&
      visualSurface &&
      pathsEqual(visualSurface.getBoundDocumentKey(), pathToLeave)
    const hasUserEdited = Boolean(editorBoundToLeaving && visualSurface?.hasUserEditedSinceDocumentLoad())
    const readFallbackBody = () =>
      resolveActiveAwareSaveBodyFallback({
        pathToSave: pathToLeave,
        tabBodySnapshot,
        contentSnapshot,
        activePath: activePathRef.current,
        activeContent: contentRef.current,
        resolveDocumentBody: resolveDocumentBodyForPath,
      })
    if (editorBoundToLeaving && hasUserEdited) {
      let resolved: string | null
      try {
        resolved = await tryResolveBoundEditorMarkdown(
          mainPaneMode,
          visualSurface,
          contentSnapshot,
          pathToLeave,
          () => activePathRef.current,
          options,
        )
      } catch (error) {
        setStatus(t('app.status.saveFailed', { message: error instanceof Error ? error.message : String(error) }), 'error')
        return false
      }
      if (resolved != null) {
        body = resolved
        bodySource = 'editor'
        logTabNav('memory-flush-resolved', {
          path: pathToLeave,
          bodySource,
          currentActivePath: activePathRef.current,
          boundDocumentKey: visualSurface?.getBoundDocumentKey() ?? null,
          resolved: snapshotDocumentBodyMeta(pathToLeave, resolved),
          contentSnapshot: snapshotDocumentBodyMeta(pathToLeave, contentSnapshot),
          tabBodySnapshot: snapshotDocumentBodyMeta(pathToLeave, tabBodySnapshot),
          savedBeforeFlush: snapshotDocumentBodyMeta(pathToLeave, savedBeforeFlush),
        })
      } else {
        const fallback = readFallbackBody()
        if (fallback == null) {
          setStatus(t('app.status.saveFlushFailed'), 'warning')
          return false
        }
        body = fallback
      }
    } else {
      const fallback = readFallbackBody()
      if (fallback == null) {
        setStatus(t('app.status.saveFlushFailed'), 'warning')
        return false
      }
      body = fallback
    }

    if (
      editorBoundToLeaving &&
      bodySource === 'editor' &&
      isSuspiciousVisualFlushShrink(body, contentSnapshot, savedBeforeFlush)
    ) {
      const protectedBody =
        (contentSnapshot.trim().length > 0 ? contentSnapshot : undefined) ??
        (tabBodySnapshot && tabBodySnapshot.trim().length > 0 ? tabBodySnapshot : undefined) ??
        (savedBeforeFlush && savedBeforeFlush.trim().length > 0 ? savedBeforeFlush : undefined)
      if (protectedBody != null) {
        logTabNav('memory-flush-guard', {
          path: pathToLeave,
          reason: 'suspicious-visual-flush-shrink',
          boundDocumentKey: visualSurface?.getBoundDocumentKey() ?? null,
          rejected: snapshotDocumentBodyMeta(pathToLeave, body),
          replacement: snapshotDocumentBodyMeta(pathToLeave, protectedBody),
          contentSnapshot: snapshotDocumentBodyMeta(pathToLeave, contentSnapshot),
          tabBodySnapshot: snapshotDocumentBodyMeta(pathToLeave, tabBodySnapshot),
          savedBeforeFlush: snapshotDocumentBodyMeta(pathToLeave, savedBeforeFlush),
        })
        body = protectedBody
      }
    }

    const savedBaseline = savedBeforeFlush ?? getDocumentSavedContent(pathToLeave)
    const flushCommit = decideMemoryFlushCommit({
      path: pathToLeave,
      flushedBody: body,
      savedContent: savedBaseline,
      normalizeMarkdownForCompare: visualSurface?.normalizeMarkdownForCompare,
    })
    if (flushCommit.action === 'normalize') {
      await normalizeDocumentContentIfNeeded(pathToLeave, flushCommit.content, 'normalize-on-tab-switch')
      if (!options?.skipTabSessionCapture) {
        captureTabEditorSession(pathToLeave)
      }
      return true
    }
    const projectedFlush = projectDocumentMemorySurfaces(pathToLeave, flushCommit.content)
    commitLatestDocumentBodyToMemory({
      path: pathToLeave,
      body: projectedFlush.editorSurface,
      sourceIdentity: projectedFlush.sourceIdentity,
      contentRef,
    })
    if (flushCommit.action === 'content-changed') {
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: pathToLeave,
        content: projectedFlush.editorSurface,
        source: 'memory-flush',
      })
    }
    if (!options?.skipTabSessionCapture) {
      captureTabEditorSession(pathToLeave)
    }
    return true
    } finally {
      clearLiveTabBody()
    }
  }, [
    activePathRef,
    flushPendingKernelContentDebounce,
    contentRef,
    isSuspiciousVisualFlushShrink,
    mainPaneMode,
    normalizeDocumentContentIfNeeded,
    captureTabEditorSession,
    resolveDocumentBodyForPath,
    setStatus,
    t,
    visualEditorRef,
  ])

  const saveDocumentAtPath = useCallback(
    async (
      path: string,
      mode: 'manual' | 'autosave' = 'manual',
      allowUnlockRetry = true,
    ): Promise<boolean> => {
      if (!path) return false
      if (isBufferTabId(path)) {
        if (!pathsEqual(path, activePathRef.current)) return false
        await saveCurrent(true)
        return !isPathDirty(path)
      }
      if (!rootDir) return false
      const rootAtRequest = rootDir
      if (mode === 'autosave' && isAutosaveSuspended(path)) return true
      if (pathsEqual(path, activePathRef.current)) {
        const flushed = await flushEditorToMemory()
        if (!flushed) return false
      }
      const contentSnapshot = pathsEqual(path, activePathRef.current) ? contentRef.current : undefined
      const tabBodySnapshot = resolveDocumentBodyForPath(path, contentSnapshot)
      try {
        await enqueueSave(async () => {
          let body =
            resolveDocumentBodyForPath(path, contentSnapshot) ??
            tabBodySnapshot ??
            (contentSnapshot !== undefined ? contentSnapshot : undefined)
          if (body == null && rootAtRequest && !isBufferTabId(path) && !isPathDirty(path)) {
            try {
              body = await readDocument(rootAtRequest, path)
            } catch {
              throw new Error(t('app.status.saveNothingHint'))
            }
          }
          if (body == null) {
            throw new Error(t('app.status.saveNothingHint'))
          }
          const diskMarkdown = diskMarkdownForDocumentSave(path, body)
          const unlockRetryAllowed = allowUnlockRetry && mode === 'manual'
          await dispatchSaveDocumentWithEncryptionRetry({
            rootAtRequest,
            getCurrentRootDir: () => rootDirRef.current,
            path,
            content: diskMarkdown,
            source: mode === 'autosave' ? 'autosave-document' : 'save-document',
            allowUnlockRetry: unlockRetryAllowed,
            promptWorkspacePassword,
            t,
          })
        })
        suppressWorkspaceRefreshUntilRef.current = Date.now() + 2500
        setSavedAt(new Date().toLocaleTimeString())
        setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, path))
        onWorkspaceDocumentSaved?.(path, Date.now())
        postWorkspaceBroadcast({ type: 'document-saved', root: rootAtRequest, path })
        return true
      } catch (e) {
        if (e instanceof StaleWorkspaceSaveAbortedError) {
          return mode === 'autosave'
        }
        if (e instanceof WorkspaceSaveUnlockCancelledError) {
          if (mode === 'manual') {
            setStatus(t('workspace.encryption.unlock.cancelled'), 'warning')
          }
          return false
        }
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('FILE_CONFLICT') && rootAtRequest) {
          const local =
            resolveDocumentBodyForPath(path, contentSnapshot) ??
            tabBodySnapshot ??
            (contentSnapshot !== undefined ? contentSnapshot : '')
          await openSaveConflictDialog({
            rootDir: rootAtRequest,
            path,
            local,
            sourceMode: mode,
            setSaveConflict,
            setStatus,
            t,
          })
          return false
        }
        const encryptionMessage = formatWorkspaceEncryptionErrorMessage(e, t)
        if (encryptionMessage || isWorkspaceMigratingError(e)) {
          if (mode === 'manual') {
            setStatus(encryptionMessage ?? t('workspace.encryption.error.migrating'), 'warning')
          }
          return false
        }
        if (mode === 'manual') {
          setStatus(t('app.status.saveFailed', { message }), 'error')
        }
        return false
      }
    },
    [activePathRef, contentRef, flushEditorToMemory, onWorkspaceDocumentSaved, promptWorkspacePassword, resolveDocumentBodyForPath, rootDir, rootDirRef, saveCurrent, setExternalDiskChangedPaths, setSaveConflict, setSavedAt, setStatus, suppressWorkspaceRefreshUntilRef, t],
  )

  const saveAllDirtyDocuments = useCallback(async (mode: 'manual' | 'autosave' = 'manual'): Promise<boolean> => {
    const flushed = await flushEditorToMemory()
    if (!flushed) return false
    const dirtyPaths = listDirtyDocumentPaths()
    const workspaceDirty = dirtyPaths.filter((p) => !isBufferTabId(p))
    const bufferDirty = dirtyPaths.filter((p) => isBufferTabId(p))
    for (const path of workspaceDirty) {
      if (mode === 'autosave' && isAutosaveSuspended(path)) continue
      const ok = await saveDocumentAtPath(path, mode)
      if (!ok) return false
    }
    for (const path of bufferDirty) {
      if (mode === 'autosave') continue
      if (!pathsEqual(path, activePathRef.current)) {
        setStatus(t('app.status.bufferSaveActiveTabHint'), 'info')
        return false
      }
      const ok = await saveDocumentAtPath(path)
      if (!ok) return false
    }
    if (workspaceDirty.length > 0 || bufferDirty.length > 0) {
      const savedPaths = [...workspaceDirty, ...bufferDirty]
      setExternalDiskChangedPaths((prev) => {
        let next = prev
        for (const path of savedPaths) {
          next = clearExternalDiskDriftInState(next, path)
        }
        return next
      })
      setStatus(t('app.status.saved'), 'success')
    }
    return true
  }, [activePathRef, flushEditorToMemory, saveDocumentAtPath, setExternalDiskChangedPaths, setStatus, t])

  saveAllDirtyDocumentsRef.current = saveAllDirtyDocuments

  useAutosave({
    rootDir,
    activePath,
    setStatus,
    t,
    saveAllDirtyDocuments,
    saveDocumentAtPath,
  })

  useWorkspaceAutoLock({
    rootDir,
    rootDirRef,
    activePathRef,
    setStatus,
    t,
    saveAllDirtyDocuments,
    promptWorkspacePassword,
    bumpColdOpenGeneration,
    resetModeSwitchEditorBootstrap,
    captureActiveEditorSession: () => {
      const path = activePathRef.current
      if (path) captureTabEditorSession(path)
    },
    restoreActiveEditorSession: () => {
      const path = activePathRef.current
      if (path) applyTabEditorSession(path)
    },
  })

  const leaveCurrentTab = useCallback(async (): Promise<boolean> => {
    return flushEditorToMemory()
  }, [flushEditorToMemory])

  leaveCurrentTabRef.current = leaveCurrentTab

  const isTabNavStale = useCallback((generation: number) => tabNavGenerationRef.current !== generation, [tabNavGenerationRef])

  const releaseTabResources = useCallback(
    (path: string) => {
      evictStepLog(path)
      removeDocumentReferences(path)
      deleteTabEditorSession(path)
      deleteTabBody(path)
    },
    [],
  )

  const formatOpenDocumentError = useCallback(
    (error: unknown): string => {
      const encryptionMessage = formatWorkspaceEncryptionErrorMessage(error, t)
      if (encryptionMessage) return encryptionMessage
      const message = error instanceof Error ? error.message : String(error)
      if (/20\s*MB|exceeds.*limit/i.test(message)) {
        return t('app.status.noteTooLarge')
      }
      return message
    },
    [t],
  )

  const openDocumentPreferringCache = useCallback(
    async (
      root: string,
      path: string,
      options?: { cacheSource?: string; coldSource?: string; reason?: string },
    ): Promise<void> => {
      if (!path || isBufferTabId(path) || !root) return
      const cached = resolveDocumentBodyForPath(path)
      const tabBodyCached = getTabBody(path)
      const suspiciousWhitespaceCache = isSuspiciousWhitespaceCache(path, cached)
      const cacheUsable = shouldUseCachedBody(path, cached) && !suspiciousWhitespaceCache
      logTabNav(cacheUsable ? 'open-document-cache-hit' : 'open-document-cold', {
        reason: options?.reason ?? null,
        path,
        root,
        cacheSource: options?.cacheSource ?? null,
        coldSource: options?.coldSource ?? null,
        cacheUsable,
        suspiciousWhitespaceCache,
        resolvedCache: snapshotDocumentBodyMeta(path, cached),
        tabBodyCache: snapshotDocumentBodyMeta(path, tabBodyCached),
        activePath: activePathRef.current,
      })
      if (cacheUsable) {
        const seedMarkdown = getSourceModeIdentity(path)?.trim() || cached
        const projected = projectDocumentMemorySurfaces(path, seedMarkdown)
        checkBlankContentSuspect('open-document-cache-hit', path, projected.sourceIdentity, {
          reason: options?.reason ?? options?.cacheSource ?? 'open-document-cache',
          cacheSource: options?.cacheSource ?? null,
        })
        await dispatchDocumentCommand({
          type: 'REPLACE_ACTIVE_DOCUMENT',
          path,
          content: projected.editorSurface,
          source: options?.cacheSource ?? 'open-document-cache',
        })
        return
      }
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root,
        path,
        source: options?.coldSource ?? 'open-document-cold',
      })
    },
    [activePathRef, isSuspiciousWhitespaceCache, resolveDocumentBodyForPath, shouldUseCachedBody],
  )

  const dispatchOpenDocument = useCallback(
    async (root: string, path: string, reason = 'dispatch-open-document'): Promise<void> => {
      dismissHistoryOverlayForNavigation()
      const target = path.trim()
      if (!target) return
      const current = activePathRef.current.trim()
      if (pathsEqual(target, current)) {
        logTabNav('tab-activate-skipped', { reason: 'already-active', path: target, root })
        return
      }
      beginDocumentNavigation()
      try {
        const generation = ++tabNavGenerationRef.current
        logTabNav('open-document-start', {
          reason,
          fromPath: current,
          toPath: target,
          root,
          workspaceRestoring: workspaceRestoringRef.current,
          openedTabs,
          generation,
        })
        if (!workspaceRestoringRef.current) {
          const left = await leaveCurrentTab()
          if (!left) {
            logTabNav('tab-activate-skipped', { reason: 'leave-current-tab-failed', path: target, root })
            return
          }
          if (isTabNavStale(generation)) {
            logTabNav('tab-load-stale-abort', { reason, tabPath: target, navGeneration: generation, stage: 'after-leave' })
            return
          }
        }
        logModeSwitchState('dispatchOpenDocument:before_reset')
        resetModeSwitchEditorBootstrap()
        try {
          await openDocumentPreferringCache(root, target, {
            cacheSource: 'dispatchOpenDocument-cache',
            coldSource: 'dispatchOpenDocument-adapter',
            reason,
          })
        } catch (error) {
          logTabNav('tab-load-complete', {
            reason,
            path: target,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
          setStatus(t('app.status.openFailed', { message: formatOpenDocumentError(error) }), 'error')
          return
        }
        if (isTabNavStale(generation)) {
          logTabNav('tab-load-stale-abort', { reason, tabPath: target, navGeneration: generation, stage: 'after-open' })
          return
        }
        checkBlankContentSuspect('dispatch-open-document-complete', target, contentRef.current, { reason })
        applyTabEditorSession(target)
        focusActiveEditor()
        if (mainPaneMode === 'visual') {
          runAfterReactCommit(() => {
            schedulePrimeEditorDiagramPreviews(() => {
              const pm = visualEditorRef.current?.getEditor()
              return pm?.view?.dom ?? null
            })
          })
        }
      } finally {
        await finishDocumentNavigation(target)
      }
    },
    [
      activePathRef,
      beginDocumentNavigation,
      finishDocumentNavigation,
      applyTabEditorSession,
      focusActiveEditor,
      formatOpenDocumentError,
      leaveCurrentTab,
      logModeSwitchState,
      mainPaneMode,
      openDocumentPreferringCache,
      resetModeSwitchEditorBootstrap,
      setStatus,
      dismissHistoryOverlayForNavigation,
      t,
      isTabNavStale,
      tabNavGenerationRef,
      visualEditorRef,
      workspaceRestoringRef,
      contentRef,
      openedTabs,
    ],
  )

  const loadTabContent = useCallback(
    async (tabPath: string, navGeneration: number, reason = 'load-tab-content'): Promise<boolean> => {
      logTabNav('tab-load-start', {
        reason,
        tabPath,
        navGeneration,
        currentGeneration: tabNavGenerationRef.current,
        fromPath: activePathRef.current,
        rootDir: rootDir || null,
        openedTabs,
      })
      if (isTabNavStale(navGeneration)) {
        logTabNav('tab-load-stale-abort', { reason, tabPath, navGeneration, stage: 'before-start' })
        return false
      }
      logModeSwitchState('loadTabContent:before_reset')
      resetModeSwitchEditorBootstrap()
      if (isBufferTabId(tabPath)) {
        bumpColdOpenGeneration()
        const body = getTabBody(tabPath) ?? INITIAL_NOTE_MD
        logTabNav('open-document-cache-hit', {
          reason: `${reason}:buffer-tab`,
          path: tabPath,
          body: snapshotDocumentBodyMeta(tabPath, body),
        })
        await dispatchDocumentCommand({
          type: 'REPLACE_ACTIVE_DOCUMENT',
          path: tabPath,
          content: body,
          source: 'tab-buffer',
        })
      } else if (rootDir) {
        const hadExternalChange = hasExternalDiskDriftInState(tabPath, externalDiskChangedPaths)
        if (hadExternalChange) {
          const snap = getDocumentRuntimeSnapshot()
          const tabDirty = Boolean(
            snap.dirtyByPath[tabPath] ||
              Object.entries(snap.dirtyByPath).some(([p, dirty]) => dirty && pathsEqual(p, tabPath)),
          )
          if (tabDirty) {
            const local = getTabBody(tabPath) ?? getDocumentSavedContent(tabPath) ?? ''
            const result = await promptExternalDriftConflict({
              rootDir,
              path: tabPath,
              local,
              setSaveConflict,
              setStatus,
              t,
            })
            if (isTabNavStale(navGeneration)) return false
            if (result === 'disk') {
              setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, tabPath))
              deleteTabBody(tabPath)
              resetModeSwitchEditorBootstrap()
              bumpColdOpenGeneration()
              if (isTabNavStale(navGeneration)) return false
              await openDocumentPreferringCache(rootDir, tabPath, {
                cacheSource: 'tab-cache',
                coldSource: 'tab-cold-open',
                reason: `${reason}:disk-choice`,
              })
              if (isTabNavStale(navGeneration)) {
                logTabNav('tab-load-stale-abort', { reason, tabPath, navGeneration, stage: 'after-disk-choice-open' })
                return false
              }
              applyTabEditorSession(tabPath)
              focusActiveEditor()
              return true
            } else if (result === 'local') {
              setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, tabPath))
            } else {
              setExternalDiskChangedPaths((prev) => {
                const next = new Set(prev)
                next.add(tabPath)
                return next
              })
              setStatus(t('app.status.externalFileChangedDirtyKept'), 'warning')
              return false
            }
          } else {
            setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, tabPath))
          }
        }
        if (isTabNavStale(navGeneration)) {
          logTabNav('tab-load-stale-abort', { reason, tabPath, navGeneration, stage: 'before-open' })
          return false
        }
        try {
          await openDocumentPreferringCache(rootDir, tabPath, {
            cacheSource: 'tab-cache',
            coldSource: 'tab-cold-open',
            reason: `${reason}:disk-tab`,
          })
        } catch (error) {
          logTabNav('tab-load-complete', {
            reason,
            tabPath,
            navGeneration,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
          setStatus(t('app.status.openFailed', { message: formatOpenDocumentError(error) }), 'error')
          return false
        }
      } else {
        logTabNav('tab-load-stale-abort', {
          reason,
          tabPath,
          navGeneration,
          stage: 'missing-root-dir',
          rootDir: rootDir || null,
        })
        return false
      }
      if (isTabNavStale(navGeneration)) {
        logTabNav('tab-load-stale-abort', { reason, tabPath, navGeneration, stage: 'before-apply-session' })
        return false
      }
      checkBlankContentSuspect('load-tab-content-complete', tabPath, contentRef.current, {
        reason,
        navGeneration,
        kernelSnapshot: snapshotDocumentBodyMeta(tabPath, getDocumentRuntimeSnapshot().content),
      })
      applyTabEditorSession(tabPath)
      focusActiveEditor()
      if (mainPaneMode === 'visual') {
        runAfterReactCommit(() => {
          schedulePrimeEditorDiagramPreviews(() => {
            const pm = visualEditorRef.current?.getEditor()
            return pm?.view?.dom ?? null
          })
        })
      }
      logTabNav('tab-load-complete', {
        reason,
        tabPath,
        navGeneration,
        success: true,
        content: snapshotDocumentBodyMeta(tabPath, contentRef.current),
        editorBoundKey: visualEditorRef.current?.getBoundDocumentKey?.() ?? null,
        mainPaneMode,
      })
      return true
    },
    [
      activePathRef,
      contentRef,
      rootDir,
      mainPaneMode,
      visualEditorRef,
      openDocumentPreferringCache,
      formatOpenDocumentError,
      setStatus,
      setExternalDiskChangedPaths,
      focusActiveEditor,
      resetModeSwitchEditorBootstrap,
      logModeSwitchState,
      bumpColdOpenGeneration,
      t,
      externalDiskChangedPaths,
      isTabNavStale,
      applyTabEditorSession,
      openedTabs,
      setSaveConflict,
      tabNavGenerationRef,
    ],
  )

  const activateTab = useCallback(
    async (targetPath: string, reason = 'user-tab-click') => {
      dismissHistoryOverlayForNavigation()
      if (pathsEqual(targetPath, activePath)) {
        logTabNav('tab-activate-skipped', { reason: 'already-active', targetPath })
        return
      }
      beginDocumentNavigation()
      try {
        const generation = ++tabNavGenerationRef.current
        logTabNav('tab-activate-start', {
          reason,
          fromPath: activePath,
          toPath: targetPath,
          generation,
          openedTabs,
        })
        const left = await leaveCurrentTab()
        if (!left) {
          logTabNav('tab-activate-skipped', { reason: 'leave-current-tab-failed', targetPath, generation })
          return
        }
        if (isTabNavStale(generation)) {
          logTabNav('tab-load-stale-abort', { reason, tabPath: targetPath, navGeneration: generation, stage: 'after-leave' })
          return
        }
        await loadTabContent(targetPath, generation, reason)
        if (isTabNavStale(generation)) {
          logTabNav('tab-load-stale-abort', { reason, tabPath: targetPath, navGeneration: generation, stage: 'after-load' })
          return
        }
        persistWorkspaceSnapshotNow()
        logTabNav('tab-activate-complete', {
          reason,
          fromPath: activePath,
          toPath: targetPath,
          generation,
          content: snapshotDocumentBodyMeta(targetPath, contentRef.current),
        })
      } finally {
        await finishDocumentNavigation(targetPath)
      }
    },
    [activePath, beginDocumentNavigation, contentRef, finishDocumentNavigation, dismissHistoryOverlayForNavigation, leaveCurrentTab, loadTabContent, isTabNavStale, openedTabs, tabNavGenerationRef],
  )

  const saveAllOpenTabs = useCallback(async () => {
    await saveAllDirtyDocuments()
  }, [saveAllDirtyDocuments])

  const scratchNewDocument = useCallback(async () => {
    logTabNav('scratch-new-document', { fromPath: activePath, openedTabs })
    const left = await leaveCurrentTab()
    if (!left) return
    resetModeSwitchEditorBootstrap()
    const id = newBufferTabId()
    setBufferTabLabels((prev) => ({ ...prev, [id]: '' }))
    await dispatchDocumentCommand({
      type: 'OPEN_SCRATCH_DOCUMENT',
      id,
      content: INITIAL_NOTE_MD,
      source: 'scratch',
    })
    setStatus(t('app.tab.scratchDoc'), 'info')
    focusActiveEditor()
  }, [activePath, leaveCurrentTab, focusActiveEditor, openedTabs, resetModeSwitchEditorBootstrap, setBufferTabLabels, setStatus, t])

  const scratchNewTab = useCallback(async () => {
    logTabNav('scratch-new-tab', { fromPath: activePath, openedTabs })
    const scratchId = newBufferTabId()
    if (
      wouldExceedOpenTabLimitForPaths(openedTabs, [
        ...(activePath ? [activePath] : []),
        scratchId,
      ])
    ) {
      await warnOpenTabLimitReached()
      return
    }
    const left = await leaveCurrentTab()
    if (!left) return
    resetModeSwitchEditorBootstrap()
    setBufferTabLabels((prev) => ({ ...prev, [scratchId]: '' }))
    await dispatchDocumentCommand({
      type: 'OPEN_SCRATCH_TAB',
      id: scratchId,
      content: INITIAL_NOTE_MD,
      currentPath: activePath,
      source: 'scratch',
    })
    setStatus(t('app.tab.newScratch'), 'info')
    focusActiveEditor()
  }, [
    activePath,
    leaveCurrentTab,
    focusActiveEditor,
    openedTabs,
    resetModeSwitchEditorBootstrap,
    setBufferTabLabels,
    setStatus,
    t,
    warnOpenTabLimitReached,
  ])

  const dispatchOpenDocumentInTab = useCallback(
    async (root: string, path: string, reason = 'open-document-in-tab') => {
      dismissHistoryOverlayForNavigation()
      if (!path) return
      if (!isPathInOpenTabs(openedTabs, path) && wouldExceedOpenTabLimit(openedTabs, path)) {
        await warnOpenTabLimitReached()
        return
      }
      beginDocumentNavigation()
      try {
        const generation = ++tabNavGenerationRef.current
        logTabNav('open-document-in-tab', {
          reason,
          path,
          root,
          activePath,
          openedTabs,
          generation,
        })
        if (isBufferTabId(path)) {
          await activateTab(path, `${reason}:buffer`)
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: upsertPathInList(openedTabs, path),
            activePath: path,
            source: 'dispatchOpenDocumentInTab-buffer',
          })
          return
        }
        if (!root) return
        const navigationGeneration = beginNavigationReveal()
        const currentActivePath = activePathRef.current
        const sameNoteOpen = pathsEqual(path, currentActivePath)
        const left = await leaveCurrentTab()
        if (!left) return
        if (isTabNavStale(generation)) {
          logTabNav('tab-load-stale-abort', { reason, tabPath: path, navGeneration: generation, stage: 'after-leave' })
          return
        }
        if (sameNoteOpen) {
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: upsertPathInList(openedTabs, path),
            activePath: currentActivePath,
            source: 'dispatchOpenDocumentInTab-same-note',
          })
          if (isTabNavStale(generation)) {
            logTabNav('tab-load-stale-abort', { reason, tabPath: path, navGeneration: generation, stage: 'same-note-set-tabs' })
            return
          }
          focusActiveEditor()
          await revealNavigationAnchorAfterOpen(path, contentRef.current, navigationGeneration)
          return
        }
        const cached = resolveDocumentBodyForPath(path)
        let loadedMarkdown: string
        if (shouldUseCachedBody(path, cached) && !isSuspiciousWhitespaceCache(path, cached)) {
          logTabNav('open-document-cache-hit', {
            reason: `${reason}:new-tab-cache`,
            path,
            cache: snapshotDocumentBodyMeta(path, cached),
          })
          checkBlankContentSuspect('open-document-in-tab-cache', path, cached, { reason })
          const nextTabs = upsertPathInList(openedTabs, path)
          await dispatchDocumentCommand({
            type: 'REPLACE_ACTIVE_DOCUMENT',
            path,
            content: cached,
            source: 'dispatchOpenDocumentInTab-tab-cache',
          })
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: nextTabs,
            activePath: path,
            source: 'dispatchOpenDocumentInTab-tab-cache',
          })
          if (isTabNavStale(generation)) {
            logTabNav('tab-load-stale-abort', { reason, tabPath: path, navGeneration: generation, stage: 'cache-set-tabs' })
            return
          }
          loadedMarkdown = cached
        } else {
          logTabNav('open-document-cold', {
            reason: `${reason}:new-tab-cold`,
            path,
            root,
            cache: snapshotDocumentBodyMeta(path, cached),
          })
          try {
            const loaded = await dispatchDocumentCommand({
              type: 'OPEN_DOCUMENT_IN_TAB',
              root,
              path,
              source: 'dispatchOpenDocumentInTab-adapter',
            })
            loadedMarkdown = typeof loaded === 'string' ? loaded : contentRef.current
          } catch (error) {
            logTabNav('tab-load-complete', {
              reason,
              path,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            })
            setStatus(t('app.status.openFailed', { message: formatOpenDocumentError(error) }), 'error')
            return
          }
          if (isTabNavStale(generation)) {
            logTabNav('tab-load-stale-abort', { reason, tabPath: path, navGeneration: generation, stage: 'after-cold-open' })
            return
          }
        }
        if (isTabNavStale(generation)) {
          logTabNav('tab-load-stale-abort', { reason, tabPath: path, navGeneration: generation, stage: 'before-reveal' })
          return
        }
        checkBlankContentSuspect('open-document-in-tab-complete', path, loadedMarkdown, { reason })
        await revealNavigationAnchorAfterOpen(path, loadedMarkdown, navigationGeneration)
      } finally {
        await finishDocumentNavigation(path)
      }
    },
    [
      activePath,
      activePathRef,
      beginDocumentNavigation,
      beginNavigationReveal,
      contentRef,
      finishDocumentNavigation,
      leaveCurrentTab,
      activateTab,
      openedTabs,
      focusActiveEditor,
      revealNavigationAnchorAfterOpen,
      formatOpenDocumentError,
      setStatus,
      resolveDocumentBodyForPath,
      isSuspiciousWhitespaceCache,
      shouldUseCachedBody,
      dismissHistoryOverlayForNavigation,
      t,
      isTabNavStale,
      tabNavGenerationRef,
      warnOpenTabLimitReached,
    ],
  )

  flushEditorToMemoryRef.current = flushEditorToMemory

  const closeTab = useCallback(
    (path: string) => {
      enqueueTabMutationOperation(async () => {
        const generation = ++tabNavGenerationRef.current
        logTabNav('tab-close', {
          path,
          generation,
          activePath,
          openedTabs,
        })
        beginDocumentNavigation()
        let navigationReadyPath: string | undefined
        try {
          const flushed = await flushEditorToMemory()
          if (!flushed) return
          if (isTabNavStale(generation)) return
          if (isPathDirty(path)) {
            const choice = await promptUnsavedChanges({
              message: t('app.confirm.closeTabDirty'),
            })
            if (choice === 'cancel') return
            if (isTabNavStale(generation)) return
            if (choice === 'save') {
              const saved = await saveDocumentAtPath(path)
              if (!saved) return
              if (isTabNavStale(generation)) return
            }
          }
          if (isTabNavStale(generation)) return
          releaseTabResources(path)
          if (isBufferTabId(path)) {
            setBufferTabLabels((prev) => {
              const n = { ...prev }
              delete n[path]
              return n
            })
          }

          const nextTabs = filterOutPath(openedTabs, path)
          pruneTabBodiesExcept(nextTabs)
          const wasActive = pathsEqual(path, activePath)

          if (!wasActive) {
            if (isTabNavStale(generation)) return
            await dispatchDocumentCommand({
              type: 'CLOSE_TAB',
              path,
              source: 'tab-close',
            })
            return
          }

          const fallback = nextTabs[nextTabs.length - 1]
          if (fallback) {
            if (isTabNavStale(generation)) return
            let fallbackContent: string | undefined
            if (isBufferTabId(fallback)) {
              fallbackContent = getTabBody(fallback) ?? INITIAL_NOTE_MD
            } else {
              const cached = resolveDocumentBodyForPath(fallback)
              if (cached != null && cached.length > 0) fallbackContent = cached
            }
            if (isTabNavStale(generation)) return
            await dispatchDocumentCommand({
              type: 'CLOSE_TAB',
              path,
              fallbackPath: fallback,
              fallbackContent: fallbackContent ?? '',
              source: 'tab-close',
            })
            if (isTabNavStale(generation)) return
            const loaded = await loadTabContent(fallback, generation)
            if (loaded && !isTabNavStale(generation)) {
              navigationReadyPath = fallback
              persistWorkspaceSnapshotNow()
            }
          } else {
            if (isTabNavStale(generation)) return
            resetModeSwitchEditorBootstrap()
            await dispatchDocumentCommand({
              type: 'CLOSE_TAB',
              path,
              fallbackPath: '',
              fallbackContent: INITIAL_NOTE_MD,
              source: 'tab-close',
            })
          }
        } finally {
          await finishDocumentNavigation(navigationReadyPath)
        }
      })
    },
    [
      activePath,
      openedTabs,
      tabNavGenerationRef,
      loadTabContent,
      flushEditorToMemory,
      saveDocumentAtPath,
      resetModeSwitchEditorBootstrap,
      setBufferTabLabels,
      t,
      promptUnsavedChanges,
      isTabNavStale,
      releaseTabResources,
      resolveDocumentBodyForPath,
      beginDocumentNavigation,
      finishDocumentNavigation,
    ],
  )

  const onTabContextMenu = useCallback((e: ReactMouseEvent, path: string, index: number) => {
    e.preventDefault()
    const pad = 8
    const mw = 200
    const mh = 196
    let x = e.clientX
    let y = e.clientY
    if (x + mw > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - pad - mw)
    if (y + mh > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - pad - mh)
    setFileContextMenu(null)
    setEditorDocMenu(null)
    setTabContextMenu({ x, y, path, index, total: openedTabs.length })
  }, [openedTabs.length, setEditorDocMenu, setFileContextMenu, setTabContextMenu])

  const reorderOpenedTabs = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= openedTabs.length || toIndex >= openedTabs.length) {
        return
      }
      const next = moveItemInArray(openedTabs, fromIndex, toIndex)
      await dispatchDocumentCommand({
        type: 'SET_TABS',
        tabs: next,
        activePath,
        source: 'tab-reorder',
      })
      persistWorkspaceSnapshotNow()
    },
    [activePath, openedTabs],
  )

  const handleTabContextPick = useCallback(
    (action: TabContextMenuPick, path: string, index: number) => {
      setTabContextMenu(null)
      enqueueTabMutationOperation(async () => {
        const generation = ++tabNavGenerationRef.current
        beginDocumentNavigation()
        let navigationReadyPath: string | undefined
        try {
          const flushed = await flushEditorToMemory()
          if (!flushed) return
          if (isTabNavStale(generation)) return
          let next = [...openedTabs]
          if (next.length === 0) return
          if (action === 'close') next = filterOutPath(next, path)
          else if (action === 'closeOthers') next = next.filter((p) => pathsEqual(p, path))
          else if (action === 'closeLeft') next = next.slice(index)
          else if (action === 'closeRight') next = next.slice(0, index + 1)
          const closing = openedTabs.filter((p) => !pathInList(p, next))
          const dirtyClosing = closing.filter((p) => isPathDirty(p))
          if (dirtyClosing.length > 0) {
            const choice = await promptUnsavedChanges({
              message: t('app.confirm.closeTabsDirty'),
            })
            if (choice === 'cancel') return
            if (isTabNavStale(generation)) return
            if (choice === 'save') {
              for (const p of dirtyClosing) {
                const saved = await saveDocumentAtPath(p)
                if (!saved) return
              }
              if (isTabNavStale(generation)) return
            }
          }
          if (isTabNavStale(generation)) return
          for (const p of closing) {
            releaseTabResources(p)
          }
          if (closing.some((p) => isBufferTabId(p))) {
            setBufferTabLabels((prev) => {
              const n = { ...prev }
              for (const p of closing) {
                if (isBufferTabId(p)) delete n[p]
              }
              return n
            })
          }
          pruneTabBodiesExcept(next)
          if (!pathInList(activePath, next)) {
            const fallback = next[next.length - 1]
            if (fallback) {
              if (isTabNavStale(generation)) return
              await loadTabContent(fallback, generation)
              navigationReadyPath = fallback
              if (isTabNavStale(generation)) return
              persistWorkspaceSnapshotNow()
            } else {
              if (isTabNavStale(generation)) return
              resetModeSwitchEditorBootstrap()
              await dispatchDocumentCommand({
                type: 'REPLACE_ACTIVE_DOCUMENT',
                path: '',
                content: INITIAL_NOTE_MD,
                source: 'tab-context',
              })
            }
          }
          if (isTabNavStale(generation)) return
          await dispatchDocumentCommand({
            type: 'SET_TABS',
            tabs: next,
            activePath: pathInList(activePath, next) ? activePath : next[next.length - 1] ?? '',
            source: 'tab-context',
          })
        } finally {
          await finishDocumentNavigation(navigationReadyPath)
        }
      })
    },
    [
      activePath,
      openedTabs,
      loadTabContent,
      flushEditorToMemory,
      saveDocumentAtPath,
      resetModeSwitchEditorBootstrap,
      setBufferTabLabels,
      setTabContextMenu,
      tabNavGenerationRef,
      t,
      promptUnsavedChanges,
      isTabNavStale,
      releaseTabResources,
      beginDocumentNavigation,
      finishDocumentNavigation,
    ],
  )

  return {
    flushEditorToMemory,
    saveDocumentAtPath,
    saveAllDirtyDocuments,
    leaveCurrentTab,
    loadTabContent,
    activateTab,
    saveAllOpenTabs,
    scratchNewDocument,
    scratchNewTab,
    dispatchOpenDocument,
    dispatchOpenDocumentInTab,
    closeTab,
    reorderOpenedTabs,
    onTabContextMenu,
    handleTabContextPick,
  }
}
