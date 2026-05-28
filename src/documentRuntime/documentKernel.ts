import {
  documentEventTimestamp,
  publishDocumentEvent,
} from './documentEventStream'
import { enqueueDocumentCommand } from '../lib/saveQueue'
import { pathsEqual } from '../lib/workspacePathUtils'
import { isCompatibilityTraceEnabled } from '../debug/compatibilityDebug'
import type {
  DocumentCommand,
  DocumentRuntimeCapabilities,
  DocumentRuntimeSnapshot,
} from './documentTypes'

const initialSnapshot: DocumentRuntimeSnapshot = {
  rootDir: '',
  activePath: '',
  content: '',
  openedTabs: [],
  dirtyByPath: {},
  updatedAt: 0,
}

let snapshot: DocumentRuntimeSnapshot = initialSnapshot
let capabilities: DocumentRuntimeCapabilities | null = null
const listeners = new Set<() => void>()
/** The text of each path that was last saved (or opened from disk) is used to determine whether it has really been modified.*/
let savedContentByPath: Record<string, string> = {}

/** The text when last saved or opened (three-way merge base, dirty judgment)*/
export function getDocumentSavedContent(path: string): string | undefined {
  return getSavedContent(path)
}

function getSavedContent(path: string): string | undefined {
  if (!path) return undefined
  for (const [key, content] of Object.entries(savedContentByPath)) {
    if (pathsEqual(key, path)) return content
  }
  return undefined
}

function setSavedContent(path: string, content: string): void {
  if (!path) return
  const next = { ...savedContentByPath }
  for (const key of Object.keys(next)) {
    if (pathsEqual(key, path)) delete next[key]
  }
  next[path] = content
  savedContentByPath = next
}

function deleteSavedContent(path: string): void {
  if (!path) return
  const next = { ...savedContentByPath }
  for (const key of Object.keys(next)) {
    if (pathsEqual(key, path)) delete next[key]
  }
  savedContentByPath = next
}

function pruneSavedContentForTabs(tabs: readonly string[]): void {
  const next: Record<string, string> = {}
  for (const [path, content] of Object.entries(savedContentByPath)) {
    if (tabs.some((tabPath) => pathsEqual(tabPath, path))) next[path] = content
  }
  savedContentByPath = next
}

function clearSavedContent(): void {
  savedContentByPath = {}
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/gu, '\n')
}

function isContentDirty(path: string, content: string): boolean {
  const saved = getSavedContent(path)
  //Use a conservative strategy when the baseline is missing to avoid missing unsaved modifications
  if (saved === undefined) return true
  return normalizeLineEndings(content) !== normalizeLineEndings(saved)
}

function dirtyFlagForPath(
  path: string,
  content: string,
  dirtyByPath: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const dirty = isContentDirty(path, content)
  const next = { ...dirtyByPath }
  for (const key of Object.keys(next)) {
    if (pathsEqual(key, path)) delete next[key]
  }
  if (dirty) next[path] = true
  return next
}

function isAgentLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_AGENT_LOG__?: boolean }
  if (g.__KOS_AGENT_LOG__ === true) return true
  try {
    return localStorage.getItem('kos.agentLog') === '1'
  } catch {
    return false
  }
}

function devQuickHash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

function isDevSaveReadbackVerifyEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_SAVE_READBACK_VERIFY__?: boolean }
  if (g.__KOS_SAVE_READBACK_VERIFY__ === true) return true
  try {
    return localStorage.getItem('kos.saveReadbackVerify') === '1'
  } catch {
    return false
  }
}

function isDirtyTraceEnabled(): boolean {
  return isCompatibilityTraceEnabled('dirty')
}

function devPreSaveDiagnostic(command: Extract<DocumentCommand, { type: 'SAVE_DOCUMENT' }>): void {
  if (!import.meta.env.DEV) return
  const activePath = snapshot.activePath
  const activeMatches = pathsEqual(activePath, command.path)
  const activeContentHash = activeMatches ? devQuickHash(snapshot.content) : null
  const saveHash = devQuickHash(command.content)
  const saveLen = command.content.length

  console.debug('[save-preflight]', {
    source: command.source ?? null,
    path: command.path,
    activePath,
    activeMatches,
    saveLen,
    saveHash,
    activeContentHash,
    dirtyFlag: Boolean(
      snapshot.dirtyByPath[command.path] ||
        Object.entries(snapshot.dirtyByPath).some(([p, dirty]) => dirty && pathsEqual(p, command.path)),
    ),
  })

  if (command.source === 'saveCurrent' && !activeMatches) {
    console.warn('[save-preflight] saveCurrent path is not activePath', {
      path: command.path,
      activePath,
      source: command.source ?? null,
    })
  }
  if (activeMatches && snapshot.content !== command.content) {
    console.warn('[save-preflight] active snapshot differs from save payload', {
      path: command.path,
      source: command.source ?? null,
      activeContentHash,
      saveHash,
      activeContentLen: snapshot.content.length,
      saveLen,
    })
  }
}

async function devPostSaveReadbackVerify(
  command: Extract<DocumentCommand, { type: 'SAVE_DOCUMENT' }>,
): Promise<void> {
  if (!isDevSaveReadbackVerifyEnabled()) return
  const reader = capabilities?.readDocumentForVerify
  if (!reader) {
    console.warn('[save-readback] readDocumentForVerify unavailable; skip', {
      path: command.path,
      source: command.source ?? null,
    })
    return
  }
  try {
    const disk = await reader(command.root, command.path)
    const payloadHash = devQuickHash(command.content)
    const diskHash = devQuickHash(disk)
    if (payloadHash !== diskHash || disk.length !== command.content.length) {
      console.warn('[save-readback] hash mismatch', {
        path: command.path,
        source: command.source ?? null,
        payloadHash,
        diskHash,
        payloadLen: command.content.length,
        diskLen: disk.length,
      })
    } else {
      console.debug('[save-readback] verified', {
        path: command.path,
        source: command.source ?? null,
        hash: payloadHash,
        len: disk.length,
      })
    }
  } catch (error) {
    console.warn('[save-readback] read failed', {
      path: command.path,
      source: command.source ?? null,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function applySavedDocumentState(path: string, content: string, dirtyByPath: Readonly<Record<string, boolean>>): {
  dirtyByPath: Record<string, boolean>
  activeContent?: string
} {
  setSavedContent(path, content)
  const nextDirty = dirtyFlagForPath(path, content, dirtyByPath)
  if (pathsEqual(snapshot.activePath, path)) {
    capabilities?.renderContent(content)
    return {
      dirtyByPath: nextDirty,
      activeContent: content,
    }
  }
  return { dirtyByPath: nextDirty }
}

function applyOpenDocumentContentState(
  path: string,
  content: string,
  source: string | undefined,
  allowInactiveOpenPath: boolean,
): void {
  const isActivePath = !snapshot.activePath || pathsEqual(path, snapshot.activePath)
  if (!isActivePath && !allowInactiveOpenPath) {
    if (import.meta.env.DEV) {
      console.warn('[document-kernel] ignore content change for non-active path', {
        commandPath: path,
        activePath: snapshot.activePath,
        source,
      })
    }
    return
  }
  if (!isActivePath) {
    const isOpened = snapshot.openedTabs.some((tabPath) => pathsEqual(tabPath, path))
    if (!isOpened) {
      if (import.meta.env.DEV) {
        console.warn('[document-kernel] ignore content change for unopened path', {
          commandPath: path,
          activePath: snapshot.activePath,
          source,
        })
      }
      return
    }
  }
  if (isDirtyTraceEnabled()) {
    const saved = getSavedContent(path)
    console.info('[dirty-trace] content changed', {
      path,
      source: source ?? null,
      contentHash: devQuickHash(content),
      contentLen: content.length,
      savedHash: saved ? devQuickHash(saved) : null,
      savedLen: saved?.length ?? null,
      activePath: snapshot.activePath,
      backgroundUpdate: !isActivePath,
    })
  }
  if (isActivePath) {
    capabilities?.renderContent(content)
    setKernelSnapshot({
      activePath: path,
      content,
      dirtyByPath: dirtyFlagForPath(path, content, snapshot.dirtyByPath),
    })
  } else {
    setKernelSnapshot({
      dirtyByPath: dirtyFlagForPath(path, content, snapshot.dirtyByPath),
    })
  }
  publishDocumentEvent({
    type: 'DocumentContentChanged',
    path,
    content,
    source,
    timestamp: documentEventTimestamp(),
  })
}

function notify(): void {
  for (const listener of listeners) listener()
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((value, index) => pathsEqual(value, b[index] ?? ''))
}

function dirtyMapsEqual(
  a: Readonly<Record<string, boolean>>,
  b: Readonly<Record<string, boolean>>,
): boolean {
  if (a === b) return true
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => a[key] === b[key])
}

function snapshotsEqual(a: DocumentRuntimeSnapshot, b: DocumentRuntimeSnapshot): boolean {
  return (
    pathsEqual(a.rootDir, b.rootDir) &&
    pathsEqual(a.activePath, b.activePath) &&
    a.content === b.content &&
    arraysEqual(a.openedTabs, b.openedTabs) &&
    dirtyMapsEqual(a.dirtyByPath, b.dirtyByPath)
  )
}

function setKernelSnapshot(
  next: Partial<Omit<DocumentRuntimeSnapshot, 'updatedAt'>>,
): DocumentRuntimeSnapshot {
  const nextSnapshot: DocumentRuntimeSnapshot = {
    ...snapshot,
    ...next,
    openedTabs: next.openedTabs ? [...next.openedTabs] : snapshot.openedTabs,
    dirtyByPath: next.dirtyByPath ? { ...next.dirtyByPath } : snapshot.dirtyByPath,
    updatedAt: Date.now(),
  }
  if (snapshotsEqual(snapshot, nextSnapshot)) return snapshot
  snapshot = nextSnapshot
  notify()
  return getDocumentRuntimeSnapshot()
}

export function getDocumentRuntimeSnapshot(): DocumentRuntimeSnapshot {
  return snapshot
}

export function subscribeDocumentRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function registerDocumentRuntimeCapabilities(
  next: DocumentRuntimeCapabilities | null,
): void {
  capabilities = next
}

function pruneDirtyForTabs(
  tabs: readonly string[],
  dirtyByPath: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const [path, dirty] of Object.entries(dirtyByPath)) {
    if (dirty && tabs.some((tabPath) => pathsEqual(tabPath, path))) next[path] = true
  }
  return next
}

export async function dispatchDocumentCommand(command: DocumentCommand): Promise<string | void> {
  return enqueueDocumentCommand(() => dispatchDocumentCommandInner(command))
}

async function dispatchDocumentCommandInner(command: DocumentCommand): Promise<string | void> {
  if (command.type === 'OPEN_DOCUMENT' || command.type === 'OPEN_DOCUMENT_IN_TAB' || command.type === 'OPEN_DOCUMENT_REVEAL') {
    const traceId = command.traceId ?? `kernel-${Date.now()}`
    if (isAgentLogEnabled()) {
      // #region agent log
      console.debug('[kernel-open]', { traceId, docKey: null, resolvedPath: command.path, root: command.root, eventType: null, commandType: command.type, source: command.source ?? null, hasCapabilities: Boolean(capabilities) })
      // #endregion
    }
  }
  if (!capabilities) {
    throw new Error('DocumentRuntimeKernel has no registered capabilities')
  }

  switch (command.type) {
    case 'OPEN_DOCUMENT': {
      const traceId = command.traceId ?? `kernel-${Date.now()}`
      const rootChanged = Boolean(command.root) && command.root !== snapshot.rootDir
      try {
        const content = await capabilities.readDocument(command.root, command.path)
        capabilities.setActiveDocument(command.path, content)
        capabilities.onDocumentOpened?.(command.root, command.path, content)
        capabilities.onAfterOpen?.(command.path, content)
        if (rootChanged) clearSavedContent()
        setSavedContent(command.path, content)
        setKernelSnapshot({
          rootDir: command.root,
          activePath: command.path,
          content,
          ...(rootChanged
            ? { dirtyByPath: {} }
            : { dirtyByPath: dirtyFlagForPath(command.path, content, snapshot.dirtyByPath) }),
        })
        publishDocumentEvent({
          type: 'DocumentOpened',
          root: command.root,
          path: command.path,
          content,
          source: command.source,
          timestamp: documentEventTimestamp(),
        })
        if (isAgentLogEnabled()) {
          // #region agent log
          console.debug('[kernel-open-success]', { traceId, docKey: null, resolvedPath: command.path, root: command.root, eventType: null, commandType: command.type, source: command.source ?? null, contentLength: content.length, activePath: snapshot.activePath })
          // #endregion
        }
        return content
      } catch (error) {
        if (isAgentLogEnabled()) {
          // #region agent log
          console.debug('[kernel-open-failed]', { traceId, docKey: null, resolvedPath: command.path, root: command.root, eventType: null, commandType: command.type, source: command.source ?? null, error: error instanceof Error ? error.message : String(error) })
          // #endregion
        }
        throw error
      }
    }

    case 'OPEN_DOCUMENT_REVEAL': {
      const content = pathsEqual(snapshot.activePath, command.path)
        ? snapshot.content
        : await dispatchDocumentCommandInner({
            type: 'OPEN_DOCUMENT',
            root: command.root,
            path: command.path,
            source: command.source,
            traceId: command.traceId,
          }) as string
      publishDocumentEvent({
        type: 'DocumentRevealRequested',
        root: command.root,
        path: command.path,
        docKey: command.docKey,
        heading: command.heading,
        blockId: command.blockId,
        content,
        source: command.source,
        traceId: command.traceId,
        timestamp: documentEventTimestamp(),
      })
      if (isAgentLogEnabled()) {
        // #region agent log
        console.debug('[document-reveal-requested]', { traceId: command.traceId ?? null, docKey: command.docKey ?? null, resolvedPath: command.path, root: command.root, eventType: 'DocumentRevealRequested', commandType: command.type, heading: command.heading ?? null, blockId: command.blockId ?? null })
        // #endregion
      }
      return content
    }

    case 'OPEN_DOCUMENT_IN_TAB': {
      const nextTabs = snapshot.openedTabs.some((tabPath) => pathsEqual(tabPath, command.path))
        ? [...snapshot.openedTabs]
        : [...snapshot.openedTabs, command.path]
      capabilities.setTabs(nextTabs)
      setKernelSnapshot({ openedTabs: nextTabs })
      publishDocumentEvent({
        type: 'TabsChanged',
        tabs: nextTabs,
        activePath: snapshot.activePath,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return dispatchDocumentCommandInner({
        type: 'OPEN_DOCUMENT',
        root: command.root,
        path: command.path,
        source: command.source,
        traceId: command.traceId,
      })
    }

    case 'DOCUMENT_CONTENT_CHANGED': {
      applyOpenDocumentContentState(command.path, command.content, command.source, false)
      return
    }

    case 'UPDATE_OPEN_DOCUMENT_CONTENT': {
      applyOpenDocumentContentState(command.path, command.content, command.source, true)
      return
    }

    case 'NORMALIZE_DOCUMENT_CONTENT': {
      if (snapshot.activePath && !pathsEqual(command.path, snapshot.activePath)) {
        if (import.meta.env.DEV) {
          console.warn('[document-kernel] ignore normalize for non-active path', {
            commandPath: command.path,
            activePath: snapshot.activePath,
            source: command.source,
          })
        }
        return
      }
      if (isDirtyTraceEnabled()) {
        console.info('[dirty-trace] normalize content', {
          path: command.path,
          source: command.source ?? null,
          contentHash: devQuickHash(command.content),
          contentLen: command.content.length,
        })
      }
      capabilities.renderContent(command.content)
      setKernelSnapshot({
        activePath: command.path,
        content: command.content,
        dirtyByPath: dirtyFlagForPath(command.path, command.content, snapshot.dirtyByPath),
      })
      publishDocumentEvent({
        type: 'DocumentContentChanged',
        path: command.path,
        content: command.content,
        source: command.source ?? 'normalize',
        timestamp: documentEventTimestamp(),
      })
      return
    }

    case 'SAVE_DOCUMENT':
      devPreSaveDiagnostic(command)
      await capabilities.writeDocument(command.root, command.path, command.content, {
        forceOverwrite: command.forceOverwrite,
      })
      await devPostSaveReadbackVerify(command)
      capabilities.onDocumentSaved?.(command.root, command.path, command.content)
      {
        const savedState = applySavedDocumentState(command.path, command.content, snapshot.dirtyByPath)
        setKernelSnapshot({
          rootDir: command.root,
          ...(savedState.activeContent !== undefined ? { content: savedState.activeContent } : {}),
          dirtyByPath: savedState.dirtyByPath,
        })
      }
      publishDocumentEvent({
        type: 'DocumentSaved',
        root: command.root,
        path: command.path,
        content: command.content,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return

    case 'SAVE_DOCUMENT_BATCH': {
      if (command.documents.length === 0) return
      let nextDirty = snapshot.dirtyByPath
      let nextActiveContent: string | undefined
      for (const doc of command.documents) {
        await capabilities.writeDocument(command.root, doc.path, doc.content, {
          forceOverwrite: command.forceOverwrite,
        })
        capabilities.onDocumentSaved?.(command.root, doc.path, doc.content)
        const savedState = applySavedDocumentState(doc.path, doc.content, nextDirty)
        nextDirty = savedState.dirtyByPath
        if (savedState.activeContent !== undefined) nextActiveContent = savedState.activeContent
        publishDocumentEvent({
          type: 'DocumentSaved',
          root: command.root,
          path: doc.path,
          content: doc.content,
          source: command.source,
          timestamp: documentEventTimestamp(),
        })
      }
      setKernelSnapshot({
        rootDir: command.root,
        ...(nextActiveContent !== undefined ? { content: nextActiveContent } : {}),
        dirtyByPath: nextDirty,
      })
      return
    }

    case 'SET_TABS':
      capabilities.setTabs(command.tabs)
      pruneSavedContentForTabs(command.tabs)
      setKernelSnapshot({
        openedTabs: command.tabs,
        activePath: command.activePath ?? snapshot.activePath,
        dirtyByPath: pruneDirtyForTabs(command.tabs, snapshot.dirtyByPath),
      })
      publishDocumentEvent({
        type: 'TabsChanged',
        tabs: command.tabs,
        activePath: command.activePath,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return

    case 'RESTORE_WORKSPACE': {
      capabilities.setTabs(command.openTabs)
      if (command.activePath) {
        const content = await capabilities.readDocument(command.root, command.activePath)
        capabilities.setActiveDocument(command.activePath, content)
        capabilities.onDocumentOpened?.(command.root, command.activePath, content)
        clearSavedContent()
        setSavedContent(command.activePath, content)
        setKernelSnapshot({
          rootDir: command.root,
          activePath: command.activePath,
          content,
          openedTabs: command.openTabs,
          dirtyByPath: {},
        })
      } else {
        const content = command.emptyContent ?? ''
        capabilities.setActiveDocument('', content)
        clearSavedContent()
        setKernelSnapshot({
          rootDir: command.root,
          activePath: '',
          content,
          openedTabs: command.openTabs,
          dirtyByPath: {},
        })
      }
      publishDocumentEvent({
        type: 'WorkspaceRestored',
        root: command.root,
        activePath: command.activePath,
        openTabs: command.openTabs,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return command.activePath ? snapshot.content : undefined
    }

    case 'OPEN_SCRATCH_DOCUMENT':
      capabilities.setTabs([command.id])
      capabilities.setActiveDocument(command.id, command.content)
      setSavedContent(command.id, command.content)
      setKernelSnapshot({
        activePath: command.id,
        content: command.content,
        openedTabs: [command.id],
        dirtyByPath: dirtyFlagForPath(command.id, command.content, snapshot.dirtyByPath),
      })
      publishDocumentEvent({
        type: 'DocumentOpened',
        root: snapshot.rootDir,
        path: command.id,
        content: command.content,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return command.content

    case 'OPEN_SCRATCH_TAB': {
      const nextTabs = [...new Set([
        ...snapshot.openedTabs,
        ...(command.currentPath ? [command.currentPath] : []),
        command.id,
      ])]
      capabilities.setTabs(nextTabs)
      capabilities.setActiveDocument(command.id, command.content)
      setSavedContent(command.id, command.content)
      setKernelSnapshot({
        activePath: command.id,
        content: command.content,
        openedTabs: nextTabs,
        dirtyByPath: dirtyFlagForPath(command.id, command.content, snapshot.dirtyByPath),
      })
      publishDocumentEvent({
        type: 'TabsChanged',
        tabs: nextTabs,
        activePath: command.id,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return command.content
    }

    case 'CLOSE_TAB': {
      const nextTabs = snapshot.openedTabs.filter((tabPath) => !pathsEqual(tabPath, command.path))
      capabilities.setTabs(nextTabs)
      const closingActive = pathsEqual(snapshot.activePath, command.path)
      const fallbackPath = closingActive ? command.fallbackPath ?? '' : snapshot.activePath
      const fallbackContent = closingActive ? command.fallbackContent ?? '' : snapshot.content
      deleteSavedContent(command.path)
      const nextDirty = { ...snapshot.dirtyByPath }
      for (const key of Object.keys(nextDirty)) {
        if (pathsEqual(key, command.path)) delete nextDirty[key]
      }
      if (closingActive) {
        capabilities.setActiveDocument(fallbackPath, fallbackContent)
      }
      setKernelSnapshot({
        activePath: fallbackPath,
        content: fallbackContent,
        openedTabs: nextTabs,
        dirtyByPath: nextDirty,
      })
      publishDocumentEvent({
        type: 'TabsChanged',
        tabs: nextTabs,
        activePath: fallbackPath,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return fallbackContent
    }

    case 'REPLACE_ACTIVE_DOCUMENT':
      capabilities.setActiveDocument(command.path, command.content)
      setKernelSnapshot({
        activePath: command.path,
        content: command.content,
        dirtyByPath: dirtyFlagForPath(command.path, command.content, snapshot.dirtyByPath),
      })
      publishDocumentEvent({
        type: 'DocumentContentChanged',
        path: command.path,
        content: command.content,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return command.content

    case 'REVERT_DOCUMENT': {
      const content = await capabilities.readDocument(command.root, command.path)
      capabilities.setActiveDocument(command.path, content)
      setSavedContent(command.path, content)
      setKernelSnapshot({
        rootDir: command.root,
        activePath: command.path,
        content,
        dirtyByPath: dirtyFlagForPath(command.path, content, snapshot.dirtyByPath),
      })
      publishDocumentEvent({
        type: 'DocumentContentChanged',
        path: command.path,
        content,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return content
    }

    case 'ASSET_IMPORTED':
      publishDocumentEvent({
        type: 'AssetImported',
        documentPath: command.documentPath,
        assetIds: command.assetIds,
        content: command.content,
        workspaceId: command.workspaceId,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return
  }
}

export function resetDocumentRuntimeKernel(): void {
  snapshot = initialSnapshot
  capabilities = null
  listeners.clear()
  clearSavedContent()
}
