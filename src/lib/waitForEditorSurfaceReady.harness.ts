import { waitForEditorSurfaceReady } from './waitForEditorSurfaceReady'

type Case = {
  name: string
  run: () => void | Promise<void>
}

const CASES: Case[] = [
  {
    name: 'waitForEditorSurfaceReady resolves immediately for empty path',
    run: async () => {
      await waitForEditorSurfaceReady({
        mainPaneMode: 'visual',
        visualEditorRef: { current: null },
        path: '   ',
        contentRef: { current: '' },
      })
    },
  },
  {
    name: 'waitForEditorSurfaceReady resolves immediately in source mode',
    run: async () => {
      await waitForEditorSurfaceReady({
        mainPaneMode: 'source',
        visualEditorRef: { current: null },
        path: '/vault/notes/a.md',
        contentRef: { current: '# hello' },
      })
    },
  },
]

export async function assertWaitForEditorSurfaceReadySuite(): Promise<{ passed: number; failed: number }> {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await assertWaitForEditorSurfaceReadySuite()
  process.exit(result.failed > 0 ? 1 : 0)
}
