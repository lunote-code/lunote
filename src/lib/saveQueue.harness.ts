import { enqueueSave, awaitPendingSerialTasks } from './saveQueue'

type Case = {
  readonly name: string
  readonly run: () => Promise<void>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const CASES: readonly Case[] = [
  {
    name: 'awaitPendingSerialTasks waits for queued save work',
    run: async () => {
      const events: string[] = []
      const first = enqueueSave(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        events.push('save-done')
      })
      await awaitPendingSerialTasks()
      assert(events.includes('save-done'), 'drain must wait for queued save')
      await first
    },
  },
  {
    name: 'awaitPendingSerialTasks serializes with later save tasks',
    run: async () => {
      const events: string[] = []
      void enqueueSave(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15))
        events.push('first')
      })
      const second = enqueueSave(async () => {
        events.push('second')
      })
      await awaitPendingSerialTasks()
      assertEqual(events.join(','), 'first,second', 'queue order')
      await second
    },
  },
]

function assertEqual(actual: string, expected: string, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${expected} actual=${actual}`)
  }
}

export async function assertSaveQueueSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      await testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { passed, failed }
}
