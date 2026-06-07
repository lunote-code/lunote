export type DocumentHistorySource = 'manual' | 'pre_restore'

export type DocumentHistoryEntry = {
  id: string
  workspaceId: string
  path: string
  createdAt: number
  source: DocumentHistorySource
  title?: string | null
  excerpt?: string | null
  contentHash: string
  size: number
}

export type DocumentHistorySnapshot = {
  entry: DocumentHistoryEntry
  content: string
}

export type DocumentHistoryRestoreState = {
  path: string
  snapshotId: string
  restoredAt: number
  autosaveSuspended: true
  reason: 'history-restore'
}
