import {
  shouldLeavePreviousWorkspace,
  shouldResetWorkspaceSessionOnUnlockCancel,
} from './workspaceSwitchLifecycle'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = [
  {
    name: 'shouldLeavePreviousWorkspace detects real workspace switches',
    run: () => {
      assert(shouldLeavePreviousWorkspace('/Users/a', '/Users/b'), 'different roots')
      assert(!shouldLeavePreviousWorkspace('/Users/a', '/Users/a'), 'same root')
      assert(!shouldLeavePreviousWorkspace('  ', '/Users/b'), 'blank previous root')
    },
  },
  {
    name: 'shouldResetWorkspaceSessionOnUnlockCancel only resets idle for first open',
    run: () => {
      assertEqual(shouldResetWorkspaceSessionOnUnlockCancel(''), true, 'empty previous root')
      assertEqual(shouldResetWorkspaceSessionOnUnlockCancel('/Users/a'), false, 'existing workspace')
    },
  },
]

export function assertWorkspaceSwitchLifecycleSuite(): { passed: number; failed: number } {
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
