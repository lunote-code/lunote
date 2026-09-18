import { pathsEqual } from '../../lib/workspacePathUtils'
import {
  runWorkspaceQuickSwitcherSearch,
  type WorkspaceSearchIndexEntry,
} from './workspaceSearch'

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

const INDEX: WorkspaceSearchIndexEntry[] = [
  { path: '/vault/a.md', title: 'Alpha', sublabel: 'TOKEN-A', relativePath: 'a.md' },
  { path: '/vault/notes/b.md', title: 'Beta', sublabel: 'TOKEN-B', relativePath: 'notes/b.md' },
  { path: '/vault/c.md', title: 'Gamma', sublabel: 'TOKEN-C', relativePath: 'c.md' },
]

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'empty query prefers recent paths then remaining files',
    run: () => {
      const hits = runWorkspaceQuickSwitcherSearch('', INDEX, ['/vault/c.md', '/vault/a.md'])
      assertEqual(hits.length, 3, 'all files')
      assertEqual(hits[0]?.path, '/vault/c.md', 'recent first')
      assertEqual(hits[1]?.path, '/vault/a.md', 'recent second')
      assert(
        hits.some((hit) => pathsEqual(hit.path, '/vault/notes/b.md')),
        'non-recent file included',
      )
    },
  },
  {
    name: 'query matches title and relative path',
    run: () => {
      const byTitle = runWorkspaceQuickSwitcherSearch('beta', INDEX, [])
      assertEqual(byTitle.length, 1, 'title match count')
      assertEqual(byTitle[0]?.path, '/vault/notes/b.md', 'title match path')

      const byPath = runWorkspaceQuickSwitcherSearch('notes/b', INDEX, [])
      assertEqual(byPath.length, 1, 'path match count')
      assertEqual(byPath[0]?.title, 'Beta', 'path match title')
    },
  },
  {
    name: 'query with no matches returns empty list',
    run: () => {
      const hits = runWorkspaceQuickSwitcherSearch('missing-token', INDEX, [])
      assertEqual(hits.length, 0, 'empty results')
    },
  },
])

let failed = 0
for (const testCase of CASES) {
  try {
    testCase.run()
    console.log(`ok  ${testCase.name}`)
  } catch (error) {
    failed += 1
    console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : error}`)
  }
}

if (failed > 0) {
  process.exitCode = 1
  console.error(`\n${failed} workspace quick switcher harness case(s) failed`)
} else {
  console.log(`\n${CASES.length} workspace quick switcher harness case(s) passed`)
}
