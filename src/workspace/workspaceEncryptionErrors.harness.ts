import {
  formatWorkspaceEncryptionErrorMessage,
  shouldAbortStaleWorkspaceSave,
  shouldRetrySaveAfterWorkspaceUnlock,
} from './workspaceEncryptionErrors'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const t = (key: string) => key

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'formatWorkspaceEncryptionErrorMessage maps locked and migrating errors',
    run: () => {
      assertEqual(
        formatWorkspaceEncryptionErrorMessage(new Error('WORKSPACE_LOCKED'), t),
        'workspace.encryption.error.locked',
        'locked message',
      )
      assertEqual(
        formatWorkspaceEncryptionErrorMessage(new Error('WORKSPACE_MIGRATING'), t),
        'workspace.encryption.error.migrating',
        'migrating message',
      )
      assertEqual(formatWorkspaceEncryptionErrorMessage(new Error('other'), t), null, 'generic error')
    },
  },
  {
    name: 'shouldAbortStaleWorkspaceSave ignores empty roots',
    run: () => {
      assert(!shouldAbortStaleWorkspaceSave('', '/vault/a'), 'empty request root')
      assert(!shouldAbortStaleWorkspaceSave('/vault/a', ''), 'empty current root')
      assert(
        shouldAbortStaleWorkspaceSave('/vault/a', '/vault/b'),
        'mismatch should abort stale save',
      )
    },
  },
  {
    name: 'shouldRetrySaveAfterWorkspaceUnlock only retries once with prompt available',
    run: () => {
      assert(
        shouldRetrySaveAfterWorkspaceUnlock(new Error('WORKSPACE_LOCKED'), true, true),
        'first locked save should retry',
      )
      assert(
        !shouldRetrySaveAfterWorkspaceUnlock(new Error('WORKSPACE_LOCKED'), false, true),
        'second attempt must not retry again',
      )
      assert(
        !shouldRetrySaveAfterWorkspaceUnlock(new Error('WORKSPACE_MIGRATING'), true, true),
        'migrating must not trigger unlock retry',
      )
    },
  },
])

export async function assertWorkspaceEncryptionErrorsSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { passed, failed }
}
