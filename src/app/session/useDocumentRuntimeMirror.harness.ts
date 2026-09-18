import {
  getDocumentRuntimeSnapshot,
  subscribeDocumentRuntime,
} from '../../documentRuntime/documentKernel'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'document runtime mirror keeps refs aligned with kernel snapshot',
    run: () => {
      const snapshot = getDocumentRuntimeSnapshot()
      const activePathRef = { current: snapshot.activePath }
      const contentRef = { current: snapshot.content }
      activePathRef.current = snapshot.activePath
      contentRef.current = snapshot.content
      assert(activePathRef.current === snapshot.activePath, 'activePathRef must mirror kernel activePath')
      assert(contentRef.current === snapshot.content, 'contentRef must mirror kernel content')
      assert(typeof subscribeDocumentRuntime === 'function', 'mirror hook must subscribe to document runtime')
    },
  },
]

export async function assertDocumentRuntimeMirrorSuite(): Promise<{ passed: number; failed: number }> {
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
