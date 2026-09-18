import {
  cancelBackgroundWorkspaceIndexing,
  getBackgroundWorkspaceIndexGenerationForTests,
  isBackgroundWorkspaceIndexGenerationStale,
  resetBackgroundWorkspaceIndexingForTests,
} from './workspaceIndexCoordinator'
import {
  getWorkspaceLinkGraphBootstrapGenerationForTests,
  resetWorkspaceLinkGraphBootstrap,
} from '../../editor/knowledgeRuntime/workspaceLinkGraphBootstrap'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const CASES: readonly Case[] = [
  {
    name: 'cancelBackgroundWorkspaceIndexing bumps generation',
    run: () => {
      resetBackgroundWorkspaceIndexingForTests()
      const before = getBackgroundWorkspaceIndexGenerationForTests()
      cancelBackgroundWorkspaceIndexing()
      const after = getBackgroundWorkspaceIndexGenerationForTests()
      assert(after === before + 1, 'generation must increment')
      assert(isBackgroundWorkspaceIndexGenerationStale(before), 'prior generation must be stale')
      assert(!isBackgroundWorkspaceIndexGenerationStale(after), 'current generation must be active')
    },
  },
  {
    name: 'cancelBackgroundWorkspaceIndexing invalidates link graph bootstrap',
    run: () => {
      resetBackgroundWorkspaceIndexingForTests()
      resetWorkspaceLinkGraphBootstrap()
      const bootstrapBefore = getWorkspaceLinkGraphBootstrapGenerationForTests()
      cancelBackgroundWorkspaceIndexing()
      const bootstrapAfter = getWorkspaceLinkGraphBootstrapGenerationForTests()
      assert(bootstrapAfter === bootstrapBefore + 1, 'bootstrap generation must increment on cancel')
    },
  },
]

export function assertWorkspaceIndexCoordinatorSuite(): { passed: number; failed: number } {
  resetBackgroundWorkspaceIndexingForTests()
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      resetBackgroundWorkspaceIndexingForTests()
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  resetBackgroundWorkspaceIndexingForTests()
  return { passed, failed }
}
