import { editorSurfaceForDocumentPath } from './documentBodyProjection'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'editorSurfaceForDocumentPath strips YAML frontmatter',
    run: () => {
      const markdown = '---\ntitle: X\n---\n\n# Body\n'
      const surface = editorSurfaceForDocumentPath('/vault/note.md', markdown)
      assert(surface === '\n# Body\n', 'surface must exclude frontmatter block')
      assert(!surface.includes('title: X'), 'surface must not contain YAML keys')
    },
  },
  {
    name: 'editorSurfaceForDocumentPath keeps buffer tab content raw',
    run: () => {
      const raw = '---\ntitle: Buffer\n---\n\nBody'
      assert(
        editorSurfaceForDocumentPath('luna:buf:1', raw) === raw,
        'buffer tabs must not strip frontmatter',
      )
    },
  },
]

export async function assertDocumentBodyProjectionSuite(): Promise<{ passed: number; failed: number }> {
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
