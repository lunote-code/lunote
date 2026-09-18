import {
  invalidateEditorBootstrapBeforeDocumentRead,
} from './editorDocumentReadBootstrap'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'invalidateEditorBootstrapBeforeDocumentRead bumps reset and cold-open generation',
    run: () => {
      let resetCount = 0
      let bumpCount = 0
      invalidateEditorBootstrapBeforeDocumentRead(
        () => {
          resetCount += 1
        },
        () => {
          bumpCount += 1
        },
      )
      assert(resetCount === 1, 'reset must run once')
      assert(bumpCount === 1, 'cold-open bump must run once')
    },
  },
  {
    name: 'invalidateEditorBootstrapBeforeDocumentRead can skip cold-open bump',
    run: () => {
      let bumpCount = 0
      invalidateEditorBootstrapBeforeDocumentRead(
        () => undefined,
        () => {
          bumpCount += 1
        },
        { bumpColdOpen: false },
      )
      assert(bumpCount === 0, 'cold-open bump must be skipped when path change remounts editor')
    },
  },
]

export async function assertEditorDocumentReadBootstrapSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}:`, error)
    }
  }
  return { passed, failed }
}
