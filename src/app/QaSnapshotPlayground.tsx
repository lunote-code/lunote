import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'

import './styles/dialogs-app.css'
import './styles/editor-document-history.css'
import { DocumentHistoryDialog } from './components/DocumentHistoryDialog'
import { setTabBody, getTabBody, installTabBodiesKernelSync } from '../app/document/tabBodiesStore'
import { resolveDocumentBody, resolveLatestDocumentBody } from '../documentRuntime/documentAuthority'
import { projectDocumentMemorySurfaces } from '../lib/editorContentSync'
import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import type { DocumentRuntimeCapabilities } from '../documentRuntime/documentTypes'
import {
  createManualSnapshotForDocument,
  restoreSnapshotToEditor,
} from '../documentHistory/historyService'
import type { DocumentHistoryEntry, DocumentHistorySnapshot } from '../documentHistory/types'
import { getHistoryRestoreState, isAutosaveSuspended } from '../documentHistory/historyRestoreState'
import { pathsEqual } from '../lib/workspacePathUtils'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { setSetting } from '../settings-runtime/settingsRuntime'
import { getCurrentThemeMode, refreshThemeFromSettings } from '../theme-runtime/themeRuntime'

type HistoryStore = {
  entries: DocumentHistoryEntry[]
  snapshots: Record<string, DocumentHistorySnapshot>
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>
    }
    __QA_SNAPSHOT__?: {
      getEditorBody: () => string
      listSnapshotIds: () => string[]
      getSnapshotContent: (id: string) => string | null
      getRestoredSnapshotId: () => string | null
      setThemeMode: (mode: 'light' | 'dark') => Promise<void>
      getThemeMode: () => 'light' | 'dark'
      previewHeadingColor: () => string
      openHistoryDialog: () => void
      openHistoryForPath: (path: string) => void
      setTabBodyForPath: (path: string, body: string) => void
      setPendingEditorBody: (body: string) => void
      getActivePath: () => string
      activateTab: (path: string) => Promise<void>
      getTabBodyForPath: (path: string) => string | undefined
      hasHistoryRestorePending: (path?: string) => boolean
      clearSnapshots: () => void
      getFlushCount: () => number
      resetFlushCount: () => void
    }
  }
}

const QA_ROOT = '/qa-vault'
const QA_PATH = '/qa-vault/note.md'
const QA_PATH_B = '/qa-vault/other.md'
const QA_INITIAL_BODY = '# Current Editor\nLive body\n'
const QA_INITIAL_BODY_B = '# Other Editor\nOther live body\n'

const QA_APP_SETTINGS = {
  ...DEFAULT_APP_SETTINGS,
  language: 'en' as const,
  appearance: {
    ...DEFAULT_APP_SETTINGS.appearance,
    theme: { active: 'github-light' },
  },
}

const MESSAGES: Record<string, string> = {
  'app.history.dialog.title': 'Version history',
  'app.history.dialog.help': 'Select a snapshot to preview, then restore if needed.',
  'app.history.dialog.snapshots': 'Snapshots',
  'app.history.dialog.count': '{count} total',
  'app.history.dialog.close': 'Close',
  'app.history.dialog.restoreCurrent': 'Restored',
  'app.history.dialog.restoreHint': 'Restore loads the snapshot into the editor; save manually to write disk.',
  'app.history.dialog.restoreCurrentHint': 'This version is already in the editor; autosave remains paused.',
  'app.history.dialog.deleteConfirm': 'Delete this snapshot? This cannot be undone.',
  'app.history.dialog.creating': 'Creating…',
  'menu.file.history.createSnapshot': 'Create snapshot',
  'app.history.dialog.delete': 'Delete snapshot',
  'app.history.dialog.deleteAll': 'Delete all snapshots',
  'app.history.dialog.deleteAllConfirm': 'Delete all {count} snapshots for this note?',
  'app.history.dialog.deletingAll': 'Deleting…',
  'app.history.allSnapshotsDeleted': 'Deleted {count} snapshots.',
  'app.history.dialog.restoreSnapshot': 'Restore snapshot',
  'app.history.dialog.loading': 'Loading snapshot…',
  'app.history.dialog.preview': 'Preview',
  'app.history.dialog.diff': 'Diff',
  'app.history.dialog.currentBody': 'Current',
  'app.history.dialog.snapshotBody': 'Snapshot',
  'app.history.dialog.diffSame': 'Current content matches this snapshot.',
  'app.history.dialog.selectSnapshot': 'Select a snapshot to preview',
  'app.history.dialog.currentRestored': 'Current editor state',
  'app.history.dialog.snapshotMeta': '{size} bytes',
  'app.history.noSnapshots': 'No snapshots yet.',
  'app.history.source.manual': 'Manual snapshot',
  'app.history.source.preRestore': 'Pre-restore backup',
  'app.history.dialog.contextHint': 'Right-click for actions',
  'app.history.dialog.resizeSplit': 'Drag to resize snapshot list',
  'app.history.snapshotCreated': 'Snapshot created.',
  'app.history.restoredPendingSave': 'Restored to editor; autosave paused until you save',
  'app.rename.cancel': 'Cancel',
  'ctx.file.delete': 'Delete',
}

function t(key: string, vars?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, token) => String(vars[token] ?? `{${token}}`))
}

function createEntry(
  id: string,
  path: string,
  createdAt: number,
  content: string,
  source: 'manual' | 'pre_restore' = 'manual',
): DocumentHistoryEntry {
  return {
    id,
    workspaceId: 'qa-vault',
    path,
    createdAt,
    source,
    title: content.split('\n')[0]?.replace(/^#\s*/, '') || null,
    excerpt: content.split('\n')[1] || null,
    contentHash: `hash-${id}`,
    size: content.length,
  }
}

function createInitialStore(): HistoryStore {
  const first = createEntry('snap-qa-1', QA_PATH, Date.now() - 60_000, '# Snapshot One\nBody one\n')
  const second = createEntry('snap-qa-2', QA_PATH, Date.now() - 30_000, '# Snapshot Two\nBody two\n')
  const other = createEntry(
    'snap-other-1',
    QA_PATH_B,
    Date.now() - 45_000,
    '# Other Snapshot\nOther body\n',
  )
  return {
    entries: [second, first, other],
    snapshots: {
      [first.id]: { entry: first, content: '# Snapshot One\nBody one\n' },
      [second.id]: { entry: second, content: '# Snapshot Two\nBody two\n' },
      [other.id]: { entry: other, content: '# Other Snapshot\nOther body\n' },
    },
  }
}

function installTauriHistoryMock(storeRef: MutableRefObject<HistoryStore>, onStoreChange: () => void): void {
  window.__TAURI_INTERNALS__ = {
    ...(window.__TAURI_INTERNALS__ ?? {}),
    invoke: async (cmd: string, args?: Record<string, unknown>) => {
      const payload = (args?.payload as Record<string, unknown> | undefined) ?? {}
      const snapshotId = String(payload.snapshotId ?? '')
      switch (cmd) {
        case 'list_document_snapshots': {
          const listPath = String(payload.path ?? '')
          return storeRef.current.entries.filter((entry) => entry.path === listPath)
        }
        case 'read_document_snapshot': {
          const snapshot = storeRef.current.snapshots[snapshotId]
          if (!snapshot) throw new Error(`missing snapshot ${snapshotId}`)
          return snapshot
        }
        case 'create_document_snapshot': {
          const content = String(payload.content ?? '')
          const id = `snap-qa-${Date.now()}`
          const entry = createEntry(
            id,
            String(payload.path ?? QA_PATH),
            Date.now(),
            content,
            (payload.source as 'manual' | 'pre_restore' | undefined) ?? 'manual',
          )
          storeRef.current = {
            entries: [entry, ...storeRef.current.entries],
            snapshots: {
              ...storeRef.current.snapshots,
              [entry.id]: { entry, content },
            },
          }
          onStoreChange()
          return entry
        }
        case 'delete_document_snapshot': {
          storeRef.current.entries = storeRef.current.entries.filter((entry) => entry.id !== snapshotId)
          delete storeRef.current.snapshots[snapshotId]
          onStoreChange()
          return null
        }
        case 'delete_all_document_snapshots': {
          const count = storeRef.current.entries.length
          storeRef.current = { entries: [], snapshots: {} }
          onStoreChange()
          return count
        }
        default:
          throw new Error(`Unhandled QA invoke: ${cmd}`)
      }
    },
  }
}

function installDocumentRuntime(initialBodies: Record<string, string>): DocumentRuntimeCapabilities {
  const disk = new Map<string, string>(Object.entries(initialBodies))

  const capabilities: DocumentRuntimeCapabilities = {
    readDocument: async (_root, path) => disk.get(path) ?? '',
    writeDocument: async (_root, path, content) => {
      disk.set(path, content)
    },
    setActiveDocument: () => {},
    renderContent: () => {},
    setTabs: () => {},
  }

  registerDocumentRuntimeCapabilities(capabilities)
  return capabilities
}

export function QaSnapshotPlayground() {
  const storeRef = useRef<HistoryStore>(createInitialStore())
  const flushCountRef = useRef(0)
  const [status, setStatus] = useState('booting')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPath, setHistoryPath] = useState(QA_PATH)
  const [activePath, setActivePath] = useState(QA_PATH)
  const [editorBody, setEditorBody] = useState(QA_INITIAL_BODY)
  const [, bumpStore] = useState(0)
  const openedTabsRef = useRef([QA_PATH, QA_PATH_B])
  const activePathRef = useRef(QA_PATH)
  activePathRef.current = activePath

  const syncEditorFromRuntime = useCallback(() => {
    const path = activePathRef.current
    setEditorBody(resolveDocumentBody(path) ?? getDocumentRuntimeSnapshot().content)
  }, [])

  const activateTab = useCallback(async (path: string) => {
    if (pathsEqual(path, activePathRef.current)) return
    const body =
      resolveLatestDocumentBody(path) ??
      getTabBody(path) ??
      resolveDocumentBody(path) ??
      ''
    const projected = projectDocumentMemorySurfaces(path, body)
    await dispatchDocumentCommand({
      type: 'SET_TABS',
      tabs: openedTabsRef.current,
      activePath: path,
      source: 'qa-snapshot-activate',
    })
    await dispatchDocumentCommand({
      type: 'REPLACE_ACTIVE_DOCUMENT',
      path,
      content: projected.editorSurface,
      source: 'qa-snapshot-activate',
    })
    setActivePath(path)
    setEditorBody(projected.editorSurface)
    setStatus(`activated:${path.split('/').pop() ?? path}`)
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests(QA_APP_SETTINGS)
    refreshThemeFromSettings()

    resetDocumentRuntimeKernel()
    installDocumentRuntime({
      [QA_PATH]: QA_INITIAL_BODY,
      [QA_PATH_B]: QA_INITIAL_BODY_B,
    })
    installTauriHistoryMock(storeRef, () => bumpStore((n) => n + 1))
    const unsubBodies = installTabBodiesKernelSync()

    void (async () => {
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: QA_ROOT,
        path: QA_PATH,
        source: 'qa-snapshot-boot',
      })
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: QA_PATH,
        content: QA_INITIAL_BODY,
        source: 'qa-snapshot-boot',
      })
      await dispatchDocumentCommand({
        type: 'SET_TABS',
        tabs: [QA_PATH, QA_PATH_B],
        activePath: QA_PATH,
        source: 'qa-snapshot-boot-tabs',
      })
      setTabBody(QA_PATH_B, QA_INITIAL_BODY_B)
      setEditorBody(resolveDocumentBody(QA_PATH) ?? getDocumentRuntimeSnapshot().content)
      setStatus('ready')
    })()

    return () => {
      unsubBodies()
      registerDocumentRuntimeCapabilities(null)
      resetDocumentRuntimeKernel()
      delete window.__QA_SNAPSHOT__
    }
  }, [])

  useEffect(() => {
    window.__QA_SNAPSHOT__ = {
      getEditorBody: () => {
        const runtime = getDocumentRuntimeSnapshot()
        return resolveDocumentBody(runtime.activePath) ?? runtime.content
      },
      getActivePath: () => getDocumentRuntimeSnapshot().activePath,
      getTabBodyForPath: (path: string) => getTabBody(path),
      listSnapshotIds: () =>
        storeRef.current.entries.filter((entry) => entry.path === historyPath).map((entry) => entry.id),
      getSnapshotContent: (id) => storeRef.current.snapshots[id]?.content ?? null,
      getRestoredSnapshotId: () => getHistoryRestoreState(historyPath)?.snapshotId ?? null,
      setThemeMode: async (mode) => {
        await setSetting('theme.active', mode === 'light' ? 'github-light' : 'github-dark')
        refreshThemeFromSettings()
      },
      getThemeMode: () => getCurrentThemeMode(),
      previewHeadingColor: () => {
        const el = document.querySelector('.document-history-preview-content h1')
        return el ? getComputedStyle(el).color : ''
      },
      openHistoryDialog: () => {
        setHistoryPath(activePath)
        setHistoryOpen(true)
      },
      openHistoryForPath: (path: string) => {
        setHistoryPath(path)
        setHistoryOpen(true)
      },
      setTabBodyForPath: (path: string, body: string) => {
        setTabBody(path, body)
        if (path === activePath) setEditorBody(body)
      },
      setPendingEditorBody: (body: string) => {
        setTabBody(activePath, body)
        setEditorBody(body)
      },
      clearSnapshots: () => {
        storeRef.current = { entries: [], snapshots: {} }
        bumpStore((n) => n + 1)
      },
      getFlushCount: () => flushCountRef.current,
      resetFlushCount: () => {
        flushCountRef.current = 0
      },
      activateTab,
      hasHistoryRestorePending: (path) => isAutosaveSuspended(path ?? activePathRef.current),
    }
  })

  const flushEditorToMemory = useCallback(async (): Promise<boolean> => {
    flushCountRef.current += 1
    return true
  }, [])

  const onCreateSnapshot = useCallback(async () => {
    const entry = await createManualSnapshotForDocument({
      rootDir: QA_ROOT,
      path: historyPath,
      flushEditorToMemory,
    })
    if (entry) setStatus(`created:${entry.id}`)
    return entry
  }, [flushEditorToMemory, historyPath])

  const onRestore = useCallback(
    async (snapshotId: string, context: { rootDir: string; path: string }) => {
      await restoreSnapshotToEditor({
        rootDir: context.rootDir,
        path: context.path,
        snapshotId,
        flushEditorToMemory: pathsEqual(context.path, activePathRef.current)
          ? flushEditorToMemory
          : undefined,
        dispatchDocumentCommand,
      })
      if (pathsEqual(context.path, activePathRef.current)) {
        syncEditorFromRuntime()
      }
      setStatus(`restored:${snapshotId}`)
    },
    [flushEditorToMemory, syncEditorFromRuntime],
  )

  return (
    <div style={{ padding: 24, background: 'var(--surface-app)', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Snapshot QA</h1>
      <p data-testid="qa-status">{status}</p>
      <pre data-testid="qa-editor-body" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
        {editorBody}
      </pre>
      <button
        type="button"
        data-testid="open-history"
        onClick={() => {
          setHistoryPath(activePath)
          setHistoryOpen(true)
        }}
      >
        Open history
      </button>

      <DocumentHistoryDialog
        t={t}
        open={historyOpen}
        rootDir={QA_ROOT}
        path={historyPath}
        activePath={activePath}
        onClose={() => {
          setHistoryOpen(false)
          syncEditorFromRuntime()
        }}
        onRestore={onRestore}
        onCreateSnapshot={onCreateSnapshot}
        onConfirmDeleteSnapshot={async () => true}
        onDeleteAllSnapshots={async () => storeRef.current.entries.length > 0}
        flushEditorToMemory={flushEditorToMemory}
      />
    </div>
  )
}
