import {
  clearDocumentFrontmatter,
  getDocumentFrontmatterFields,
} from '../../editor/documentFrontmatterStore'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { setTabBody } from './tabBodiesStore'
import { seedDocumentFrontmatterCacheIfMissing } from './seedDocumentFrontmatterCache'

type Case = {
  name: string
  run: () => void | Promise<void>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'seedDocumentFrontmatterCache prefers sourceModeIdentity over body-only tab cache',
    run: async () => {
      const path = '/vault/note.md'
      clearDocumentFrontmatter(path)
      setTabBody(path, '# Body only\n')
      setSourceModeIdentity(path, '---\ntitle: Note\n---\n\n# Body only\n')
      const seeded = await seedDocumentFrontmatterCacheIfMissing({
        absolutePath: path,
        isOpen: true,
        activePath: path,
        contentRef: { current: '# Body only\n' },
        rootAtRequest: '/vault',
      })
      assert(seeded, 'seed should succeed from source identity')
      assert(getDocumentFrontmatterFields(path)?.title === 'Note', 'frontmatter cache must preserve YAML fields')
    },
  },
]

export async function assertSeedDocumentFrontmatterCacheSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    try {
      await testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}:`, error)
    }
  }
  return { passed, failed }
}
