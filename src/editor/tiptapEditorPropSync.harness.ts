import { shouldSkipOnCreateOwnedHydration } from './tiptapEditorPropSync'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'onCreate skip must not leave a non-empty restore in an empty editor',
    run: () => {
      assert(
        !shouldSkipOnCreateOwnedHydration({
          pending: { documentKey: '/vault/note.md', markdown: '# 产品研发\n' },
          documentKey: '/vault/note.md',
          markdown: '# 产品研发\n',
          editorIsEmpty: true,
        }),
        'deferred onCreate cannot skip prop-sync while the editor is still empty',
      )
    },
  },
  {
    name: 'onCreate skip still avoids a second hydrate after content landed',
    run: () => {
      assert(
        shouldSkipOnCreateOwnedHydration({
          pending: { documentKey: '/vault/note.md', markdown: '# 产品研发\n' },
          documentKey: '/vault/note.md',
          markdown: '# 产品研发\n',
          editorIsEmpty: false,
        }),
        'successful onCreate hydrate must not be applied twice',
      )
    },
  },
  {
    name: 'empty markdown can skip when the editor is already empty',
    run: () => {
      assert(
        shouldSkipOnCreateOwnedHydration({
          pending: { documentKey: '/vault/note.md', markdown: '' },
          documentKey: '/vault/note.md',
          markdown: '',
          editorIsEmpty: true,
        }),
        'blank documents should not force a second empty hydrate',
      )
    },
  },
])

export async function assertTiptapEditorPropSyncSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[tiptapEditorPropSync] ${testCase.name}:`, error)
    }
  }
  return { passed, failed }
}
