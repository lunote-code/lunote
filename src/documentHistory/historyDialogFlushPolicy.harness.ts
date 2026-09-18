import { shouldFlushEditorBeforeHistoryDiff } from './historyDialogFlushPolicy'
import { shouldAnnounceAutosaveComplete } from '../lib/autosaveStatusPolicy'
import { filterAutosaveEligibleDirtyPaths } from '../lib/autosavePathEligibility'

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
    name: 'history diff flushes only for active dialog path',
    run: () => {
      assert(
        shouldFlushEditorBeforeHistoryDiff({
          dialogPath: '/vault/active.md',
          activePath: '/vault/active.md',
        }),
        'active path should flush',
      )
      assert(
        !shouldFlushEditorBeforeHistoryDiff({
          dialogPath: '/vault/inactive.md',
          activePath: '/vault/active.md',
        }),
        'inactive path should skip flush',
      )
    },
  },
  {
    name: 'history diff still flushes when active path is unknown',
    run: () => {
      assert(
        shouldFlushEditorBeforeHistoryDiff({
          dialogPath: '/vault/note.md',
          activePath: '',
        }),
        'empty active path should keep flush behavior',
      )
      assert(
        shouldFlushEditorBeforeHistoryDiff({
          dialogPath: '/vault/note.md',
          activePath: null,
        }),
        'missing active path should keep flush behavior',
      )
    },
  },
  {
    name: 'autosave allDirty skips suspended dirty paths only',
    run: () => {
      const suspended = new Set(['/vault/history.md'])
      const eligible = filterAutosaveEligibleDirtyPaths(
        ['/vault/history.md'],
        (path) => path.startsWith('buffer-'),
        (path) => suspended.has(path),
      )
      assertEqual(eligible.length, 0, 'suspended-only dirty set should produce no autosave targets')
    },
  },
  {
    name: 'history diff flush runs once per diff session key',
    run: () => {
      const keys = new Set<string>()
      const recordFlush = (path: string, activePath?: string | null) => {
        if (!shouldFlushEditorBeforeHistoryDiff({ dialogPath: path, activePath })) return
        keys.add(`${path}:${activePath ?? ''}`)
      }
      recordFlush('/vault/active.md', '/vault/active.md')
      recordFlush('/vault/active.md', '/vault/active.md')
      assertEqual(keys.size, 1, 'duplicate flush keys should collapse to one session')
      recordFlush('/vault/other.md', '/vault/active.md')
      assertEqual(keys.size, 1, 'inactive dialog path should skip flush and not add a key')
      recordFlush('/vault/other.md', '/vault/other.md')
      assertEqual(keys.size, 2, 'inactive tab opened in history should flush with its own key')
    },
  },
  {
    name: 'autosave status stays quiet while only suspended tabs remain dirty',
    run: () => {
      assert(
        !shouldAnnounceAutosaveComplete({
          scope: 'allDirty',
          stillDirty: true,
          activeStillDirty: false,
        }),
        'allDirty should not announce when other dirty tabs remain',
      )
      assert(
        shouldAnnounceAutosaveComplete({
          scope: 'activeOnly',
          stillDirty: true,
          activeStillDirty: false,
        }),
        'activeOnly may announce once active tab is clean',
      )
    },
  },
])

export async function assertHistoryDialogFlushPolicySuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[historyDialogFlushPolicy] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
