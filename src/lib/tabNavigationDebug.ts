import { isBufferTabId } from '../app/workspace/constants'

const LOG_PREFIX = '[tab-nav-debug]'

export type TabNavPhase =
  | 'tab-activate-start'
  | 'tab-activate-skipped'
  | 'tab-activate-complete'
  | 'tab-load-start'
  | 'tab-load-complete'
  | 'tab-load-stale-abort'
  | 'leave-tab'
  | 'open-document-start'
  | 'open-document-cache-hit'
  | 'open-document-cold'
  | 'open-document-in-tab'
  | 'scratch-new-tab'
  | 'scratch-new-document'
  | 'tab-close'
  | 'kernel-replace-active'
  | 'kernel-open-document-in-tab'
  | 'kernel-set-active'
  | 'kernel-content-change'
  | 'editor-hydrate'
  | 'editor-hydrate-skipped'
  | 'editor-markdown-emit'
  | 'editor-content-change'
  | 'editor-content-change-skipped'
  | 'editor-kernel-dispatch'
  | 'memory-flush-resolved'
  | 'memory-flush-guard'
  | 'user-tab-click'

export function isTabNavLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_TAB_NAV_LOG__?: boolean }
  if (g.__KOS_TAB_NAV_LOG__ === true) return true
  try {
    return localStorage.getItem('kos.tabNavLog') === '1'
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

function previewContent(text: string, max = 120): string {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1))}...`
}

export function snapshotDocumentBodyMeta(
  path: string,
  content: string | undefined | null,
): Record<string, unknown> {
  const body = content ?? undefined
  return {
    path,
    contentLength: body?.length ?? null,
    contentHash: body != null ? devQuickHash(body) : null,
    isEmpty: body == null || body.length === 0,
    isBuffer: isBufferTabId(path),
    lineCount: body != null ? body.split('\n').length : null,
    preview: body != null ? previewContent(body) : null,
  }
}

export function logTabNav(phase: TabNavPhase, payload: Record<string, unknown>): void {
  if (!isTabNavLogEnabled()) return
  console.debug(`${LOG_PREFIX} ${phase}`, payload)
}

/** Always emitted in DEV when a disk-backed document looks unexpectedly empty. */
export function warnTabNavBlankContent(
  checkpoint: string,
  payload: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return
  console.warn(`${LOG_PREFIX} [blank-content] ${checkpoint}`, payload)
}

export function checkBlankContentSuspect(
  checkpoint: string,
  path: string,
  content: string | undefined | null,
  context: Record<string, unknown> = {},
): void {
  if (!path || isBufferTabId(path)) return
  if (content != null && content.length > 0) return
  warnTabNavBlankContent(checkpoint, {
    ...snapshotDocumentBodyMeta(path, content),
    ...context,
  })
}
