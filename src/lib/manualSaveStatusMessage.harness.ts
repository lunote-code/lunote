import { resolveManualSaveStatusFeedback, resolveTabStatusHints } from './manualSaveStatusMessage'
import { clearExternalDiskDriftInState, hasExternalDiskDriftInState } from './externalDiskDriftState'

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

const t = (key: string) => key

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'manual save without external drift stays success',
    run: () => {
      const feedback = resolveManualSaveStatusFeedback({
        t,
        externalDriftAfterSave: false,
      })
      assertEqual(feedback.message, 'app.status.saved', 'should use saved message')
      assertEqual(feedback.tone, 'success', 'should stay success tone')
    },
  },
  {
    name: 'manual save with external drift warns after save',
    run: () => {
      const feedback = resolveManualSaveStatusFeedback({
        t,
        externalDriftAfterSave: true,
      })
      assert(
        feedback.message.includes('app.status.saved') && feedback.message.includes('app.statusbar.externalChanged'),
        'should combine saved and external copy',
      )
      assertEqual(feedback.tone, 'warning', 'should warn when external drift remains')
    },
  },
  {
    name: 'history restore save with external drift uses tab aria hint',
    run: () => {
      const feedback = resolveManualSaveStatusFeedback({
        t,
        externalDriftAfterSave: true,
        wasHistoryRestorePending: true,
      })
      assert(feedback.message.includes('app.tabs.externalAria'), 'should use short external aria copy')
    },
  },
  {
    name: 'tab hints combine history restore and external drift',
    run: () => {
      const hints = resolveTabStatusHints({
        t,
        path: '/vault/note.md',
        historyRestore: true,
        external: true,
      })
      assert(hints.title.includes('app.tabs.historyRestoreHint'), 'title should include history hint')
      assert(hints.title.includes('app.tabs.externalDiskHint'), 'title should include external hint')
      assertEqual(hints.ariaStatuses.length, 2, 'aria should include both statuses')
    },
  },
  {
    name: 'clear external drift removes path by equality',
    run: () => {
      const prev = new Set(['/vault/note.md', '/vault/other.md'])
      const next = clearExternalDiskDriftInState(prev, '/vault/note.md')
      assert(!hasExternalDiskDriftInState('/vault/note.md', next), 'cleared path should be gone')
      assert(hasExternalDiskDriftInState('/vault/other.md', next), 'other paths should remain')
    },
  },
])

export async function assertManualSaveStatusSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[manualSaveStatus] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
