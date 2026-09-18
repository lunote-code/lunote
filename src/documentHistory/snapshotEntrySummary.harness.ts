import { resolveSnapshotEntrySummary, isWeakSnapshotSummary } from './snapshotEntrySummary'
import type { DocumentHistoryEntry } from './types'

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

function t(key: string, vars?: Record<string, string | number>): string {
  if (key === 'app.history.dialog.snapshotMeta' && vars?.size != null) {
    return `${vars.size} bytes`
  }
  return key
}

function entry(overrides: Partial<DocumentHistoryEntry>): DocumentHistoryEntry {
  return {
    id: 'snap-1',
    workspaceId: 'vault',
    path: '/vault/note.md',
    createdAt: Date.now(),
    source: 'manual',
    title: null,
    excerpt: null,
    contentHash: 'hash',
    size: 42,
    ...overrides,
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'weak frontmatter delimiter excerpt falls back to size meta',
    run: () => {
      assert(isWeakSnapshotSummary('---'), '--- should be treated as weak summary')
      assertEqual(
        resolveSnapshotEntrySummary(t, entry({ excerpt: '---' })),
        '42 bytes',
        'summary should fall back to size',
      )
    },
  },
  {
    name: 'title from frontmatter wins over weak excerpt',
    run: () => {
      assertEqual(
        resolveSnapshotEntrySummary(t, entry({ title: 'Atlas', excerpt: '---' })),
        'Atlas',
        'title should be shown',
      )
    },
  },
  {
    name: 'meaningful excerpt is shown when title is missing',
    run: () => {
      assertEqual(
        resolveSnapshotEntrySummary(t, entry({ excerpt: 'Deep Dive section' })),
        'Deep Dive section',
        'excerpt should be shown',
      )
    },
  },
])

export async function assertSnapshotEntrySummarySuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
      console.log(`ok - ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail - ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { passed, failed }
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') ?? '')) {
  const result = await assertSnapshotEntrySummarySuite()
  if (result.failed > 0) process.exit(1)
}
