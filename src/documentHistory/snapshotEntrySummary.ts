import type { TranslateFn } from '../i18n'
import type { DocumentHistoryEntry } from './types'

const WEAK_SUMMARY_PATTERN = /^-{3,}$|^\*{3,}$|^_{3,}$/u

export function isWeakSnapshotSummary(value: string | null | undefined): boolean {
  const trimmed = value?.trim()
  if (!trimmed) return true
  return WEAK_SUMMARY_PATTERN.test(trimmed)
}

export function resolveSnapshotEntrySummary(t: TranslateFn, entry: DocumentHistoryEntry): string {
  const title = entry.title?.trim()
  if (title && !isWeakSnapshotSummary(title)) return title

  const excerpt = entry.excerpt?.trim()
  if (excerpt && !isWeakSnapshotSummary(excerpt)) return excerpt

  return t('app.history.dialog.snapshotMeta', { size: entry.size })
}
