import { decideMemoryFlushCommit, shouldIgnoreEditorMarkdownSync } from './memoryFlushDirty'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const PATH = '/vault/note.md'
const SAVED = '---\ntitle: Note\n---\n\n# Body\n'

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'flush of body-only surface against full markdown saved is normalize',
    run: () => {
      const decision = decideMemoryFlushCommit({
        path: PATH,
        flushedBody: '\n# Body\n',
        savedContent: SAVED,
      })
      assert(decision.action === 'normalize', `expected normalize, got ${decision.action}`)
      if (decision.action === 'normalize') {
        assert(decision.content === SAVED, 'normalize must keep the saved baseline')
      }
    },
  },
  {
    name: 'flush of full markdown equal to saved is normalize',
    run: () => {
      const decision = decideMemoryFlushCommit({
        path: PATH,
        flushedBody: SAVED,
        savedContent: SAVED,
      })
      assert(decision.action === 'normalize', `expected normalize, got ${decision.action}`)
    },
  },
  {
    name: 'visual-normalized equality commits normalize to saved baseline',
    run: () => {
      const saved = '# Body\n'
      const decision = decideMemoryFlushCommit({
        path: PATH,
        flushedBody: '# Body\n\n',
        savedContent: saved,
        normalizeMarkdownForCompare: (markdown) => markdown.replace(/\n+/g, '\n').trim(),
      })
      assert(decision.action === 'normalize', `expected normalize, got ${decision.action}`)
      if (decision.action === 'normalize') {
        assert(decision.content === saved, 'normalize must keep the saved baseline')
      }
    },
  },
  {
    name: 'real edit commits content-changed with projected body',
    run: () => {
      const decision = decideMemoryFlushCommit({
        path: PATH,
        flushedBody: '\n# Body\n\nedited\n',
        savedContent: SAVED,
      })
      assert(decision.action === 'content-changed', `expected content-changed, got ${decision.action}`)
      if (decision.action === 'content-changed') {
        assert(decision.content.includes('edited'), 'changed body must keep the user edit')
        assert(!decision.content.includes('title: Note'), 'changed body must stay YAML-stripped')
      }
    },
  },
  {
    name: 'unedited editor markdown sync is ignored',
    run: () => {
      assert(
        shouldIgnoreEditorMarkdownSync({
          path: PATH,
          nextMarkdown: '\n# Body\n\n',
          savedContent: SAVED,
          hasUserEdited: false,
        }),
        'hydrate/serialize without user edit must not dirty',
      )
    },
  },
  {
    name: 'user edit that only round-trips is ignored',
    run: () => {
      assert(
        shouldIgnoreEditorMarkdownSync({
          path: PATH,
          nextMarkdown: '\n# Body\n',
          savedContent: SAVED,
          hasUserEdited: true,
        }),
        'body-only round trip against YAML saved must not dirty',
      )
    },
  },
  {
    name: 'user edit that changes body is not ignored',
    run: () => {
      assert(
        !shouldIgnoreEditorMarkdownSync({
          path: PATH,
          nextMarkdown: '\n# Body\n\nedited\n',
          savedContent: SAVED,
          hasUserEdited: true,
        }),
        'real body edit must sync',
      )
    },
  },
])

export async function assertMemoryFlushDirtySuite(): Promise<{ passed: number; failed: number }> {
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
