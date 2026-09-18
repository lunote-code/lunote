import { waitForCodeMirrorCompositionEnd } from './sourceCompositionWait'

type Case = {
  readonly name: string
  readonly run: () => Promise<void>
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'source composition wait resolves immediately when not composing',
    run: async () => {
      const view = {
        composing: false,
        dom: new EventTarget(),
      }
      await waitForCodeMirrorCompositionEnd(view, 50)
    },
  },
  {
    name: 'source composition wait resolves immediately when the view is missing',
    run: async () => {
      await waitForCodeMirrorCompositionEnd(null, 50)
    },
  },
  {
    name: 'source composition wait holds until compositionend',
    run: async () => {
      const view = {
        composing: true,
        dom: new EventTarget(),
      }
      let resolved = false
      const pending = waitForCodeMirrorCompositionEnd(view, 3000).then(() => {
        resolved = true
      })
      await Promise.resolve()
      assertEqual(resolved, false, 'must wait while composing')
      view.dom.dispatchEvent(new Event('compositionend'))
      await pending
      assertEqual(resolved, true, 'resolved after compositionend')
    },
  },
])

export async function assertSourceCompositionWaitSuite(): Promise<{ passed: number; failed: number }> {
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
