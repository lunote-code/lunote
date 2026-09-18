import type { FlatWorkspaceFile } from '../workspace/types'
import {
  mergeNoteCalendarEditsMaps,
  migrateNoteCalendarEditsForRelativeRename,
  noteCalendarEditsMapFromRecord,
  noteCalendarEditsRecordFromMap,
  normalizeNoteCalendarRelativePath,
  pruneNoteCalendarEditsToKnownFiles,
  recordNoteCalendarEditInMap,
} from './noteCalendarEditStore'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const sampleFiles: readonly FlatWorkspaceFile[] = [
  {
    path: '/vault/a.md',
    label: 'a',
    relativePath: 'a.md',
    modifiedAtMs: 1000,
  },
  {
    path: '/vault/folder/b.md',
    label: 'b',
    relativePath: 'folder/b.md',
    modifiedAtMs: 2000,
  },
]

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'normalizeNoteCalendarRelativePath normalizes backslashes',
    run: () => {
      assertEqual(normalizeNoteCalendarRelativePath('folder\\b.md'), 'folder/b.md', 'relative path')
    },
  },
  {
    name: 'recordNoteCalendarEditInMap stores editedAtMs by relative path',
    run: () => {
      const edits = recordNoteCalendarEditInMap(new Map(), 'a.md', 5000)
      assertEqual(edits.get('a.md'), 5000, 'editedAtMs')
    },
  },
  {
    name: 'noteCalendarEditsRecordFromMap round-trips through noteCalendarEditsMapFromRecord',
    run: () => {
      const edits = recordNoteCalendarEditInMap(new Map(), 'a.md', 5000)
      const record = noteCalendarEditsRecordFromMap(edits, 6000)
      assertEqual(noteCalendarEditsMapFromRecord(record).get('a.md'), 5000, 'round trip')
    },
  },
  {
    name: 'pruneNoteCalendarEditsToKnownFiles drops missing markdown paths',
    run: () => {
      const pruned = pruneNoteCalendarEditsToKnownFiles(
        new Map([
          ['a.md', 5000],
          ['missing.md', 7000],
        ]),
        sampleFiles,
      )
      assertEqual(pruned.size, 1, 'pruned size')
      assertEqual(pruned.get('a.md'), 5000, 'kept edit')
    },
  },
  {
    name: 'mergeNoteCalendarEditsMaps keeps the latest editedAtMs per path',
    run: () => {
      const merged = mergeNoteCalendarEditsMaps(
        new Map([['a.md', 1000]]),
        new Map([['a.md', 2000], ['b.md', 3000]]),
      )
      assertEqual(merged.get('a.md'), 2000, 'latest wins')
      assertEqual(merged.get('b.md'), 3000, 'extra path kept')
    },
  },
  {
    name: 'migrateNoteCalendarEditsForRelativeRename remaps file and directory prefixes',
    run: () => {
      const edits = new Map([
        ['notes/a.md', 1000],
        ['notes/nested/b.md', 2000],
        ['other.md', 3000],
      ])
      const migrated = migrateNoteCalendarEditsForRelativeRename(edits, 'notes', 'archive/notes')
      assertEqual(migrated.get('archive/notes/a.md'), 1000, 'file remapped')
      assertEqual(migrated.get('archive/notes/nested/b.md'), 2000, 'nested remapped')
      assertEqual(migrated.get('other.md'), 3000, 'unrelated kept')
    },
  },
])

export async function assertNoteCalendarEditStoreSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(
        `fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  return { passed, failed }
}
