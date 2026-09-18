import { DEFAULT_WORKSPACE_CONFIG, type WorkspaceConfig } from './workspaceConfigTypes'
import { isNewNoteTemplatesEnabled } from './workspaceConfig'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'new-note templates stay enabled when the flag is omitted',
    run: () => {
      assert(isNewNoteTemplatesEnabled(DEFAULT_WORKSPACE_CONFIG), 'default config must enable templates')
      assert(isNewNoteTemplatesEnabled({ version: 1 }), 'legacy workspace.json without the flag stays enabled')
    },
  },
  {
    name: 'new-note templates can be turned off without auto-provision',
    run: () => {
      const config: WorkspaceConfig = {
        version: 1,
        templates: { enabled: false, folder: 'Templates' },
      }
      assert(!isNewNoteTemplatesEnabled(config), 'enabled: false must disable new-note templates')
    },
  },
])

export async function assertWorkspaceConfigSuite(): Promise<{ passed: number; failed: number }> {
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
