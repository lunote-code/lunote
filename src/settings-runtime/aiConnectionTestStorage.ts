import type { AiProviderId } from './aiSettings'
import {
  getAppSettingsSnapshot,
  getAppSettingsSnapshotWithLocalFallback,
  setAiConnectionTestResult,
} from '../settings/appSettingsStore'

export const AI_CONNECTION_TEST_STORAGE_KEY = 'luna:ai.connectionTest'

export type StoredAiConnectionTest = {
  ok: boolean
  at: number
  provider: AiProviderId
}

const VERIFIED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function parseStoredAiConnectionTest(raw: unknown): StoredAiConnectionTest | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<StoredAiConnectionTest>
  if (
    typeof parsed.ok !== 'boolean' ||
    typeof parsed.at !== 'number' ||
    typeof parsed.provider !== 'string'
  ) {
    return null
  }
  return {
    ok: parsed.ok,
    at: parsed.at,
    provider: parsed.provider as AiProviderId,
  }
}

function readLocalStorageConnectionTest(): StoredAiConnectionTest | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(AI_CONNECTION_TEST_STORAGE_KEY)
    if (!raw) return null
    return parseStoredAiConnectionTest(JSON.parse(raw))
  } catch {
    return null
  }
}

function readAppSettingsConnectionTest(): StoredAiConnectionTest | null {
  return parseStoredAiConnectionTest(getAppSettingsSnapshot().aiConnectionTest)
}

function readCachedAppSettingsConnectionTest(): StoredAiConnectionTest | null {
  return parseStoredAiConnectionTest(getAppSettingsSnapshotWithLocalFallback().aiConnectionTest)
}

/** Prefer the newest successful result; otherwise the newest attempt. */
export function selectBestAiConnectionTest(
  sources: Array<StoredAiConnectionTest | null | undefined>,
): StoredAiConnectionTest | null {
  const valid = sources.filter((source): source is StoredAiConnectionTest => source != null)
  if (valid.length === 0) return null

  const successes = valid.filter((source) => source.ok)
  const pool = successes.length > 0 ? successes : valid
  return pool.reduce((best, current) => (current.at >= best.at ? current : best))
}

export function readStoredAiConnectionTest(): StoredAiConnectionTest | null {
  return selectBestAiConnectionTest([
    readAppSettingsConnectionTest(),
    readCachedAppSettingsConnectionTest(),
    readLocalStorageConnectionTest(),
  ])
}

export async function writeStoredAiConnectionTest(result: StoredAiConnectionTest): Promise<void> {
  let persisted = false
  try {
    await setAiConnectionTestResult(result)
    persisted = true
  } catch {
    // fall through to localStorage fallback
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(AI_CONNECTION_TEST_STORAGE_KEY, JSON.stringify(result))
      persisted = true
    } catch {
      // ignore quota / private mode
    }
  }
  if (persisted) {
    window.dispatchEvent(new CustomEvent('luna:ai-connection-test-updated'))
  }
}

export async function clearStoredAiConnectionTest(): Promise<void> {
  let cleared = false
  try {
    await setAiConnectionTestResult(undefined)
    cleared = true
  } catch {
    // fall through to localStorage cleanup
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(AI_CONNECTION_TEST_STORAGE_KEY)
      cleared = true
    } catch {
      // ignore
    }
  }
  if (cleared) {
    window.dispatchEvent(new CustomEvent('luna:ai-connection-test-updated'))
  }
}

export function isAiConnectionVerified(
  provider: AiProviderId,
  stored: StoredAiConnectionTest | null = readStoredAiConnectionTest(),
): boolean {
  if (!stored?.ok) return false
  if (stored.provider !== provider) return false
  return Date.now() - stored.at <= VERIFIED_MAX_AGE_MS
}

export type AiConnectionHeaderStatus = 'missing' | 'unverified' | 'verified'

export function resolveAiConnectionHeaderStatus(
  configured: boolean,
  provider: AiProviderId,
): AiConnectionHeaderStatus {
  if (!configured) return 'missing'
  return isAiConnectionVerified(provider) ? 'verified' : 'unverified'
}

export async function markAiConnectionVerified(provider: AiProviderId): Promise<void> {
  await writeStoredAiConnectionTest({
    ok: true,
    at: Date.now(),
    provider,
  })
}
