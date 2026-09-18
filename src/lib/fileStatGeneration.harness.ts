import {
  bumpFileStatGeneration,
  captureFileStatGeneration,
  isFileStatGenerationStale,
} from './fileStatGeneration'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'bumpFileStatGeneration invalidates captured generation',
    run: () => {
      const ref = { current: 0 }
      const captured = captureFileStatGeneration(ref)
      assert(!isFileStatGenerationStale(captured, ref), 'fresh capture must not be stale')
      bumpFileStatGeneration(ref)
      assert(isFileStatGenerationStale(captured, ref), 'bumped generation must invalidate prior capture')
    },
  },
]

export async function assertFileStatGenerationSuite(): Promise<{ passed: number; failed: number }> {
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
