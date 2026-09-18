import { getAppSettingsSnapshot } from '../../settings/appSettingsStore'
import { resolveToastNotificationsEnabled } from '../../settings-runtime/editorUiChrome'
import type { AppStatusTone } from '../hooks/useAppStatus'

export type AppToastItem = {
  id: string
  message: string
  tone: AppStatusTone
}

const DEFAULT_TOAST_MS = 5000
const ERROR_TOAST_MS = 15000

let nextToastId = 0
let toasts: AppToastItem[] = []
const listeners = new Set<() => void>()
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

export function subscribeAppToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAppToasts(): readonly AppToastItem[] {
  return toasts
}

export function shouldShowStatusToast(tone: AppStatusTone): boolean {
  return tone === 'success' || tone === 'error' || tone === 'warning'
}

type StatusMessageMatcher = (key: string, vars?: Record<string, string | number>) => string

const SAVE_SUCCESS_STATUS_KEYS = [
  'app.status.saved',
  'app.status.autosaved',
  'app.history.snapshotCreated',
] as const

/** Save confirmations are shown in the status bar only; suppress success toasts. */
export function shouldSkipSaveStatusToast(message: string, t: StatusMessageMatcher): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  for (const key of SAVE_SUCCESS_STATUS_KEYS) {
    if (trimmed === t(key)) return true
  }
  const pathPlaceholder = '\0PATH\0'
  const template = t('app.status.savedTo', { path: pathPlaceholder })
  if (!template.includes(pathPlaceholder)) return false
  const [prefix, suffix] = template.split(pathPlaceholder)
  if (prefix && suffix) {
    return trimmed.startsWith(prefix) && trimmed.endsWith(suffix) && trimmed.length > prefix.length + suffix.length
  }
  if (prefix) return trimmed.startsWith(prefix) && trimmed.length > prefix.length
  if (suffix) return trimmed.endsWith(suffix) && trimmed.length > suffix.length
  return false
}

export function areAppToastsEnabled(): boolean {
  return resolveToastNotificationsEnabled(getAppSettingsSnapshot().appearance?.ui)
}

export function pushAppToast(message: string, tone: AppStatusTone = 'neutral'): void {
  const trimmed = message.trim()
  if (!trimmed || !areAppToastsEnabled()) return
  const id = `toast-${++nextToastId}`
  toasts = [...toasts, { id, message: trimmed, tone }]
  emitChange()
  const existing = dismissTimers.get(id)
  if (existing) clearTimeout(existing)
  const ms = tone === 'error' || tone === 'warning' ? ERROR_TOAST_MS : DEFAULT_TOAST_MS
  dismissTimers.set(
    id,
    setTimeout(() => {
      dismissAppToast(id)
    }, ms),
  )
}

export function dismissAppToast(id: string): void {
  const timer = dismissTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    dismissTimers.delete(id)
  }
  const next = toasts.filter((item) => item.id !== id)
  if (next.length === toasts.length) return
  toasts = next
  emitChange()
}
