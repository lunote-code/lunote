import { isBufferTabId } from '../app/workspace/constants'
import { filterAutosaveEligibleDirtyPaths } from '../lib/autosavePathEligibility'
import {
  AUTO_LOCK_OFF_MINUTES,
  DEFAULT_AUTO_LOCK_MINUTES,
  autoLockDelayMs,
  normalizeAutoLockMinutes,
  shouldAttemptIdleAutoLock,
} from '../settings-runtime/workspaceAutoLock'
import { idleLockAllowedAfterSave, lockWorkspaceAfterIdleWithDeps } from './lockWorkspaceAfterIdle'

type Case = {
  readonly name: string
  readonly run: () => Promise<void> | void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'normalizeAutoLockMinutes defaults to 5 minutes',
    run: () => {
      assertEqual(normalizeAutoLockMinutes(undefined), DEFAULT_AUTO_LOCK_MINUTES, 'undefined')
      assertEqual(normalizeAutoLockMinutes(''), DEFAULT_AUTO_LOCK_MINUTES, 'empty string')
      assertEqual(normalizeAutoLockMinutes('nope'), DEFAULT_AUTO_LOCK_MINUTES, 'invalid')
    },
  },
  {
    name: 'normalizeAutoLockMinutes treats 0 and negatives as never',
    run: () => {
      assertEqual(normalizeAutoLockMinutes(0), AUTO_LOCK_OFF_MINUTES, 'zero')
      assertEqual(normalizeAutoLockMinutes(-3), AUTO_LOCK_OFF_MINUTES, 'negative')
    },
  },
  {
    name: 'normalizeAutoLockMinutes snaps to nearest allowed timeout',
    run: () => {
      assertEqual(normalizeAutoLockMinutes(4), 5, '4 -> 5')
      assertEqual(normalizeAutoLockMinutes(12), 10, '12 -> 10')
      assertEqual(normalizeAutoLockMinutes(60), 60, '60 stays 60')
    },
  },
  {
    name: 'autoLockDelayMs is null when auto-lock is off',
    run: () => {
      assertEqual(autoLockDelayMs(0), null, 'off')
      assertEqual(autoLockDelayMs(5), 5 * 60_000, 'five minutes')
    },
  },
  {
    name: 'shouldAttemptIdleAutoLock requires unlocked encryption and elapsed idle time',
    run: () => {
      assert(
        !shouldAttemptIdleAutoLock({
          encryptionEnabled: false,
          unlocked: true,
          autoLockMinutes: 5,
          idleMs: 10 * 60_000,
        }),
        'disabled encryption must not lock',
      )
      assert(
        !shouldAttemptIdleAutoLock({
          encryptionEnabled: true,
          unlocked: false,
          autoLockMinutes: 5,
          idleMs: 10 * 60_000,
        }),
        'already locked must not lock again',
      )
      assert(
        !shouldAttemptIdleAutoLock({
          encryptionEnabled: true,
          unlocked: true,
          autoLockMinutes: 0,
          idleMs: 10 * 60_000,
        }),
        'never must not lock',
      )
      assert(
        !shouldAttemptIdleAutoLock({
          encryptionEnabled: true,
          unlocked: true,
          autoLockMinutes: 5,
          idleMs: 4 * 60_000,
        }),
        'under threshold must not lock',
      )
      assert(
        shouldAttemptIdleAutoLock({
          encryptionEnabled: true,
          unlocked: true,
          autoLockMinutes: 5,
          idleMs: 5 * 60_000,
        }),
        'idle at default timeout must lock',
      )
    },
  },
  {
    name: 'lockWorkspaceAfterIdle saves dirty notes then locks and prompts unlock',
    run: async () => {
      const calls: string[] = []
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => {
            calls.push('status')
            return { enabled: true, unlocked: true }
          },
          saveDirtyDocuments: async () => {
            calls.push('save')
            return true
          },
          lockWorkspace: async (root) => {
            calls.push(`lock:${root}`)
          },
          purgePlaintextSession: () => {
            calls.push('purge')
          },
          ensureUnlocked: async (root) => {
            calls.push(`prompt:${root}`)
            return true
          },
          isStillCurrent: () => true,
        },
      )
      assertEqual(result, 'locked', 'result')
      assertEqual(calls.join(','), 'status,save,lock:/vault,purge,prompt:/vault', 'call order')
    },
  },
  {
    name: 'lockWorkspaceAfterIdle skips unlock prompt after lock if the workspace changed',
    run: async () => {
      let current = true
      const calls: string[] = []
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => true,
          lockWorkspace: async () => {
            calls.push('lock')
            current = false
          },
          purgePlaintextSession: () => {
            calls.push('purge')
          },
          ensureUnlocked: async () => {
            calls.push('prompt')
            return true
          },
          isStillCurrent: () => current,
        },
      )
      assertEqual(result, 'locked', 'result')
      assertEqual(calls.join(','), 'lock', 'must lock without prompting the new workspace')
    },
  },
  {
    name: 'lockWorkspaceAfterIdle purges and prompts after lock even if the user becomes active',
    run: async () => {
      let current = true
      const calls: string[] = []
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => true,
          lockWorkspace: async (root) => {
            calls.push(`lock:${root}`)
            current = false
          },
          purgePlaintextSession: () => {
            calls.push('purge')
          },
          ensureUnlocked: async (root) => {
            calls.push(`prompt:${root}`)
            return true
          },
          isStillCurrent: () => current,
          isWorkspaceStillOpen: () => true,
        },
      )
      assertEqual(result, 'locked', 'result')
      assertEqual(
        calls.join(','),
        'lock:/vault,purge,prompt:/vault',
        'native lock must still drop plaintext in the open workspace',
      )
    },
  },
  {
    name: 'lockWorkspaceAfterIdle skips lock when the user becomes active during save',
    run: async () => {
      let current = true
      let locked = false
      let purged = false
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => {
            current = false
            return true
          },
          lockWorkspace: async () => {
            locked = true
          },
          purgePlaintextSession: () => {
            purged = true
          },
          ensureUnlocked: async () => true,
          isStillCurrent: () => current,
        },
      )
      assertEqual(result, 'skipped', 'result')
      assert(!locked, 'must not lock after activity')
      assert(!purged, 'must not purge after activity')
    },
  },
  {
    name: 'lockWorkspaceAfterIdle does not lock when save fails',
    run: async () => {
      let locked = false
      let purged = false
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => false,
          lockWorkspace: async () => {
            locked = true
          },
          purgePlaintextSession: () => {
            purged = true
          },
          ensureUnlocked: async () => true,
          isStillCurrent: () => true,
        },
      )
      assertEqual(result, 'save-failed', 'result')
      assert(!locked, 'must not lock unsaved notes')
      assert(!purged, 'must not purge unsaved notes')
    },
  },
  {
    name: 'idleLockAllowedAfterSave refuses leftover dirty notes, restores, and scratch tabs',
    run: () => {
      assert(idleLockAllowedAfterSave(true, []), 'clean session may lock')
      assert(!idleLockAllowedAfterSave(false, []), 'failed save must not lock')
      assert(
        !idleLockAllowedAfterSave(true, ['luna:buf:scratch']),
        'dirty scratch must not lock',
      )
      assert(
        !idleLockAllowedAfterSave(true, ['/vault/restored.md']),
        'dirty restored note must not lock',
      )
    },
  },
  {
    name: 'idle autosave plus leftover dirty gate encrypts only when unsaved work is gone',
    run: () => {
      const isRestoreSuspended = (path: string) => path === '/vault/restored.md'
      const unsavedAtIdle = ['/vault/note.md', 'luna:buf:scratch', '/vault/restored.md']
      const eligible = filterAutosaveEligibleDirtyPaths(
        unsavedAtIdle,
        isBufferTabId,
        isRestoreSuspended,
      )
      assertEqual(eligible.join(','), '/vault/note.md', 'autosave must skip scratch and restore overlays')
      assert(
        !idleLockAllowedAfterSave(true, ['luna:buf:scratch']),
        'after eligible notes save, leftover scratch still blocks idle encrypt',
      )
      assert(
        !idleLockAllowedAfterSave(true, ['/vault/restored.md']),
        'unsaved history restore at idle must not encrypt',
      )
      assert(idleLockAllowedAfterSave(true, []), 'clean session after autosave may encrypt')
    },
  },
  {
    name: 'idle lock encrypts after unsaved note autosaves, then prompts decrypt',
    run: async () => {
      let remainingDirty = ['/vault/unsaved.md']
      const calls: string[] = []
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => {
            calls.push(`save:${remainingDirty.join(',')}`)
            remainingDirty = []
            return idleLockAllowedAfterSave(true, remainingDirty)
          },
          lockWorkspace: async (root) => {
            calls.push(`encrypt:${root}`)
          },
          purgePlaintextSession: () => {
            calls.push('purge')
          },
          ensureUnlocked: async (root) => {
            calls.push(`decrypt:${root}`)
            return true
          },
          isStillCurrent: () => true,
        },
      )
      assertEqual(result, 'locked', 'result')
      assertEqual(remainingDirty.length, 0, 'autosave must clear unsaved note')
      assertEqual(
        calls.join(','),
        'save:/vault/unsaved.md,encrypt:/vault,purge,decrypt:/vault',
        'save then encrypt then decrypt',
      )
    },
  },
  {
    name: 'idle lock does not encrypt when unsaved leftover dirty remains after autosave',
    run: async () => {
      let remainingDirty = ['/vault/note.md', 'luna:buf:scratch']
      let encrypted = false
      let purged = false
      let decrypted = false
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => {
            remainingDirty = remainingDirty.filter((path) => path !== '/vault/note.md')
            return true
          },
          listRemainingDirtyPaths: () => remainingDirty,
          lockWorkspace: async () => {
            encrypted = true
          },
          purgePlaintextSession: () => {
            purged = true
          },
          ensureUnlocked: async () => {
            decrypted = true
            return true
          },
          isStillCurrent: () => true,
        },
      )
      assertEqual(result, 'unsaved-remaining', 'result')
      assertEqual(remainingDirty.join(','), 'luna:buf:scratch', 'scratch must remain unsaved')
      assert(!encrypted, 'must not encrypt while unique unsaved work remains')
      assert(!purged, 'must not drop leftover unsaved plaintext')
      assert(!decrypted, 'must not prompt decrypt when idle encrypt was skipped')
    },
  },
  {
    name: 'idle lock still purges after encrypt if decrypt prompt is cancelled',
    run: async () => {
      const calls: string[] = []
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => idleLockAllowedAfterSave(true, []),
          lockWorkspace: async (root) => {
            calls.push(`encrypt:${root}`)
          },
          purgePlaintextSession: () => {
            calls.push('purge')
          },
          ensureUnlocked: async (root) => {
            calls.push(`decrypt-cancelled:${root}`)
            return false
          },
          isStillCurrent: () => true,
        },
      )
      assertEqual(result, 'locked', 'native lock already happened')
      assertEqual(calls.join(','), 'encrypt:/vault,purge,decrypt-cancelled:/vault', 'purge before cancelled decrypt')
    },
  },
  {
    name: 'lockWorkspaceAfterIdle does not purge when leftover dirty work remains after autosave',
    run: async () => {
      let locked = false
      let purged = false
      const result = await lockWorkspaceAfterIdleWithDeps(
        { rootDir: '/vault', autoLockMinutes: 5, idleMs: 5 * 60_000 },
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          saveDirtyDocuments: async () => true,
          listRemainingDirtyPaths: () => ['/vault/restored.md'],
          lockWorkspace: async () => {
            locked = true
          },
          purgePlaintextSession: () => {
            purged = true
          },
          ensureUnlocked: async () => true,
          isStillCurrent: () => true,
        },
      )
      assertEqual(result, 'unsaved-remaining', 'result')
      assert(!locked, 'must not lock unique in-memory work')
      assert(!purged, 'must not purge unique in-memory work')
    },
  },
])

export async function assertLockWorkspaceAfterIdleSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      await testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { passed, failed }
}
