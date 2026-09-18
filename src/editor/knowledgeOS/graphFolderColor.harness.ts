import {
  collectGraphFolderLegendEntries,
  graphFolderColor,
  graphFolderKeyFromDocKey,
} from './graphFolderColor'

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

const FOLDER_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'graphFolderKeyFromDocKey uses top-level folder segment',
    run: () => {
      assertEqual(graphFolderKeyFromDocKey('daily/2026-06-18'), 'daily', 'nested path')
      assertEqual(graphFolderKeyFromDocKey('note-a'), '', 'root note')
      assertEqual(graphFolderKeyFromDocKey('projects/lunote/arch'), 'projects', 'deep path')
    },
  },
  {
    name: 'graphFolderColor is stable for the same folder key',
    run: () => {
      const first = graphFolderColor('daily')
      const second = graphFolderColor('daily')
      assertEqual(first, second, 'same folder color')
      assert(FOLDER_COLOR_PATTERN.test(first), 'palette hex color')
    },
  },
  {
    name: 'collectGraphFolderLegendEntries dedupes folders in subgraph',
    run: () => {
      const entries = collectGraphFolderLegendEntries([
        { docKey: 'daily/a', status: 'resolved', id: 'page:daily/a' },
        { docKey: 'daily/b', status: 'resolved', id: 'page:daily/b' },
        { docKey: 'projects/x', status: 'resolved', id: 'page:projects/x' },
        { docKey: 'missing', status: 'unresolved', id: 'page:missing' },
        { docKey: 'note-a', status: 'resolved', id: 'heading:note-a:intro' },
      ])
      assertEqual(entries.length, 2, 'legend folder count')
      assertEqual(entries[0]?.folderKey, 'daily', 'sorted first folder')
      assertEqual(entries[1]?.folderKey, 'projects', 'sorted second folder')
    },
  },
])

export function runGraphFolderColorHarness(): { passed: number; failed: number } {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : error}`)
    }
  }
  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { failed } = runGraphFolderColorHarness()
  process.exit(failed > 0 ? 1 : 0)
}
