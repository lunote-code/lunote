import { useCallback, useEffect, useRef, useState } from 'react'

import { DocumentHistoryDialog } from './components/DocumentHistoryDialog'
import { SaveConflictDialog } from './components/SaveConflictDialog'
import type { DocumentHistoryEntry, DocumentHistorySnapshot } from '../documentHistory/types'

type HistoryStore = {
  entries: DocumentHistoryEntry[]
  snapshots: Record<string, DocumentHistorySnapshot>
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>
    }
    __QA_HISTORY_STORE__?: HistoryStore
    __QA_OVERLAY__?: {
      getStatus: () => string
      getSnapshotCount: () => number
      openHistory: () => void
      openConflict: () => void
      getSidebarWidth: () => number
      getConflictCancelCount: () => number
    }
  }
}

const QA_ROOT = '/qa-vault'
const QA_PATH = '/qa-vault/note.md'

function createEntry(id: string, createdAt: number, content: string, source: 'manual' | 'pre_restore' = 'manual'): DocumentHistoryEntry {
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

const MESSAGES: Record<string, string> = {
  'app.history.dialog.title': '版本历史',
  'app.history.dialog.help': '在左侧选择快照，在右侧预览，再决定是否恢复到编辑器。',
  'app.history.dialog.snapshots': '快照',
  'app.history.dialog.count': '共 {count} 个',
  'app.history.dialog.close': '关闭',
  'app.history.dialog.restoreCurrent': '已恢复',
  'app.history.dialog.restoreHint': '恢复仅将版本载入编辑器，需手动保存才会写入磁盘。',
  'app.history.dialog.restoreCurrentHint': '此版本已在编辑器中，自动保存仍处于暂停状态。',
  'app.history.dialog.deleteConfirm': '确定删除此快照？此操作无法撤销。',
  'app.history.dialog.creating': '正在创建…',
  'menu.file.history.createSnapshot': '创建快照',
  'app.history.dialog.delete': '删除快照',
  'app.history.dialog.deleteAll': '删除所有快照',
  'app.history.dialog.deleteAllConfirm': '确定删除此文档的全部 {count} 个快照？此操作无法撤销。',
  'app.history.dialog.deletingAll': '正在删除…',
  'app.history.allSnapshotsDeleted': '已删除 {count} 个快照。',
  'app.history.dialog.restoreSnapshot': '恢复快照',
  'app.history.dialog.loading': '正在加载快照…',
  'app.history.dialog.preview': '预览',
  'app.history.dialog.diff': '差异',
  'app.history.dialog.currentBody': '当前内容',
  'app.history.dialog.snapshotBody': '快照内容',
  'app.history.dialog.diffSame': '当前内容与该快照一致。',
  'app.history.dialog.selectSnapshot': '在左侧选择快照以预览',
  'app.history.dialog.currentRestored': '当前编辑器状态',
  'app.history.dialog.snapshotMeta': '{size} 字节',
  'app.history.noSnapshots': '暂无快照。',
  'app.history.source.manual': '手动快照',
  'app.history.source.preRestore': '恢复前备份',
  'app.history.dialog.contextHint': '右键可执行操作',
  'app.history.dialog.resizeSplit': '拖动以调整快照列表宽度',
  'app.history.snapshotCreated': '快照已创建。',
  'app.history.restoredPendingSave': '已恢复到编辑器，自动保存已暂停，请手动保存确认',
  'app.rename.cancel': '取消',
  'ctx.file.delete': '删除',
  'app.saveConflict.title': '保存冲突',
  'app.saveConflict.message': '文件“{path}”在磁盘上已被修改。请选择要保留的版本：',
  'app.saveConflict.base': '上次保存',
  'app.saveConflict.local': '本地修改',
  'app.saveConflict.disk': '磁盘版本',
  'app.saveConflict.mergeAria': '三方逐行差异',
  'app.saveConflict.cancel': '取消',
  'app.saveConflict.useDisk': '使用磁盘版本',
  'app.saveConflict.keepLocal': '保留本地并覆盖磁盘',
  'app.saveConflict.truncated': '仅显示前 200 行差异。',
  'settings.editor.autosaveEnabled.label': '自动保存',
  'app.menu.revertedFromDisk': '已从磁盘重新载入',
  'app.status.saved': '已保存',
}

function t(key: string, vars?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, token) => String(vars[token] ?? `{${token}}`))
}

export function QaOverlayPlayground() {
  const storeRef = useRef<HistoryStore>(createInitialStore())
  const snapshotSeedRef = useRef(2)
  const conflictCancelCountRef = useRef(0)
  const [status, setStatus] = useState('ready')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saveConflictOpen, setSaveConflictOpen] = useState(false)

  useEffect(() => {
    window.__QA_HISTORY_STORE__ = storeRef.current
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
          case 'delete_document_snapshot': {
            storeRef.current.entries = storeRef.current.entries.filter((entry) => entry.id !== snapshotId)
            delete storeRef.current.snapshots[snapshotId]
            setStatus(`deleted:${snapshotId}`)
            return null
          }
          case 'delete_all_document_snapshots': {
            const count = storeRef.current.entries.length
            storeRef.current = { entries: [], snapshots: {} }
            window.__QA_HISTORY_STORE__ = storeRef.current
            setStatus(`deletedAll:${count}`)
            return count
          }
          default:
            throw new Error(`Unhandled QA invoke: ${cmd}`)
        }
      },
    }
  }, [])

  const onCreateSnapshot = useCallback(async () => {
    snapshotSeedRef.current += 1
    const id = `snap-qa-${snapshotSeedRef.current}`
    const content = `# Snapshot ${snapshotSeedRef.current}\nCreated from QA\n`
    const entry = createEntry(id, Date.now(), content)
    storeRef.current = {
      entries: [entry, ...storeRef.current.entries],
      snapshots: {
        ...storeRef.current.snapshots,
        [entry.id]: { entry, content },
      },
    }
    window.__QA_HISTORY_STORE__ = storeRef.current
    setStatus(`created:${entry.id}`)
    return entry
  }, [])

  const onRestore = useCallback(async (snapshotId: string) => {
    setStatus(`restored:${snapshotId}`)
  }, [])

  const onConfirmDeleteSnapshot = useCallback(async () => true, [])

  const onDeleteAllSnapshots = useCallback(async () => {
    if (storeRef.current.entries.length === 0) return false
    const count = storeRef.current.entries.length
    storeRef.current = { entries: [], snapshots: {} }
    window.__QA_HISTORY_STORE__ = storeRef.current
    setStatus(`deletedAll:${count}`)
    return true
  }, [])

  useEffect(() => {
    window.__QA_OVERLAY__ = {
      getStatus: () => status,
      getSnapshotCount: () => storeRef.current.entries.length,
      openHistory: () => setHistoryOpen(true),
      openConflict: () => {
        conflictCancelCountRef.current = 0
        setSaveConflictOpen(true)
      },
      getSidebarWidth: () => {
        const sidebar = document.querySelector('.document-history-sidebar') as HTMLElement | null
        if (!sidebar) return 0
        const width = sidebar.style.width
        const parsed = Number.parseInt(width, 10)
        return Number.isFinite(parsed) ? parsed : sidebar.getBoundingClientRect().width
      },
      getConflictCancelCount: () => conflictCancelCountRef.current,
    }
    return () => {
      delete window.__QA_OVERLAY__
    }
  }, [status])

  return (
    <div style={{ padding: 24 }}>
      <h1 data-testid="qa-ready">Overlay QA</h1>
      <p data-testid="qa-status">{status}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" data-testid="open-history" onClick={() => setHistoryOpen(true)}>
          打开历史对话框
        </button>
        <button type="button" data-testid="open-conflict" onClick={() => setSaveConflictOpen(true)}>
          打开保存冲突对话框
        </button>
      </div>

      <DocumentHistoryDialog
        t={t}
        open={historyOpen}
        rootDir={QA_ROOT}
        path={QA_PATH}
        onClose={() => {
          setHistoryOpen(false)
          setStatus((prev) => `${prev}|historyClosed`)
        }}
        onRestore={onRestore}
        onCreateSnapshot={onCreateSnapshot}
        onConfirmDeleteSnapshot={onConfirmDeleteSnapshot}
        onDeleteAllSnapshots={onDeleteAllSnapshots}
      />

      <SaveConflictDialog
        t={t}
        open={saveConflictOpen}
        path={QA_PATH}
        basePreview={'# Base\nLine\n'}
        localPreview={'# Local\nChanged here\n'}
        diskPreview={'# Disk\nChanged there\n'}
        diskReadable
        sourceMode="manual"
        onCancel={() => {
          conflictCancelCountRef.current += 1
          setSaveConflictOpen(false)
          setStatus('conflict:cancel')
        }}
        onUseDisk={() => {
          setSaveConflictOpen(false)
          setStatus('conflict:useDisk')
        }}
        onKeepLocal={() => {
          setSaveConflictOpen(false)
          setStatus('conflict:keepLocal')
        }}
      />
    </div>
  )
}
