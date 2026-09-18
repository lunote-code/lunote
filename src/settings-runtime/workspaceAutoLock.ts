/** Idle auto-lock timeout for unlocked encrypted workspaces (minutes). */

export const DEFAULT_AUTO_LOCK_MINUTES = 5
export const AUTO_LOCK_OFF_MINUTES = 0

export const AUTO_LOCK_MINUTE_OPTIONS = [0, 1, 2, 5, 10, 15, 30, 60] as const
export type AutoLockMinuteOption = (typeof AUTO_LOCK_MINUTE_OPTIONS)[number]

const AUTO_LOCK_OPTION_VALUES: readonly number[] = AUTO_LOCK_MINUTE_OPTIONS

export function normalizeAutoLockMinutes(raw: unknown): AutoLockMinuteOption {
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseFloat(raw.trim())
        : NaN
  if (!Number.isFinite(parsed)) return DEFAULT_AUTO_LOCK_MINUTES
  const rounded = Math.round(parsed)
  if (rounded <= 0) return AUTO_LOCK_OFF_MINUTES

  let best: AutoLockMinuteOption = DEFAULT_AUTO_LOCK_MINUTES
  let bestDist = Number.POSITIVE_INFINITY
  for (const option of AUTO_LOCK_OPTION_VALUES) {
    if (option === AUTO_LOCK_OFF_MINUTES) continue
    const dist = Math.abs(option - rounded)
    if (dist < bestDist) {
      best = option as AutoLockMinuteOption
      bestDist = dist
    }
  }
  return best
}

export function autoLockDelayMs(minutes: unknown): number | null {
  const normalized = normalizeAutoLockMinutes(minutes)
  if (normalized <= 0) return null
  return normalized * 60_000
}

export function shouldAttemptIdleAutoLock(input: {
  encryptionEnabled: boolean
  unlocked: boolean
  autoLockMinutes: unknown
  idleMs: number
  busy?: boolean
}): boolean {
  if (input.busy) return false
  if (!input.encryptionEnabled || !input.unlocked) return false
  const delay = autoLockDelayMs(input.autoLockMinutes)
  if (delay == null) return false
  return input.idleMs >= delay
}
