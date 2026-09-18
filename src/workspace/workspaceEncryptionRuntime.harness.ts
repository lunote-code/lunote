import {
  ensureWorkspaceUnlockedWithDeps,
  type WorkspacePasswordPromptOptions,
} from './workspaceEncryptionRuntime'
import {
  isIncorrectPasswordError,
  isWorkspaceLockedError,
  isWorkspaceMigratingError,
} from '../platform/tauri/workspaceEncryptionService'

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

const t = (key: string) => key

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'isWorkspaceLockedError detects WORKSPACE_LOCKED failures',
    run: () => {
      assert(isWorkspaceLockedError(new Error('WORKSPACE_LOCKED')), 'Error message must match')
      assert(isWorkspaceLockedError('save failed: WORKSPACE_LOCKED'), 'string message must match')
      assert(!isWorkspaceLockedError(new Error('Incorrect password')), 'other errors must not match')
    },
  },
  {
    name: 'isWorkspaceMigratingError detects WORKSPACE_MIGRATING failures',
    run: () => {
      assert(isWorkspaceMigratingError(new Error('WORKSPACE_MIGRATING')), 'Error message must match')
      assert(!isWorkspaceMigratingError(new Error('WORKSPACE_LOCKED')), 'locked errors must not match')
    },
  },
  {
    name: 'isIncorrectPasswordError detects incorrect password failures',
    run: () => {
      assert(isIncorrectPasswordError(new Error('Incorrect password')), 'Error message must match')
      assert(!isIncorrectPasswordError(new Error('WORKSPACE_LOCKED')), 'locked errors must not match')
    },
  },
  {
    name: 'ensureWorkspaceUnlocked skips prompt when encryption is disabled',
    run: async () => {
      let promptCount = 0
      const ok = await ensureWorkspaceUnlockedWithDeps(
        '/vault',
        async () => {
          promptCount += 1
          return { password: 'ignored' }
        },
        t,
        {
          getStatus: async () => ({ enabled: false, unlocked: false }),
          unlock: async () => {
            throw new Error('unlock should not run')
          },
          isIncorrectPassword: isIncorrectPasswordError,
        },
      )
      assertEqual(ok, true, 'disabled workspace should open without prompt')
      assertEqual(promptCount, 0, 'prompt count')
    },
  },
  {
    name: 'ensureWorkspaceUnlocked skips prompt when workspace is already unlocked',
    run: async () => {
      let promptCount = 0
      const ok = await ensureWorkspaceUnlockedWithDeps(
        '/vault',
        async () => {
          promptCount += 1
          return { password: 'ignored' }
        },
        t,
        {
          getStatus: async () => ({ enabled: true, unlocked: true }),
          unlock: async () => {
            throw new Error('unlock should not run')
          },
          isIncorrectPassword: isIncorrectPasswordError,
        },
      )
      assertEqual(ok, true, 'already unlocked workspace should continue')
      assertEqual(promptCount, 0, 'prompt count')
    },
  },
  {
    name: 'ensureWorkspaceUnlocked retries after incorrect password and succeeds',
    run: async () => {
      const prompts: WorkspacePasswordPromptOptions[] = []
      let unlockAttempts = 0
      const ok = await ensureWorkspaceUnlockedWithDeps(
        '/vault',
        async (options) => {
          prompts.push(options)
          if (prompts.length === 1) return { password: 'wrong-password' }
          return { password: 'correct-password' }
        },
        t,
        {
          getStatus: async () => ({ enabled: true, unlocked: false }),
          unlock: async (_root, password) => {
            unlockAttempts += 1
            if (password !== 'correct-password') {
              throw new Error('Incorrect password')
            }
          },
          isIncorrectPassword: isIncorrectPasswordError,
        },
      )
      assertEqual(ok, true, 'unlock loop should eventually succeed')
      assertEqual(unlockAttempts, 2, 'unlock attempts')
      assertEqual(prompts.length, 2, 'prompt count')
      assertEqual(
        prompts[1]?.initialError,
        'workspace.encryption.error.incorrectPassword',
        'second prompt should surface incorrect password error',
      )
    },
  },
  {
    name: 'ensureWorkspaceUnlocked returns false when user cancels unlock',
    run: async () => {
      let unlockAttempts = 0
      const ok = await ensureWorkspaceUnlockedWithDeps(
        '/vault',
        async () => null,
        t,
        {
          getStatus: async () => ({ enabled: true, unlocked: false }),
          unlock: async () => {
            unlockAttempts += 1
          },
          isIncorrectPassword: isIncorrectPasswordError,
        },
      )
      assertEqual(ok, false, 'cancelled unlock should abort workspace open')
      assertEqual(unlockAttempts, 0, 'unlock attempts')
    },
  },
])

export async function assertWorkspaceEncryptionRuntimeSuite(): Promise<{ passed: number; failed: number }> {
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
