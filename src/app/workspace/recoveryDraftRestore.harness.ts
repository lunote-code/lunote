import { shouldRestoreRecoveryDraft } from './recoveryDraftRestore'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'restores recovery draft when disk version is not newer',
    run: () => {
      const ok = shouldRestoreRecoveryDraft({
        draft: { content: '# live\n', updatedAt: 20_000 },
        diskContent: '# disk\n',
        diskModifiedSecs: 19,
      })
      assert(ok, 'draft should restore when it is newer than disk content')
    },
  },
  {
    name: 'skips recovery draft when disk already matches draft content',
    run: () => {
      const ok = shouldRestoreRecoveryDraft({
        draft: { content: '# live\r\n', updatedAt: 20_000 },
        diskContent: '# live\n',
        diskModifiedSecs: 20,
      })
      assert(!ok, 'matching disk content should not be restored again')
    },
  },
  {
    name: 'skips recovery draft when disk file is newer than draft timestamp',
    run: () => {
      const ok = shouldRestoreRecoveryDraft({
        draft: { content: '# stale\n', updatedAt: 20_000 },
        diskContent: '# saved newer\n',
        diskModifiedSecs: 25,
      })
      assert(!ok, 'newer disk content should suppress stale recovery draft')
    },
  },
  {
    name: 'skips recovery draft when body-only draft matches disk body with yaml',
    run: () => {
      const ok = shouldRestoreRecoveryDraft({
        draft: { content: '# live\n', updatedAt: 20_000 },
        diskContent: '---\ntitle: Note\n---\n# live\n',
        diskModifiedSecs: 19,
      })
      assert(!ok, 'body-only draft matching disk body should not restore')
    },
  },
])

export async function assertRecoveryDraftRestoreSuite(): Promise<{ passed: number; failed: number }> {
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
