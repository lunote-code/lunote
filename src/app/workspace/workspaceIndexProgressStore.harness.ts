import {
  clearWorkspaceIndexProgress,
  getWorkspaceIndexProgressSnapshot,
  patchWorkspaceIndexProgress,
  resetWorkspaceIndexProgressStoreForTests,
  setWorkspaceIndexProgress,
} from './workspaceIndexProgressStore'

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

const CASES: readonly Case[] = [
  {
    name: 'patchWorkspaceIndexProgress creates snapshot for root',
    run: () => {
      patchWorkspaceIndexProgress('/vault', { processed: 3, total: 10, phase: 'reading' })
      const snap = getWorkspaceIndexProgressSnapshot()
      assertEqual(snap?.root, '/vault', 'root')
      assertEqual(snap?.processed, 3, 'processed')
      assertEqual(snap?.total, 10, 'total')
    },
  },
  {
    name: 'clearWorkspaceIndexProgress clears matching root only',
    run: () => {
      setWorkspaceIndexProgress({ root: '/vault', processed: 1, total: 2, phase: 'writing' })
      clearWorkspaceIndexProgress('/other')
      assert(getWorkspaceIndexProgressSnapshot() != null, 'other root must not clear')
      clearWorkspaceIndexProgress('/vault')
      assertEqual(getWorkspaceIndexProgressSnapshot(), null, 'cleared')
    },
  },
]

export function assertWorkspaceIndexProgressStoreSuite(): { passed: number; failed: number } {
  resetWorkspaceIndexProgressStoreForTests()
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      resetWorkspaceIndexProgressStoreForTests()
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  resetWorkspaceIndexProgressStoreForTests()
  return { passed, failed }
}
