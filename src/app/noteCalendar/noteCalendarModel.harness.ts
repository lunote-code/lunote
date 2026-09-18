import type { FlatWorkspaceFile } from '../workspace/types'
import { patchFileTreeModifiedAt } from '../workspace/workspaceTree'
import {
  buildCalendarMonthGrid,
  collectNotesByModifiedDate,
  dateHasEditedNotes,
  effectiveModifiedAtMsForFile,
  isMarkdownWorkspaceFile,
  localDateKey,
  localDateKeyFromMs,
  modifiedDateKeyForFile,
  notesEditedOnDate,
  resolveDateKeyForActivePath,
  weekStartsOnMonday,
} from './noteCalendarModel'

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

function countIndexedNotes(index: ReadonlyMap<string, FlatWorkspaceFile[]>): number {
  let total = 0
  for (const bucket of index.values()) total += bucket.length
  return total
}

function eligibleMarkdownFiles(files: readonly FlatWorkspaceFile[]): FlatWorkspaceFile[] {
  return files.filter((file) => isMarkdownWorkspaceFile(file) && modifiedDateKeyForFile(file) != null)
}

function eligibleMarkdownFilesWithEdits(
  files: readonly FlatWorkspaceFile[],
  persistedEdits?: ReadonlyMap<string, number>,
  preferPersistedOnly = false,
): FlatWorkspaceFile[] {
  return files.filter(
    (file) =>
      isMarkdownWorkspaceFile(file) &&
      modifiedDateKeyForFile(file, persistedEdits, preferPersistedOnly) != null,
  )
}

const dayOne = localDateKey(new Date(2026, 6, 18))
const dayTwo = localDateKey(new Date(2026, 6, 19))
const msDayOneAfternoon = new Date(2026, 6, 18, 15, 0, 0).getTime()
const msDayOneMorning = new Date(2026, 6, 18, 9, 0, 0).getTime()
const msDayTwoMorning = new Date(2026, 6, 19, 9, 0, 0).getTime()

const sampleFiles: readonly FlatWorkspaceFile[] = [
  {
    path: '/vault/a.md',
    label: 'a',
    relativePath: 'a.md',
    modifiedAtMs: msDayOneAfternoon,
  },
  {
    path: '/vault/folder/b.md',
    label: 'b',
    relativePath: 'folder/b.md',
    modifiedAtMs: msDayOneMorning,
  },
  {
    path: '/vault/c.md',
    label: 'c',
    relativePath: 'c.md',
    modifiedAtMs: msDayTwoMorning,
  },
  {
    path: '/vault/readme.txt',
    label: 'readme',
    relativePath: 'readme.txt',
    modifiedAtMs: msDayOneAfternoon,
  },
]

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'isMarkdownWorkspaceFile accepts md and markdown extensions',
    run: () => {
      assert(isMarkdownWorkspaceFile({ path: '/a.md', label: 'a', relativePath: 'a.md' }), 'md')
      assert(isMarkdownWorkspaceFile({ path: '/a.markdown', label: 'a', relativePath: 'a.markdown' }), 'markdown')
      assert(!isMarkdownWorkspaceFile({ path: '/a.txt', label: 'a', relativePath: 'a.txt' }), 'txt')
    },
  },
  {
    name: 'modifiedDateKeyForFile uses modifiedAtMs in local timezone',
    run: () => {
      assertEqual(
        modifiedDateKeyForFile({
          path: '/vault/a.md',
          label: 'a',
          relativePath: 'a.md',
          modifiedAtMs: msDayOneAfternoon,
        }),
        dayOne,
        'modified date key',
      )
    },
  },
  {
    name: 'modifiedDateKeyForFile falls back to createdAtMs',
    run: () => {
      assertEqual(
        modifiedDateKeyForFile({
          path: '/vault/new.md',
          label: 'new',
          relativePath: 'new.md',
          createdAtMs: msDayTwoMorning,
        }),
        dayTwo,
        'created date fallback',
      )
    },
  },
  {
    name: 'collectNotesByModifiedDate groups markdown only and sorts by modified time desc',
    run: () => {
      const index = collectNotesByModifiedDate(sampleFiles)
      assert(dateHasEditedNotes(dayOne, index), 'day one has notes')
      assert(dateHasEditedNotes(dayTwo, index), 'day two has notes')
      assert(!dateHasEditedNotes('2026-01-01', index), 'empty day')
      assertEqual(
        notesEditedOnDate(dayOne, index).map((file) => file.relativePath).join(','),
        'a.md,folder/b.md',
        'day one ordering',
      )
    },
  },
  {
    name: 'resolveDateKeyForActivePath matches absolute and relative active paths',
    run: () => {
      assertEqual(
        resolveDateKeyForActivePath('/vault/a.md', sampleFiles),
        dayOne,
        'absolute active path',
      )
      assertEqual(
        resolveDateKeyForActivePath('/vault/folder/b.md', sampleFiles),
        dayOne,
        'nested active path',
      )
      assertEqual(resolveDateKeyForActivePath('', sampleFiles), null, 'empty active path')
    },
  },
  {
    name: 'resolveDateKeyForActivePath avoids suffix collisions between similar paths',
    run: () => {
      const files: FlatWorkspaceFile[] = [
        {
          path: '/vault/demo.md',
          label: 'demo',
          relativePath: 'demo.md',
          modifiedAtMs: msDayOneMorning,
        },
        {
          path: '/vault/notes/demo.md',
          label: 'nested-demo',
          relativePath: 'notes/demo.md',
          modifiedAtMs: msDayTwoMorning,
        },
      ]
      assertEqual(
        resolveDateKeyForActivePath('/vault/notes/demo.md', files),
        dayTwo,
        'exact nested path',
      )
      assertEqual(
        resolveDateKeyForActivePath('/vault/demo.md', files),
        dayOne,
        'exact root path',
      )
    },
  },
  {
    name: 'buildCalendarMonthGrid includes outside days and current month cells',
    run: () => {
      const grid = buildCalendarMonthGrid(2026, 6, 1)
      assert(grid.length >= 4, 'grid weeks')
      const cells = grid.flat()
      assert(cells.some((cell) => cell.inMonth && cell.dateKey === '2026-07-18'), 'in-month day')
      assert(cells.some((cell) => !cell.inMonth), 'outside month padding')
    },
  },
  {
    name: 'weekStartsOnMonday follows locale prefix rules',
    run: () => {
      assert(weekStartsOnMonday('zh-CN'), 'zh-CN')
      assert(weekStartsOnMonday('ja-JP'), 'ja-JP')
      assert(!weekStartsOnMonday('en-US'), 'en-US')
    },
  },
  {
    name: 'modifiedDateKeyForFile prefers modifiedAtMs over createdAtMs',
    run: () => {
      assertEqual(
        modifiedDateKeyForFile({
          path: '/vault/conflict.md',
          label: 'conflict',
          relativePath: 'conflict.md',
          modifiedAtMs: msDayOneAfternoon,
          createdAtMs: msDayTwoMorning,
        }),
        dayOne,
        'modifiedAtMs wins',
      )
    },
  },
  {
    name: 'modifiedDateKeyForFile returns null for missing or invalid timestamps',
    run: () => {
      assertEqual(
        modifiedDateKeyForFile({
          path: '/vault/ghost.md',
          label: 'ghost',
          relativePath: 'ghost.md',
        }),
        null,
        'missing timestamps',
      )
      assertEqual(
        modifiedDateKeyForFile({
          path: '/vault/bad.md',
          label: 'bad',
          relativePath: 'bad.md',
          modifiedAtMs: Number.NaN,
          createdAtMs: Number.POSITIVE_INFINITY,
        }),
        null,
        'invalid timestamps',
      )
    },
  },
  {
    name: 'localDateKeyFromMs respects midnight boundary in local timezone',
    run: () => {
      const lateNight = new Date(2026, 6, 18, 23, 59, 59).getTime()
      const earlyMorning = new Date(2026, 6, 19, 0, 1, 0).getTime()
      assertEqual(localDateKeyFromMs(lateNight), dayOne, 'late night stays on same day')
      assertEqual(localDateKeyFromMs(earlyMorning), dayTwo, 'after midnight rolls to next day')
    },
  },
  {
    name: 'collectNotesByModifiedDate indexes every eligible markdown exactly once',
    run: () => {
      const files: FlatWorkspaceFile[] = [
        ...sampleFiles,
        {
          path: '/vault/notes\\nested\\slash.md',
          label: 'slash',
          relativePath: 'notes\\nested\\slash.md',
          modifiedAtMs: msDayOneMorning + 1,
        },
        {
          path: '/vault/UPPER.MD',
          label: 'upper',
          relativePath: 'folder/UPPER.MD',
          modifiedAtMs: msDayTwoMorning + 1,
        },
        {
          path: '/vault/no-time.md',
          label: 'no-time',
          relativePath: 'no-time.md',
        },
      ]
      const index = collectNotesByModifiedDate(files)
      const eligible = eligibleMarkdownFiles(files)
      assertEqual(countIndexedNotes(index), eligible.length, 'indexed count matches eligible markdown')
      const seen = new Set<string>()
      for (const bucket of index.values()) {
        for (const file of bucket) {
          assert(!seen.has(file.path), `duplicate indexed path ${file.path}`)
          seen.add(file.path)
        }
      }
    },
  },
  {
    name: 'collectNotesByModifiedDate handles many notes on same day without omission',
    run: () => {
      const manySameDay: FlatWorkspaceFile[] = Array.from({ length: 120 }, (_, index) => ({
        path: `/vault/bulk/note-${index}.md`,
        label: `note-${index}`,
        relativePath: `bulk/note-${index}.md`,
        modifiedAtMs: msDayOneAfternoon - index * 1_000,
      }))
      const index = collectNotesByModifiedDate(manySameDay)
      assertEqual(notesEditedOnDate(dayOne, index).length, 120, 'same-day count')
      assert(dateHasEditedNotes(dayOne, index), 'same-day dot eligibility')
      const timestamps = notesEditedOnDate(dayOne, index).map((file) => file.modifiedAtMs ?? 0)
      for (let i = 1; i < timestamps.length; i += 1) {
        assert(
          timestamps[i - 1]! >= timestamps[i]!,
          'same-day notes stay sorted by modified time desc',
        )
      }
    },
  },
  {
    name: 'dateHasEditedNotes and notesEditedOnDate stay consistent for empty and populated days',
    run: () => {
      const index = collectNotesByModifiedDate(sampleFiles)
      for (const [dateKey, bucket] of index.entries()) {
        assert(dateHasEditedNotes(dateKey, index), `expected dot for ${dateKey}`)
        assertEqual(notesEditedOnDate(dateKey, index).length, bucket.length, `list length for ${dateKey}`)
      }
      assertEqual(notesEditedOnDate('2099-12-31', index).length, 0, 'missing day list')
      assert(!dateHasEditedNotes('2099-12-31', index), 'missing day dot')
    },
  },
  {
    name: 'resolveDateKeyForActivePath normalizes backslash active paths',
    run: () => {
      const files: FlatWorkspaceFile[] = [
        {
          path: '/vault/folder\\win-note.md',
          label: 'win-note',
          relativePath: 'folder\\win-note.md',
          modifiedAtMs: msDayTwoMorning,
        },
      ]
      assertEqual(
        resolveDateKeyForActivePath('/vault/folder/win-note.md', files),
        dayTwo,
        'forward slash active path',
      )
    },
  },
  {
    name: 'effectiveModifiedAtMsForFile prefers persisted edits over filesystem timestamps',
    run: () => {
      const persisted = new Map<string, number>([['a.md', msDayTwoMorning]])
      assertEqual(
        effectiveModifiedAtMsForFile(
          {
            path: '/vault/a.md',
            label: 'a',
            relativePath: 'a.md',
            modifiedAtMs: msDayOneAfternoon,
          },
          persisted,
        ),
        msDayTwoMorning,
        'persisted edit wins',
      )
    },
  },
  {
    name: 'collectNotesByModifiedDate ignores filesystem timestamps when preferPersistedOnly is enabled',
    run: () => {
      const index = collectNotesByModifiedDate(sampleFiles, new Map(), true)
      assertEqual(countIndexedNotes(index), 0, 'no persisted edits means empty encrypted calendar')
      const persisted = new Map<string, number>([
        ['a.md', msDayOneAfternoon],
        ['folder/b.md', msDayOneMorning],
        ['c.md', msDayTwoMorning],
      ])
      const encryptedIndex = collectNotesByModifiedDate(sampleFiles, persisted, true)
      const eligible = eligibleMarkdownFilesWithEdits(sampleFiles, persisted, true)
      assertEqual(countIndexedNotes(encryptedIndex), eligible.length, 'encrypted indexed count matches eligible markdown')
    },
  },
  {
    name: 'patchFileTreeModifiedAt updates nested markdown files',
    run: () => {
      const tree = [
        {
          name: 'notes',
          path: '/vault/notes',
          kind: 'dir' as const,
          modifiedAtMs: null,
          createdAtMs: null,
          children: [
            {
              name: 'alpha.md',
              path: '/vault/notes/alpha.md',
              kind: 'file' as const,
              modifiedAtMs: 1000,
              createdAtMs: 900,
              children: [],
            },
          ],
        },
        {
          name: 'beta.md',
          path: '/vault/beta.md',
          kind: 'file' as const,
          modifiedAtMs: 2000,
          createdAtMs: 1500,
          children: [],
        },
      ]
      const touched = patchFileTreeModifiedAt(tree, '/vault/beta.md', 9999)
      assert(touched !== tree, 'patch must clone tree')
      assertEqual(touched[1]?.modifiedAtMs, 9999, 'beta modifiedAtMs')
      const nestedTouch = patchFileTreeModifiedAt(touched, '/vault/notes/alpha.md', 8888)
      assertEqual(nestedTouch[0]?.children[0]?.modifiedAtMs, 8888, 'nested modifiedAtMs')
      const noop = patchFileTreeModifiedAt(nestedTouch, '/vault/missing.md', 1)
      assertEqual(noop, nestedTouch, 'missing path noop')
    },
  },
])

export async function assertNoteCalendarModelSuite(): Promise<{ passed: number; failed: number }> {
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
