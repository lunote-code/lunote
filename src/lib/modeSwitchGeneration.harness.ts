import {
  bumpModeSwitchGeneration,
  captureModeSwitchGeneration,
  isModeSwitchStale,
} from './modeSwitchGeneration'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'bumpModeSwitchGeneration invalidates captured generation',
    run: () => {
      const ref = { current: 0 }
      const captured = captureModeSwitchGeneration(ref)
      assert(!isModeSwitchStale(captured, ref), 'fresh capture must not be stale')
      bumpModeSwitchGeneration(ref)
      assert(isModeSwitchStale(captured, ref), 'bumped generation must invalidate prior capture')
    },
  },
  {
    name: 'matching generation stays valid',
    run: () => {
      const ref = { current: 3 }
      const captured = captureModeSwitchGeneration(ref)
      assert(!isModeSwitchStale(captured, ref), 'same generation must remain valid')
    },
  },
]

export async function assertModeSwitchGenerationSuite(): Promise<{ passed: number; failed: number }> {
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
