import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'

import './styles/dialogs-app.css'
import './styles/editor-document-history.css'
import { DocumentHistoryDialog } from './components/DocumentHistoryDialog'
import { resolveDocumentBody } from '../documentRuntime/documentAuthority'
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
import { getHistoryRestoreState } from '../documentHistory/historyRestoreState'
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
    }
  }
}

const QA_ROOT = '/qa-vault'
const QA_PATH = '/qa-vault/note.md'
const QA_INITIAL_BODY = '# Current Editor\nLive body\n'

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
  createdAt: number,
  content: string,
  source: 'manual' | 'pre_restore' = 'manual',
): DocumentHistoryEntry {
  return {
    id,
    workspaceId: 'qa-vault',
    path: QA_PATH,
    createdAt,
    source,
    title: content.split('\n')[0]?.replace(/^#\s*/, '') || null,
    excerpt: content.split('\n')[1] || null,
    contentHash: `hash-${id}`,
    size: content.length,
  }
}

function createInitialStore(): HistoryStore {
  const first = createEntry('snap-qa-1', Date.now() - 60_000, '# Snapshot One\nBody one\n')
  const second = createEntry('snap-qa-2', Date.now() - 30_000, '# Snapshot Two\nBody two\n')
  return {
    entries: [second, first],
    snapshots: {
      [first.id]: { entry: first, content: '# Snapshot One\nBody one\n' },
      [second.id]: { entry: second, content: '# Snapshot Two\nBody two\n' },
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
        case 'list_document_snapshots':
          return [...storeRef.current.entries]
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

function installDocumentRuntime(initialBody: string): DocumentRuntimeCapabilities {
  const disk = new Map<string, string>([[QA_PATH, initialBody]])

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
  const [status, setStatus] = useState('booting')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editorBody, setEditorBody] = useState(QA_INITIAL_BODY)
  const [, bumpStore] = useState(0)

  const syncEditorFromRuntime = useCallback(() => {
    setEditorBody(resolveDocumentBody(QA_PATH) ?? getDocumentRuntimeSnapshot().content)
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests(QA_APP_SETTINGS)
    refreshThemeFromSettings()

    resetDocumentRuntimeKernel()
    installDocumentRuntime(QA_INITIAL_BODY)
    installTauriHistoryMock(storeRef, () => bumpStore((n) => n + 1))

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
      syncEditorFromRuntime()
      setStatus('ready')
    })()

    return () => {
      registerDocumentRuntimeCapabilities(null)
      resetDocumentRuntimeKernel()
      delete window.__QA_SNAPSHOT__
    }
  }, [syncEditorFromRuntime])

  useEffect(() => {
    window.__QA_SNAPSHOT__ = {
      getEditorBody: () => resolveDocumentBody(QA_PATH) ?? getDocumentRuntimeSnapshot().content,
      listSnapshotIds: () => storeRef.current.entries.map((entry) => entry.id),
      getSnapshotContent: (id) => storeRef.current.snapshots[id]?.content ?? null,
      getRestoredSnapshotId: () => getHistoryRestoreState(QA_PATH)?.snapshotId ?? null,
      setThemeMode: async (mode) => {
        await setSetting('theme.active', mode === 'light' ? 'github-light' : 'github-dark')
        refreshThemeFromSettings()
      },
      getThemeMode: () => getCurrentThemeMode(),
      previewHeadingColor: () => {
        const el = document.querySelector('.document-history-preview-content h1')
        return el ? getComputedStyle(el).color : ''
      },
      openHistoryDialog: () => setHistoryOpen(true),
    }
  })

  const onCreateSnapshot = useCallback(async () => {
    const entry = await createManualSnapshotForDocument({
      rootDir: QA_ROOT,
      path: QA_PATH,
      flushEditorToMemory: async () => true,
    })
    if (entry) setStatus(`created:${entry.id}`)
    return entry
  }, [])

  const onRestore = useCallback(
    async (snapshotId: string) => {
      await restoreSnapshotToEditor({
        rootDir: QA_ROOT,
        path: QA_PATH,
        snapshotId,
        dispatchDocumentCommand,
      })
      syncEditorFromRuntime()
      setStatus(`restored:${snapshotId}`)
    },
    [syncEditorFromRuntime],
  )

  return (
    <div style={{ padding: 24, background: 'var(--surface-app, #0f1115)', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Snapshot QA</h1>
      <p data-testid="qa-status">{status}</p>
      <pre data-testid="qa-editor-body" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary, #e2e8f0)' }}>
        {editorBody}
      </pre>
      <button type="button" data-testid="open-history" onClick={() => setHistoryOpen(true)}>
        Open history
      </button>

      <DocumentHistoryDialog
        t={t}
        open={historyOpen}
        rootDir={QA_ROOT}
        path={QA_PATH}
        onClose={() => {
          setHistoryOpen(false)
          syncEditorFromRuntime()
        }}
        onRestore={onRestore}
        onCreateSnapshot={onCreateSnapshot}
        onConfirmDeleteSnapshot={async () => true}
        onDeleteAllSnapshots={async () => storeRef.current.entries.length > 0}
      />
    </div>
  )
}
