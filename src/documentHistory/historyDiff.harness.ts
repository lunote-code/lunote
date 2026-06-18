import { clearDocumentFrontmatter, setDocumentFrontmatterFields } from '../editor/documentFrontmatterStore'
import {
  buildDocumentHistoryDiffRows,
  buildDocumentHistoryDiffRowsForPath,
  documentHistoryContentEquals,
} from './historyDiff'
import {
  dispatchDocumentCommand,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import type { DocumentRuntimeCapabilities } from '../documentRuntime/documentTypes'
import { resolveDocumentBody, resolveLatestDocumentBody } from '../documentRuntime/documentAuthority'
import { clearTabBodies, setTabBody } from '../app/document/tabBodiesStore'

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

async function withRuntime(run: () => Promise<void> | void): Promise<void> {
  resetDocumentRuntimeKernel()
  clearTabBodies()
  try {
    await run()
  } finally {
    registerDocumentRuntimeCapabilities(null)
    resetDocumentRuntimeKernel()
    clearTabBodies()
  }
}

function installMockCapabilities(): void {
  const capabilities: DocumentRuntimeCapabilities = {
    readDocument: async () => '',
    writeDocument: async () => {},
    setActiveDocument: () => {},
    renderContent: () => {},
    setTabs: () => {},
  }
  registerDocumentRuntimeCapabilities(capabilities)
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
  {
    name: 'current body aligns when snapshot includes yaml front matter',
    run: () => {
      const path = '/vault/note.md'
      try {
        setDocumentFrontmatterFields(path, { tags: ['11'] }, { hadLeadingBlock: true })
        const snapshot = '---\ntags:\n  - 11\n---\n# makedown测试笔记\n'
        const currentBody = '# makedown测试笔记\n'
        const rows = buildDocumentHistoryDiffRowsForPath(path, currentBody, snapshot)
        assert(rows.every((row) => row.kind === 'same'), 'rows should align after merging current front matter')
        assert(documentHistoryContentEquals(path, currentBody, snapshot), 'normalized content should match')
      } finally {
        clearDocumentFrontmatter(path)
      }
    },
  },
  {
    name: 'removed tags show front matter diff rows',
    run: () => {
      const path = '/vault/note.md'
      try {
        setDocumentFrontmatterFields(path, {}, { hadLeadingBlock: false })
        const snapshot = '---\ntags:\n  - 11\n---\n# title\n'
        const currentBody = '# title\n'
        const rows = buildDocumentHistoryDiffRowsForPath(path, currentBody, snapshot)
        assertEqual(rows[0]?.snapshot, '---', 'snapshot front matter should stay on snapshot side')
        assertEqual(rows[0]?.current, '# title', 'current body should start on line 1 without invented front matter')
        assertEqual(rows[0]?.kind, 'both', 'misaligned front matter should be marked as changed')
        assert(!documentHistoryContentEquals(path, currentBody, snapshot), 'removed tags should count as changes')
      } finally {
        clearDocumentFrontmatter(path)
      }
    },
  },
  {
    name: 'latest tab body beats stale kernel for history compare',
    run: async () =>
      withRuntime(async () => {
        const path = '/vault/note.md'
        installMockCapabilities()
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: '/vault',
          path,
          source: 'history-diff-harness',
        })
        await dispatchDocumentCommand({
          type: 'DOCUMENT_CONTENT_CHANGED',
          path,
          content: '# Snapshot Two\nBody two\n',
          source: 'history-diff-harness-kernel',
        })
        setTabBody(path, '# Current Editor\nTyped after snapshot\n')
        const snapshot = '# Snapshot Two\nBody two\n'
        const stale = resolveDocumentBody(path) ?? ''
        const latest = resolveLatestDocumentBody(path) ?? ''
        assertEqual(stale, snapshot, 'kernel body should still match snapshot')
        assert(latest !== snapshot, 'tab body should reflect unsynced editor edits')
        assert(!documentHistoryContentEquals(path, latest, snapshot), 'latest body should count as changed')
        assert(documentHistoryContentEquals(path, stale, snapshot), 'stale kernel incorrectly matches snapshot')
      }),
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
