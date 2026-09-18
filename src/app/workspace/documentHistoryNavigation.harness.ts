import { dismissDocumentHistoryIfOpen } from './documentHistoryNavigation'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'open history dialog dismisses and allows navigation to continue',
    run: () => {
      let closed = 0
      const dismissed = dismissDocumentHistoryIfOpen({
        documentHistoryOpen: true,
        closeDocumentHistoryDialog: () => {
          closed += 1
        },
      })
      assert(dismissed, 'open history must dismiss')
      assert(closed === 1, 'open history must close the dialog once')
    },
  },
  {
    name: 'closed history dialog does not call close',
    run: () => {
      let closed = 0
      const dismissed = dismissDocumentHistoryIfOpen({
        documentHistoryOpen: false,
        closeDocumentHistoryDialog: () => {
          closed += 1
        },
      })
      assert(!dismissed, 'closed history must not report dismiss')
      assert(closed === 0, 'closed history must not call close')
    },
  },
])

export async function assertDocumentHistoryNavigationSuite(): Promise<{ passed: number; failed: number }> {
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
