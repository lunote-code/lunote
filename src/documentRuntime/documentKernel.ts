import {
  documentEventTimestamp,
  publishDocumentEvent,
} from './documentEventStream'
import { enqueueDocumentCommand } from '../lib/saveQueue'
import { pathsEqual } from '../lib/workspacePathUtils'
import { normalizeLineEndings } from '../lib/normalizeLineEndings'
import { resumeAutosaveForPath } from '../documentHistory/historyRestoreState'
import type {
  DocumentCommand,
  DocumentRuntimeCapabilities,
  DocumentRuntimeSnapshot,
} from './documentTypes'
import {
  checkBlankContentSuspect,
  isTabNavLogEnabled,
  logTabNav,
  snapshotDocumentBodyMeta,
} from '../lib/tabNavigationDebug'
import {
  clampOpenTabList,
  isPathInOpenTabs,
  mergeOpenTabs,
  wouldExceedOpenTabLimit,
  wouldExceedOpenTabLimitForPaths,
} from '../app/document/openTabLimits'
import { parseFrontmatter } from '../editor/knowledgeRuntime/wikiLinkParser'

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

function editorSurfaceForDirtyCompare(markdown: string): string {
  return parseFrontmatter(markdown).body
}

function isContentDirty(path: string, content: string): boolean {
  const saved = getSavedContent(path)
  //Use a conservative strategy when the baseline is missing to avoid missing unsaved modifications
  if (saved === undefined) return true
  const currentSurface = editorSurfaceForDirtyCompare(content)
  const savedSurface = editorSurfaceForDirtyCompare(saved)
  return normalizeLineEndings(currentSurface) !== normalizeLineEndings(savedSurface)
}

/** Compare in-memory document body against the last saved/opened baseline (ignores YAML frontmatter). */
export function isDocumentContentDirty(path: string, content: string): boolean {
  return isContentDirty(path, content)
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

function currentDirtyFlagForPath(
  path: string,
  dirtyByPath: Readonly<Record<string, boolean>>,
): boolean {
  if (!path) return false
  return Object.entries(dirtyByPath).some(([key, dirty]) => dirty && pathsEqual(key, path))
}

function preserveDirtyFlagForPath(
  path: string,
  dirtyByPath: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const next = { ...dirtyByPath }
  const dirty = currentDirtyFlagForPath(path, dirtyByPath)
  for (const key of Object.keys(next)) {
    if (pathsEqual(key, path)) delete next[key]
  }
  if (dirty) next[path] = true
  return next
}

function logDirtyProbe(
  phase: string,
  args: {
    path: string
    content: string
    source?: string
    nextDirtyByPath: Readonly<Record<string, boolean>>
    extra?: Record<string, unknown>
  },
): void {
  if (!import.meta.env.DEV || !args.path) return
  const saved = getSavedContent(args.path)
  const dirtyBefore = currentDirtyFlagForPath(args.path, snapshot.dirtyByPath)
  const dirtyAfter = currentDirtyFlagForPath(args.path, args.nextDirtyByPath)
  const contentChangedAgainstSaved =
    saved === undefined ? null : normalizeLineEndings(args.content) !== normalizeLineEndings(saved)
  console.debug('[dirty-probe]', {
    phase,
    path: args.path,
    source: args.source ?? null,
    activePath: snapshot.activePath,
    dirtyBefore,
    dirtyAfter,
    changed: dirtyBefore !== dirtyAfter,
    contentChangedAgainstSaved,
    saved: snapshotDocumentBodyMeta(args.path, saved),
    content: snapshotDocumentBodyMeta(args.path, args.content),
    activeContent: snapshotDocumentBodyMeta(snapshot.activePath, snapshot.content),
    ...args.extra,
  })
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
      activeContent: editorSurfaceForDirtyCompare(content),
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
  if (isTabNavLogEnabled()) {
    logTabNav('kernel-content-change', {
      path,
      source: source ?? null,
      allowInactiveOpenPath,
      activePath: snapshot.activePath,
      content: snapshotDocumentBodyMeta(path, content),
      previousActiveContent: snapshotDocumentBodyMeta(snapshot.activePath, snapshot.content),
    })
  }
  checkBlankContentSuspect('kernel-apply-content-state', path, content, {
    source: source ?? null,
    allowInactiveOpenPath,
    activePath: snapshot.activePath,
  })
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
  const preserveDirtyDuringModeSwitch = source === 'mode-switch'
  if (isActivePath) {
    const nextDirtyByPath = preserveDirtyDuringModeSwitch
      ? preserveDirtyFlagForPath(path, snapshot.dirtyByPath)
      : dirtyFlagForPath(path, content, snapshot.dirtyByPath)
    logDirtyProbe('apply-open-document-content:active', {
      path,
      content,
      source,
      nextDirtyByPath,
      extra: {
        allowInactiveOpenPath,
        preserveDirtyDuringModeSwitch,
      },
    })
    capabilities?.renderContent(content)
    setKernelSnapshot({
      activePath: path,
      content,
      dirtyByPath: nextDirtyByPath,
    })
  } else {
    const nextDirtyByPath = preserveDirtyDuringModeSwitch
      ? preserveDirtyFlagForPath(path, snapshot.dirtyByPath)
      : dirtyFlagForPath(path, content, snapshot.dirtyByPath)
    logDirtyProbe('apply-open-document-content:inactive', {
      path,
      content,
      source,
      nextDirtyByPath,
      extra: {
        allowInactiveOpenPath,
        preserveDirtyDuringModeSwitch,
      },
    })
    setKernelSnapshot({
      dirtyByPath: nextDirtyByPath,
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

/** Mode switch must update the active document snapshot immediately before the new pane mounts. */
export function applyActiveDocumentContentImmediately(
  path: string,
  content: string,
  source?: string,
): void {
  applyOpenDocumentContentState(path, content, source, false)
}

async function dispatchDocumentCommandInner(command: DocumentCommand): Promise<string | void> {
  if (!capabilities) {
    throw new Error('DocumentRuntimeKernel has no registered capabilities')
  }

  switch (command.type) {
    case 'OPEN_DOCUMENT': {
      const traceId = command.traceId ?? `kernel-${Date.now()}`
      const rootChanged = Boolean(command.root) && command.root !== snapshot.rootDir
      const content = await capabilities.readDocument(command.root, command.path)
      capabilities.setActiveDocument(command.path, content)
      capabilities.onDocumentOpened?.(command.root, command.path, content)
      capabilities.onAfterOpen?.(command.path, content)
      if (rootChanged) clearSavedContent()
      setSavedContent(command.path, content)
      const nextDirtyByPath = rootChanged
        ? {}
        : dirtyFlagForPath(command.path, content, snapshot.dirtyByPath)
      logDirtyProbe('open-document', {
        path: command.path,
        content,
        source: command.source,
        nextDirtyByPath,
        extra: {
          commandType: command.type,
          root: command.root,
          rootChanged,
        },
      })
      setKernelSnapshot({
        rootDir: command.root,
        activePath: command.path,
        content,
        dirtyByPath: nextDirtyByPath,
      })
      publishDocumentEvent({
        type: 'DocumentOpened',
        root: command.root,
        path: command.path,
        content,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      if (isTabNavLogEnabled()) {
        logTabNav('kernel-set-active', {
          commandType: command.type,
          source: command.source ?? null,
          traceId,
          ...snapshotDocumentBodyMeta(command.path, content),
          root: command.root,
        })
      }
      checkBlankContentSuspect('kernel-open-document', command.path, content, {
        source: command.source ?? null,
        traceId,
        commandType: command.type,
      })
      return content
    }

    case 'OPEN_DOCUMENT_REVEAL': {
      const content = pathsEqual(snapshot.activePath, command.path)
        ? snapshot.content
        : await dispatchDocumentCommandInner({
            type: 'OPEN_DOCUMENT_IN_TAB',
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
      return content
    }

    case 'OPEN_DOCUMENT_IN_TAB': {
      if (wouldExceedOpenTabLimit(snapshot.openedTabs, command.path)) {
        capabilities?.onOpenTabLimitReached?.()
        return snapshot.content
      }
      const nextTabs = isPathInOpenTabs(snapshot.openedTabs, command.path)
        ? [...snapshot.openedTabs]
        : [...snapshot.openedTabs, command.path]
      if (isTabNavLogEnabled()) {
        logTabNav('kernel-open-document-in-tab', {
          path: command.path,
          root: command.root,
          source: command.source ?? null,
          tabAlreadyOpen: snapshot.openedTabs.some((tabPath) => pathsEqual(tabPath, command.path)),
          nextTabs,
          previousActivePath: snapshot.activePath,
        })
      }
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
      resumeAutosaveForPath(command.path)
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
        resumeAutosaveForPath(doc.path)
      }
      setKernelSnapshot({
        rootDir: command.root,
        ...(nextActiveContent !== undefined ? { content: nextActiveContent } : {}),
        dirtyByPath: nextDirty,
      })
      return
    }

    case 'SET_TABS': {
      const tabs = clampOpenTabList(command.tabs)
      if (tabs.length < command.tabs.length) {
        capabilities?.onOpenTabLimitReached?.()
      }
      capabilities.setTabs(tabs)
      pruneSavedContentForTabs(tabs)
      setKernelSnapshot({
        openedTabs: tabs,
        activePath: command.activePath ?? snapshot.activePath,
        dirtyByPath: pruneDirtyForTabs(tabs, snapshot.dirtyByPath),
      })
      publishDocumentEvent({
        type: 'TabsChanged',
        tabs,
        activePath: command.activePath,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return
    }

    case 'RESTORE_WORKSPACE': {
      const openTabs = clampOpenTabList(command.openTabs)
      if (openTabs.length < command.openTabs.length) {
        capabilities?.onOpenTabLimitReached?.()
      }
      capabilities.setTabs(openTabs)
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
          openedTabs: openTabs,
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
          openedTabs: openTabs,
          dirtyByPath: {},
        })
      }
      publishDocumentEvent({
        type: 'WorkspaceRestored',
        root: command.root,
        activePath: command.activePath,
        openTabs,
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
      const pathsToAdd = [
        ...(command.currentPath ? [command.currentPath] : []),
        command.id,
      ]
      if (wouldExceedOpenTabLimitForPaths(snapshot.openedTabs, pathsToAdd)) {
        capabilities?.onOpenTabLimitReached?.()
        return snapshot.content
      }
      const nextTabs = mergeOpenTabs(snapshot.openedTabs, pathsToAdd)
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
      resumeAutosaveForPath(command.path)
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

    case 'REPLACE_ACTIVE_DOCUMENT': {
      if (isTabNavLogEnabled()) {
        logTabNav('kernel-replace-active', {
          source: command.source ?? null,
          previousActivePath: snapshot.activePath,
          previousContent: snapshotDocumentBodyMeta(snapshot.activePath, snapshot.content),
          next: snapshotDocumentBodyMeta(command.path, command.content),
        })
      }
      checkBlankContentSuspect('kernel-replace-active-document', command.path, command.content, {
        source: command.source ?? null,
        previousActivePath: snapshot.activePath,
      })
      if (
        command.path &&
        !command.path.startsWith('luna:buf:') &&
        getSavedContent(command.path) === undefined
      ) {
        setSavedContent(command.path, command.content)
      }
      const nextDirtyByPath = dirtyFlagForPath(command.path, command.content, snapshot.dirtyByPath)
      logDirtyProbe('replace-active-document', {
        path: command.path,
        content: command.content,
        source: command.source,
        nextDirtyByPath,
        extra: {
          previousActivePath: snapshot.activePath,
        },
      })
      capabilities.setActiveDocument(command.path, command.content)
      setKernelSnapshot({
        activePath: command.path,
        content: command.content,
        dirtyByPath: nextDirtyByPath,
      })
      publishDocumentEvent({
        type: 'DocumentContentChanged',
        path: command.path,
        content: command.content,
        source: command.source,
        timestamp: documentEventTimestamp(),
      })
      return command.content
    }

    case 'REVERT_DOCUMENT': {
      const content = await capabilities.readDocument(command.root, command.path)
      capabilities.setActiveDocument(command.path, content)
      setSavedContent(command.path, content)
      resumeAutosaveForPath(command.path)
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

    case 'RESTORE_DOCUMENT_HISTORY_SNAPSHOT': {
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
        source: command.source ?? `history-restore:${command.snapshotId}`,
        timestamp: documentEventTimestamp(),
      })
      return command.content
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
