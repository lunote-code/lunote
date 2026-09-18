import {
  awaitTabMutationQueue,
  enqueueTabMutationOperation,
  getTabMutationQueueDepthForTests,
  isTabMutationOperationInFlight,
  resetTabMutationQueueForTests,
} from './tabOperationQueue'

type Case = {
  name: string
  run: () => void | Promise<void>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'enqueueTabMutationOperation serializes concurrent tasks',
    run: async () => {
      resetTabMutationQueueForTests()
      const order: string[] = []
      enqueueTabMutationOperation(async () => {
        order.push('a-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        order.push('a-end')
      })
      enqueueTabMutationOperation(async () => {
        order.push('b-start')
        order.push('b-end')
      })
      await awaitTabMutationQueue()
      assert(order.join(',') === 'a-start,a-end,b-start,b-end', 'tab mutation tasks must run in FIFO order')
      assert(!isTabMutationOperationInFlight(), 'queue must be idle after drain')
      assert(getTabMutationQueueDepthForTests() === 0, 'depth must return to zero')
    },
  },
]

export async function assertTabOperationQueueSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    try {
      resetTabMutationQueueForTests()
      await testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}:`, error)
    } finally {
      resetTabMutationQueueForTests()
    }
  }
  return { passed, failed }
}
