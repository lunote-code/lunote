import { buildDocumentHistoryDiffRows } from './historyDiff'

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

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'same lines stay same',
    run: () => {
      const rows = buildDocumentHistoryDiffRows('# title\nbody\n', '# title\nbody\n')
      assertEqual(rows.length, 3, 'same content should preserve row count')
      assert(rows.every((row) => row.kind === 'same'), 'all rows should be same')
    },
  },
  {
    name: 'snapshot-only trailing lines are marked snapshot',
    run: () => {
      const rows = buildDocumentHistoryDiffRows('# title\n', '# title\nbody\n')
      assertEqual(rows[1]?.kind, 'snapshot', 'snapshot-only line should be marked snapshot')
      assertEqual(rows[1]?.snapshot, 'body', 'snapshot line content should be preserved')
    },
  },
  {
    name: 'current-only trailing lines are marked current',
    run: () => {
      const rows = buildDocumentHistoryDiffRows('# title\nbody\n', '# title\n')
      assertEqual(rows[1]?.kind, 'current', 'current-only line should be marked current')
      assertEqual(rows[1]?.current, 'body', 'current line content should be preserved')
    },
  },
  {
    name: 'changed lines are marked both',
    run: () => {
      const rows = buildDocumentHistoryDiffRows('# title\nbody\n', '# title\nchanged\n')
      assertEqual(rows[1]?.kind, 'both', 'changed line should be marked both')
      assertEqual(rows[1]?.current, 'body', 'current changed content should be preserved')
      assertEqual(rows[1]?.snapshot, 'changed', 'snapshot changed content should be preserved')
    },
  },
])

export async function assertHistoryDiffSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      await testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[historyDiff] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
