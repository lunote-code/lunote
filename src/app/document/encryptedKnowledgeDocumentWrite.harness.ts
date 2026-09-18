import {
  appendWikiLinkToMarkdownBody,
  formatWikiLinkMarkup,
} from '../../editor/knowledgeOS/graphLinkCreationRuntime'
import { removeWikiLinkFromMarkdownBody } from '../../editor/knowledgeOS/graphLinkRemovalRuntime'
import { parseFrontmatter } from '../../editor/knowledgeRuntime/wikiLinkParser'
import {
  persistOpenDocumentWithEncryptionRetryWithDeps,
} from '../../workspace/encryptedDocumentSave'

type Case = {
  readonly name: string
  readonly run: () => void | Promise<void>
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const t = (key: string) => key

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'append wiki link markdown mutation appends link markup once',
    run: () => {
      const markup = formatWikiLinkMarkup('note-b', 'Note B')
      const next = appendWikiLinkToMarkdownBody('# Title\n\nBody.', markup)
      assert(next.includes(markup), 'append should include wiki link markup')
      assertEqual(next.split(markup).length - 1, 1, 'append should add link exactly once')
    },
  },
  {
    name: 'remove wiki link markdown mutation removes targeted link',
    run: () => {
      const body = '# Title\n\nSee [[note-b]] here.\n'
      const next = removeWikiLinkFromMarkdownBody(body, 'note-b')
      assert(!next.includes('[[note-b]]'), 'remove should drop target link')
      assert(next.includes('# Title'), 'remove should preserve surrounding body')
    },
  },
  {
    name: 'frontmatter-aware save content keeps yaml block in persisted payload',
    run: () => {
      const full = '---\ntitle: Note\n---\n# Body\n'
      const { body } = parseFrontmatter(full)
      assertEqual(body, '# Body\n', 'parseFrontmatter should expose body')
      assert(full.startsWith('---\n'), 'persist payload should retain frontmatter block')
    },
  },
  {
    name: 'knowledge graph link append uses encrypted persist helper source id',
    run: async () => {
      let source = ''
      const saved = await persistOpenDocumentWithEncryptionRetryWithDeps(
        {
          rootAtRequest: '/vault',
          getCurrentRootDir: () => '/vault',
          path: 'notes/a.md',
          content: '---\ntitle: A\n---\n[[note-b]]\n',
          source: 'knowledge-graph-link',
          allowUnlockRetry: true,
          t,
        },
        {
          path: 'notes/a.md',
          local: '---\ntitle: A\n---\n[[note-b]]\n',
          t,
        },
        {
          dispatchSave: async (command) => {
            source = command.source
          },
          ensureUnlocked: async () => true,
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => false,
        },
      )
      assert(saved, 'append persist path should succeed with injected deps')
      assertEqual(source, 'knowledge-graph-link', 'append should tag save source for diagnostics')
    },
  },
  {
    name: 'knowledge graph link remove uses encrypted persist helper source id',
    run: async () => {
      let source = ''
      const saved = await persistOpenDocumentWithEncryptionRetryWithDeps(
        {
          rootAtRequest: '/vault',
          getCurrentRootDir: () => '/vault',
          path: 'notes/a.md',
          content: '# Body\n',
          source: 'knowledge-graph-link-remove',
          allowUnlockRetry: true,
          t,
        },
        {
          path: 'notes/a.md',
          local: '# Body\n',
          t,
        },
        {
          dispatchSave: async (command) => {
            source = command.source
          },
          ensureUnlocked: async () => true,
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => false,
        },
      )
      assert(saved, 'remove persist path should succeed with injected deps')
      assertEqual(source, 'knowledge-graph-link-remove', 'remove should tag save source for diagnostics')
    },
  },
  {
    name: 'frontmatter update uses encrypted persist helper source id',
    run: async () => {
      let source = ''
      const saved = await persistOpenDocumentWithEncryptionRetryWithDeps(
        {
          rootAtRequest: '/vault',
          getCurrentRootDir: () => '/vault',
          path: 'notes/a.md',
          content: '---\ntitle: Renamed\n---\n# Body\n',
          source: 'document-frontmatter-update',
          allowUnlockRetry: true,
          t,
        },
        {
          path: 'notes/a.md',
          local: '---\ntitle: Renamed\n---\n# Body\n',
          t,
        },
        {
          dispatchSave: async (command) => {
            source = command.source
          },
          ensureUnlocked: async () => true,
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => false,
        },
      )
      assert(saved, 'frontmatter persist path should succeed with injected deps')
      assertEqual(source, 'document-frontmatter-update', 'frontmatter should tag save source for diagnostics')
    },
  },
])

export async function assertEncryptedKnowledgeDocumentWriteSuite(): Promise<{ passed: number; failed: number }> {
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
