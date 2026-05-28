import {
  useCallback,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { INITIAL_NOTE_MD, isBufferTabId, newBufferTabId } from '../workspace/constants'
import { deleteTabBody, pruneTabBodiesExcept, setTabBody } from '../document/tabBodiesStore'
import { openSaveConflictDialog, type SaveConflictState } from '../document/saveConflictState'
import { resolveDocumentBody } from '../../documentRuntime/documentAuthority'
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
import { persistWorkspaceSnapshotNow } from '../../documentRuntime/persistWorkspaceSnapshot'
import { postWorkspaceBroadcast } from '../workspace/workspaceBroadcast'
import { useAutosave } from './useAutosave'
import { isPathDirty, listDirtyDocumentPaths } from '../../lib/documentDirty'
import { resolveActiveAwareSaveBodyFallback, tryResolveBoundEditorMarkdown } from '../../lib/editorContentSync'
import { enqueueSave } from '../../lib/saveQueue'
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
import { isCompatibilityTraceEnabled } from '../../debug/compatibilityDebug'
import type { AtomicVisualDocumentEnter, TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { schedulePrimeEditorDiagramPreviews } from '../../editor/runtimeEngine/primeEditorDiagramPreviews'

export type TabNavigationDeps = {
  t: TranslateFn
  rootDir: string
  activePath: string
  openedTabs: string[]
  mainPaneMode: 'visual' | 'source'
  externalDiskChangedPaths: Set<string>
  setExternalDiskChangedPaths: Dispatch<SetStateAction<Set<string>>>
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setSavedAt: Dispatch<SetStateAction<string>>
  setStatus: (msg: string) => void
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
  bufferBodiesRef: MutableRefObject<Record<string, string>>
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
  dispatchOpenDocument: (root: string, path: string) => Promise<void>
  focusActiveEditor: () => void
  resetModeSwitchEditorBootstrap: () => void
  logModeSwitchState: (phase: string) => void
  bumpColdOpenGeneration: () => void
  beginNavigationReveal: () => number
  revealNavigationAnchorAfterOpen: (path: string, markdown: string, generation: number) => Promise<void>
  cancelPendingKernelContentDebounce: () => void
}

export function useTabNavigation(deps: TabNavigationDeps) {
  const {
    t,
    rootDir,
    activePath,
    openedTabs,
    mainPaneMode,
    externalDiskChangedPaths,
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
    bufferBodiesRef,
    tabNavGenerationRef,
    suppressWorkspaceRefreshUntilRef,
    saveAllDirtyDocumentsRef,
    leaveCurrentTabRef,
    flushEditorToMemoryRef,
    saveCurrent,
    confirmAppDialog,
    promptUnsavedChanges,
    dispatchOpenDocument,
    focusActiveEditor,
    resetModeSwitchEditorBootstrap,
    logModeSwitchState,
    bumpColdOpenGeneration,
    beginNavigationReveal,
    revealNavigationAnchorAfterOpen,
    cancelPendingKernelContentDebounce,
  } = deps

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
        const view = editorViewRef.current
        if (view) {
          const { anchor, head } = view.state.selection.main
          session.source = {
            from: anchor,
            to: head,
            scrollTop: view.scrollDOM.scrollTop,
          }
        }
      }
      if (session.visual || session.source) {
        setTabEditorSession(tabPath, session)
      }
    },
    [editorViewRef, mainPaneMode, visualEditorRef],
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
        sourceCodeMirrorBootSelectionRef.current = {
          from: session.source.from,
          to: session.source.to,
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

  const shouldUseCachedBody = useCallback((path: string, cached: string | undefined): cached is string => {
    if (cached == null) return false
    if (isBufferTabId(path)) return true
    const snap = getDocumentRuntimeSnapshot()
    const dirty = Boolean(
      snap.dirtyByPath[path] ||
        Object.entries(snap.dirtyByPath).some(([p, v]) => v && pathsEqual(p, path)),
    )
    return dirty
  }, [])

  const resolveDocumentBodyForPath = useCallback(
    (path: string, contentFallback?: string) => {
      return resolveDocumentBody(path, {
        contentFallback,
        bufferBodies: bufferBodiesRef.current,
      })
    },
    [bufferBodiesRef],
  )

  const isDirtyTraceEnabled = useCallback((): boolean => {
    return isCompatibilityTraceEnabled('dirty')
  }, [])

  const quickHash = useCallback((text: string): string => {
    let h = 2166136261
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return (h >>> 0).toString(16)
  }, [])

  const normalizeLineEndings = useCallback((value: string): string => {
    return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }, [])

  const diffPreview = useCallback((a: string, b: string) => {
    if (a === b) return null
    const max = Math.max(a.length, b.length)
    let idx = 0
    while (idx < max && a[idx] === b[idx]) idx += 1
    const from = Math.max(0, idx - 16)
    const to = idx + 32
    return {
      index: idx,
      aSlice: a.slice(from, to),
      bSlice: b.slice(from, to),
      aLen: a.length,
      bLen: b.length,
    }
  }, [])

  const persistEditorToTabStores = useCallback((tabPath: string, body: string) => {
    if (!tabPath) return
    setTabBody(tabPath, body)
    if (isBufferTabId(tabPath)) {
      bufferBodiesRef.current[tabPath] = body
    }
  }, [bufferBodiesRef])

  /** Write the current editor text to tabBodiesStore + kernel, without writing to disk*/
  const flushEditorToMemory = useCallback(async (): Promise<boolean> => {
    cancelPendingKernelContentDebounce()
    const pathToLeave = activePathRef.current
    if (!pathToLeave) return true
    const contentSnapshot = contentRef.current
    const tabBodySnapshot = resolveDocumentBodyForPath(pathToLeave, contentSnapshot)
    let body: string
    let bodySource: 'editor' | 'fallback' = 'fallback'
    const visualSurface = visualEditorRef.current
    const editorBoundToLeaving =
      mainPaneMode === 'visual' &&
      visualSurface &&
      pathsEqual(visualSurface.getBoundDocumentKey(), pathToLeave)
    if (editorBoundToLeaving) {
      let resolved: string | null
      try {
        resolved = await tryResolveBoundEditorMarkdown(
          mainPaneMode,
          visualSurface,
          contentSnapshot,
          pathToLeave,
          () => activePathRef.current,
        )
      } catch (error) {
        setStatus(t('app.status.saveFailed', { message: error instanceof Error ? error.message : String(error) }))
        return false
      }
      if (resolved != null) {
        body = resolved
        bodySource = 'editor'
      } else {
        const fallback = resolveActiveAwareSaveBodyFallback({
          pathToSave: pathToLeave,
          tabBodySnapshot,
          contentSnapshot,
          activePath: activePathRef.current,
          activeContent: contentRef.current,
          resolveDocumentBody: resolveDocumentBodyForPath,
        })
        if (fallback == null) return false
        body = fallback
      }
    } else {
      const fallback = resolveActiveAwareSaveBodyFallback({
        pathToSave: pathToLeave,
        tabBodySnapshot,
        contentSnapshot,
        activePath: activePathRef.current,
        activeContent: contentRef.current,
        resolveDocumentBody: resolveDocumentBodyForPath,
      })
      if (fallback == null) return false
      body = fallback
    }

    if (editorBoundToLeaving && visualSurface?.normalizeMarkdownForCompare) {
      const normalizedBody = visualSurface.normalizeMarkdownForCompare(body)
      const normalizedSnapshot = visualSurface.normalizeMarkdownForCompare(contentSnapshot)
      if (normalizedBody != null && normalizedSnapshot != null && normalizedBody === normalizedSnapshot) {
        if (isDirtyTraceEnabled()) {
          console.info('[dirty-trace] normalize equal, skip dirty', {
            path: pathToLeave,
            bodySource,
            normalizedHash: quickHash(normalizedBody),
            normalizedLen: normalizedBody.length,
          })
        }
        captureTabEditorSession(pathToLeave)
        return true
      }
      let normalizedSaved: string | null = null
      if (normalizedBody != null && normalizedSnapshot != null) {
        const saved = getDocumentSavedContent(pathToLeave)
        normalizedSaved = saved ? visualSurface.normalizeMarkdownForCompare(saved) : null
        const canNormalizeBaseline =
          bodySource === 'editor' &&
          normalizedSaved != null &&
          normalizedBody === normalizedSaved &&
          !isPathDirty(pathToLeave)
        if (canNormalizeBaseline) {
          if (isDirtyTraceEnabled()) {
            console.warn('[dirty-trace] normalize baseline update', {
              path: pathToLeave,
              bodySource,
              normalizedBodyHash: quickHash(normalizedBody),
              normalizedSavedHash: normalizedSaved ? quickHash(normalizedSaved) : null,
            })
          }
          persistEditorToTabStores(pathToLeave, body)
          contentRef.current = body
          await dispatchDocumentCommand({
            type: 'NORMALIZE_DOCUMENT_CONTENT',
            path: pathToLeave,
            content: body,
            source: 'normalize-on-tab-switch',
          })
          captureTabEditorSession(pathToLeave)
          return true
        }
      }
      if (isDirtyTraceEnabled()) {
        const rawDiff = diffPreview(body, contentSnapshot)
        const normalizedDiff =
          normalizedBody != null && normalizedSnapshot != null
            ? diffPreview(normalizedBody, normalizedSnapshot)
            : null
        const savedDiff =
          normalizedBody != null && normalizedSaved != null
            ? diffPreview(normalizedBody, normalizedSaved)
            : null
        console.warn('[dirty-trace] normalize mismatch, will mark dirty', {
          path: pathToLeave,
          bodySource,
          normalizedBodyHash: normalizedBody ? quickHash(normalizedBody) : null,
          normalizedSnapshotHash: normalizedSnapshot ? quickHash(normalizedSnapshot) : null,
          normalizedSavedHash: normalizedSaved ? quickHash(normalizedSaved) : null,
          normalizedBodyLen: normalizedBody?.length ?? null,
          normalizedSnapshotLen: normalizedSnapshot?.length ?? null,
          rawDiff,
          normalizedDiff,
          savedDiff,
        })
      }
    }

    persistEditorToTabStores(pathToLeave, body)
    if (body !== contentRef.current) {
      contentRef.current = body
    }
    const saved = getDocumentSavedContent(pathToLeave)
    const kernelDirty =
      saved === undefined
        ? body.length > 0
        : normalizeLineEndings(body) !== normalizeLineEndings(saved)
    if (kernelDirty) {
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: pathToLeave,
        content: body,
        source: 'memory-flush',
      })
    }
    captureTabEditorSession(pathToLeave)
    return true
  }, [
    cancelPendingKernelContentDebounce,
    mainPaneMode,
    persistEditorToTabStores,
    captureTabEditorSession,
    resolveDocumentBodyForPath,
    setStatus,
    t,
  ])

  const saveDocumentAtPath = useCallback(
    async (path: string): Promise<boolean> => {
      if (!path) return false
      if (isBufferTabId(path)) {
        if (!pathsEqual(path, activePathRef.current)) return false
        await saveCurrent(true)
        return !isPathDirty(path)
      }
      if (!rootDir) return false
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
          if (body == null && rootDir && !isBufferTabId(path) && !isPathDirty(path)) {
            try {
              body = await invoke<string>('read_note', { payload: { root: rootDir, path } })
              setTabBody(path, body)
            } catch {
              throw new Error(t('app.status.saveNothingHint'))
            }
          }
          if (body == null) {
            throw new Error(t('app.status.saveNothingHint'))
          }
          await dispatchDocumentCommand({
            type: 'SAVE_DOCUMENT',
            root: rootDir,
            path,
            content: body,
            source: 'save-document',
          })
        })
        suppressWorkspaceRefreshUntilRef.current = Date.now() + 2500
        setSavedAt(new Date().toLocaleTimeString())
        postWorkspaceBroadcast({ type: 'document-saved', root: rootDir, path })
        return true
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('FILE_CONFLICT') && rootDir) {
          const local =
            resolveDocumentBodyForPath(path, contentSnapshot) ??
            tabBodySnapshot ??
            (contentSnapshot !== undefined ? contentSnapshot : '')
          await openSaveConflictDialog({
            rootDir,
            path,
            local,
            setSaveConflict,
            setStatus,
            t,
          })
          return false
        }
        setStatus(t('app.status.saveFailed', { message }))
        return false
      }
    },
    [rootDir, flushEditorToMemory, resolveDocumentBodyForPath, saveCurrent, t],
  )

  const saveAllDirtyDocuments = useCallback(async (): Promise<boolean> => {
    const flushed = await flushEditorToMemory()
    if (!flushed) return false
    const dirtyPaths = listDirtyDocumentPaths()
    const workspaceDirty = dirtyPaths.filter((p) => !isBufferTabId(p))
    const bufferDirty = dirtyPaths.filter((p) => isBufferTabId(p))
    for (const path of workspaceDirty) {
      const ok = await saveDocumentAtPath(path)
      if (!ok) return false
    }
    for (const path of bufferDirty) {
      if (!pathsEqual(path, activePathRef.current)) {
        setStatus(t('app.status.saveNothingHint'))
        return false
      }
      const ok = await saveDocumentAtPath(path)
      if (!ok) return false
    }
    if (workspaceDirty.length > 0 || bufferDirty.length > 0) {
      setStatus(t('app.status.saved'))
    }
    return true
  }, [flushEditorToMemory, saveDocumentAtPath, t])

  saveAllDirtyDocumentsRef.current = saveAllDirtyDocuments

  useAutosave({
    rootDir,
    activePath,
    setStatus,
    t,
    saveAllDirtyDocuments,
    saveDocumentAtPath,
  })

  const leaveCurrentTab = useCallback(async (): Promise<boolean> => {
    return flushEditorToMemory()
  }, [flushEditorToMemory])

  leaveCurrentTabRef.current = leaveCurrentTab

  const isTabNavStale = useCallback((generation: number) => tabNavGenerationRef.current !== generation, [])

  const releaseTabResources = useCallback(
    (path: string) => {
      evictStepLog(path)
      removeDocumentReferences(path)
      deleteTabEditorSession(path)
      deleteTabBody(path)
      if (isBufferTabId(path)) {
        delete bufferBodiesRef.current[path]
      }
    },
    [bufferBodiesRef],
  )

  const formatOpenDocumentError = useCallback(
    (error: unknown): string => {
      const message = error instanceof Error ? error.message : String(error)
      if (/20\s*MB|exceeds.*limit/i.test(message)) {
        return t('app.status.noteTooLarge')
      }
      return message
    },
    [t],
  )

  const loadTabContent = useCallback(
    async (tabPath: string, navGeneration: number) => {
      if (isTabNavStale(navGeneration)) return
      logModeSwitchState('loadTabContent:before_reset')
      resetModeSwitchEditorBootstrap()
      if (isBufferTabId(tabPath)) {
        bumpColdOpenGeneration()
        const body = bufferBodiesRef.current[tabPath] ?? INITIAL_NOTE_MD
        await dispatchDocumentCommand({
          type: 'REPLACE_ACTIVE_DOCUMENT',
          path: tabPath,
          content: body,
          source: 'tab-buffer',
        })
      } else if (rootDir) {
        const hadExternalChange = [...externalDiskChangedPaths].some((p) => pathsEqual(p, tabPath))
        if (hadExternalChange) {
          setExternalDiskChangedPaths((prev) => {
            const next = new Set(prev)
            for (const p of [...next]) {
              if (pathsEqual(p, tabPath)) next.delete(p)
            }
            return next
          })
          const snap = getDocumentRuntimeSnapshot()
          const tabDirty = Boolean(
            snap.dirtyByPath[tabPath] ||
              Object.entries(snap.dirtyByPath).some(([p, dirty]) => dirty && pathsEqual(p, tabPath)),
          )
          if (tabDirty) {
            const ok = await confirmAppDialog({
              title: t('app.confirm.title'),
              message: t('app.confirm.externalFileChangedDirty'),
              variant: 'warning',
            })
            if (isTabNavStale(navGeneration)) return
            if (ok) {
              await dispatchDocumentCommand({
                type: 'REVERT_DOCUMENT',
                root: rootDir,
                path: tabPath,
                source: 'external-fs-inactive-reload',
              })
              resetModeSwitchEditorBootstrap()
              bumpColdOpenGeneration()
              if (isTabNavStale(navGeneration)) return
              focusActiveEditor()
              return
            }
          }
        }
        if (isTabNavStale(navGeneration)) return
        const cached = resolveDocumentBodyForPath(tabPath)
        if (shouldUseCachedBody(tabPath, cached)) {
          await dispatchDocumentCommand({
            type: 'REPLACE_ACTIVE_DOCUMENT',
            path: tabPath,
            content: cached,
            source: 'tab-cache',
          })
        } else {
          bumpColdOpenGeneration()
          try {
            await dispatchOpenDocument(rootDir, tabPath)
          } catch (error) {
            setStatus(t('app.status.openFailed', { message: formatOpenDocumentError(error) }))
            return
          }
        }
      }
      if (isTabNavStale(navGeneration)) return
      applyTabEditorSession(tabPath)
      focusActiveEditor()
      if (mainPaneMode === 'visual') {
        schedulePrimeEditorDiagramPreviews(() => {
          const pm = visualEditorRef.current?.getEditor()
          return pm?.view?.dom ?? null
        })
      }
    },
    [
      rootDir,
      mainPaneMode,
      visualEditorRef,
      dispatchOpenDocument,
      formatOpenDocumentError,
      setStatus,
      dispatchDocumentCommand,
      focusActiveEditor,
      resetModeSwitchEditorBootstrap,
      logModeSwitchState,
      bumpColdOpenGeneration,
      confirmAppDialog,
      t,
      externalDiskChangedPaths,
      isTabNavStale,
      applyTabEditorSession,
      resolveDocumentBodyForPath,
    ],
  )

  const activateTab = useCallback(
    async (targetPath: string) => {
      if (pathsEqual(targetPath, activePath)) return
      const generation = ++tabNavGenerationRef.current
      const left = await leaveCurrentTab()
      if (!left) return
      if (isTabNavStale(generation)) return
      await loadTabContent(targetPath, generation)
      if (isTabNavStale(generation)) return
      persistWorkspaceSnapshotNow()
    },
    [activePath, leaveCurrentTab, loadTabContent, isTabNavStale],
  )

  const saveAllOpenTabs = useCallback(async () => {
    await saveAllDirtyDocuments()
  }, [saveAllDirtyDocuments])

  const scratchNewDocument = useCallback(async () => {
    const left = await leaveCurrentTab()
    if (!left) return
    resetModeSwitchEditorBootstrap()
    const id = newBufferTabId()
    bufferBodiesRef.current[id] = INITIAL_NOTE_MD
    setBufferTabLabels((prev) => ({ ...prev, [id]: '' }))
    await dispatchDocumentCommand({
      type: 'OPEN_SCRATCH_DOCUMENT',
      id,
      content: INITIAL_NOTE_MD,
      source: 'scratch',
    })
    setStatus(t('app.tab.scratchDoc'))
    focusActiveEditor()
  }, [leaveCurrentTab, focusActiveEditor, resetModeSwitchEditorBootstrap, t])

  const scratchNewTab = useCallback(async () => {
    const left = await leaveCurrentTab()
    if (!left) return
    resetModeSwitchEditorBootstrap()
    const id = newBufferTabId()
    bufferBodiesRef.current[id] = INITIAL_NOTE_MD
    setBufferTabLabels((prev) => ({ ...prev, [id]: '' }))
    await dispatchDocumentCommand({
      type: 'OPEN_SCRATCH_TAB',
      id,
      content: INITIAL_NOTE_MD,
      currentPath: activePath,
      source: 'scratch',
    })
    setStatus(t('app.tab.newScratch'))
    focusActiveEditor()
  }, [activePath, leaveCurrentTab, focusActiveEditor, resetModeSwitchEditorBootstrap, t])

  const dispatchOpenDocumentInTab = useCallback(
    async (root: string, path: string) => {
      if (!path) return
      console.log('[NAV] dispatchOpenDocumentInTab', {
        root,
        path,
        activePath: activePathRef.current,
      })
      if (isBufferTabId(path)) {
        await activateTab(path)
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
      const sameNoteOpen = pathsEqual(path, activePathRef.current)
      const left = await leaveCurrentTab()
      if (!left) return
      if (sameNoteOpen) {
        await dispatchDocumentCommand({
          type: 'SET_TABS',
          tabs: upsertPathInList(openedTabs, path),
          activePath,
          source: 'dispatchOpenDocumentInTab-same-note',
        })
        focusActiveEditor()
        await revealNavigationAnchorAfterOpen(path, contentRef.current, navigationGeneration)
        return
      }
      const cached = resolveDocumentBodyForPath(path)
      let loadedMarkdown: string
      if (shouldUseCachedBody(path, cached)) {
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
        loadedMarkdown = cached
      } else {
        try {
          const loaded = await dispatchDocumentCommand({
            type: 'OPEN_DOCUMENT_IN_TAB',
            root,
            path,
            source: 'dispatchOpenDocumentInTab-adapter',
          })
          loadedMarkdown = typeof loaded === 'string' ? loaded : contentRef.current
        } catch (error) {
          setStatus(t('app.status.openFailed', { message: formatOpenDocumentError(error) }))
          return
        }
      }
      await revealNavigationAnchorAfterOpen(path, loadedMarkdown, navigationGeneration)
    },
    [
      leaveCurrentTab,
      activateTab,
      activePath,
      openedTabs,
      focusActiveEditor,
      revealNavigationAnchorAfterOpen,
      formatOpenDocumentError,
      setStatus,
      resolveDocumentBodyForPath,
      shouldUseCachedBody,
      t,
    ],
  )

  flushEditorToMemoryRef.current = flushEditorToMemory

  const closeTab = useCallback(
    (path: string) => {
      const generation = ++tabNavGenerationRef.current
      void (async () => {
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
          let fallbackContent = ''
          if (isBufferTabId(fallback)) {
            fallbackContent = bufferBodiesRef.current[fallback] ?? INITIAL_NOTE_MD
          } else {
            const cached = resolveDocumentBodyForPath(fallback)
            if (cached != null) fallbackContent = cached
          }
          if (isTabNavStale(generation)) return
          await dispatchDocumentCommand({
            type: 'CLOSE_TAB',
            path,
            fallbackPath: fallback,
            fallbackContent,
            source: 'tab-close',
          })
          if (isTabNavStale(generation)) return
          await loadTabContent(fallback, generation)
          if (!isTabNavStale(generation)) persistWorkspaceSnapshotNow()
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
      })()
    },
    [
      activePath,
      openedTabs,
      loadTabContent,
      flushEditorToMemory,
      saveDocumentAtPath,
      resetModeSwitchEditorBootstrap,
      t,
      promptUnsavedChanges,
      isTabNavStale,
      releaseTabResources,
      resolveDocumentBodyForPath,
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
  }, [openedTabs.length])

  const handleTabContextPick = useCallback(
    (action: TabContextMenuPick, path: string, index: number) => {
      setTabContextMenu(null)
      const generation = ++tabNavGenerationRef.current
      void (async () => {
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
      })()
    },
    [
      activePath,
      openedTabs,
      loadTabContent,
      flushEditorToMemory,
      saveDocumentAtPath,
      resetModeSwitchEditorBootstrap,
      t,
      promptUnsavedChanges,
      isTabNavStale,
      releaseTabResources,
    ],
  )

  return {
    persistEditorToTabStores,
    flushEditorToMemory,
    saveDocumentAtPath,
    saveAllDirtyDocuments,
    leaveCurrentTab,
    loadTabContent,
    activateTab,
    saveAllOpenTabs,
    scratchNewDocument,
    scratchNewTab,
    dispatchOpenDocumentInTab,
    closeTab,
    onTabContextMenu,
    handleTabContextPick,
  }
}
