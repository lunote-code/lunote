import { buildWorkspaceSnapshot } from './persistWorkspaceSnapshot'
import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from './documentKernel'
import type { DocumentRuntimeCapabilities } from './documentTypes'
import { clearTabBodies, getTabBody, setTabBody } from './tabBodiesStore'

type Case = {
  readonly name: string
  readonly run: () => Promise<void> | void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

function installMockCapabilities(readMap: Record<string, string>): void {
  const capabilities: DocumentRuntimeCapabilities = {
    readDocument: async (_root, path) => readMap[path] ?? '',
    writeDocument: async (_root, path, content) => {
      readMap[path] = content
    },
    setActiveDocument: () => {},
    renderContent: () => {},
    setTabs: () => {},
  }
  registerDocumentRuntimeCapabilities(capabilities)
}

async function withRuntime(run: () => Promise<void> | void): Promise<void> {
  resetDocumentRuntimeKernel()
  clearTabBodies()
  try {
    await run()
  } finally {
    registerDocumentRuntimeCapabilities(null)
    resetDocumentRuntimeKernel()
    clearTabBodies()
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'workspace snapshot includes recovery drafts for active and inactive dirty notes',
    run: async () => withRuntime(async () => {
      installMockCapabilities({
        '/vault/alpha.md': '# alpha disk\n',
        '/vault/beta.md': '# beta disk\n',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/alpha.md',
        source: 'test-open-alpha',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT_IN_TAB',
        root: '/vault',
        path: '/vault/beta.md',
        source: 'test-open-beta',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/alpha.md',
        source: 'test-reopen-alpha',
      })
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: '/vault/alpha.md',
        content: '# alpha live\n',
        source: 'test-alpha-dirty',
      })
      await dispatchDocumentCommand({
        type: 'UPDATE_OPEN_DOCUMENT_CONTENT',
        path: '/vault/beta.md',
        content: '# beta live\n',
        source: 'test-beta-dirty',
      })
      setTabBody('/vault/beta.md', '# beta live\n')

      const snapshot = buildWorkspaceSnapshot()
      assert(snapshot != null, 'snapshot should be created')
      assertEqual(snapshot?.activePath ?? '', '/vault/alpha.md', 'active path should stay on alpha')
      assertEqual(
        snapshot?.recoveryDrafts?.['/vault/alpha.md']?.content ?? '',
        '# alpha live\n',
        'active dirty draft should be captured',
      )
      assertEqual(
        snapshot?.recoveryDrafts?.['/vault/beta.md']?.content ?? '',
        '# beta live\n',
        'inactive dirty draft should be captured',
      )
    }),
  },
  {
    name: 'clearRecoveryDrafts omits unsaved draft payloads',
    run: async () => withRuntime(async () => {
      installMockCapabilities({
        '/vault/note.md': '# disk\n',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/note.md',
        source: 'test-open-note',
      })
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: '/vault/note.md',
        content: '# live\n',
        source: 'test-note-dirty',
      })

      const snapshot = buildWorkspaceSnapshot({ clearRecoveryDrafts: true })
      assert(snapshot != null, 'snapshot should exist when clearing drafts')
      assertEqual(
        Object.keys(snapshot?.recoveryDrafts ?? {}).length,
        0,
        'cleared snapshot should not keep recovery drafts',
      )
    }),
  },
  {
    name: 'workspace restore ignores empty tab cache and reads disk',
    run: async () =>
      withRuntime(async () => {
        const diskByPath: Record<string, string> = {
          '/vault/note.md': '# 产品研发\n\n从磁盘加载\n',
        }
        const reads: string[] = []
        setTabBody('/vault/note.md', '')
        const capabilities: DocumentRuntimeCapabilities = {
          readDocument: async (_root, path) => {
            reads.push(path)
            return diskByPath[path] ?? ''
          },
          writeDocument: async (_root, path, content) => {
            diskByPath[path] = content
          },
          setActiveDocument: () => {},
          renderContent: () => {},
          setTabs: () => {},
          readCachedDocumentForRestore: (path) => getTabBody(path),
        }
        registerDocumentRuntimeCapabilities(capabilities)
        await dispatchDocumentCommand({
          type: 'RESTORE_WORKSPACE',
          root: '/vault',
          activePath: '/vault/note.md',
          openTabs: ['/vault/note.md'],
          source: 'workspace-restore',
        })
        assert(reads.includes('/vault/note.md'), 'empty cache must not skip the disk read')
        assert(
          getDocumentRuntimeSnapshot().content.includes('从磁盘加载'),
          'restored editor content must come from disk, not an empty hang-poisoned cache',
        )
      }),
  },
  {
    name: 'workspace restore reuses non-empty tab cache without a disk read',
    run: async () =>
      withRuntime(async () => {
        const reads: string[] = []
        setTabBody('/vault/note.md', '# unsaved live\n')
        const capabilities: DocumentRuntimeCapabilities = {
          readDocument: async (_root, path) => {
            reads.push(path)
            return '# stale disk\n'
          },
          writeDocument: async () => {},
          setActiveDocument: () => {},
          renderContent: () => {},
          setTabs: () => {},
          readCachedDocumentForRestore: (path) => getTabBody(path),
        }
        registerDocumentRuntimeCapabilities(capabilities)
        await dispatchDocumentCommand({
          type: 'RESTORE_WORKSPACE',
          root: '/vault',
          activePath: '/vault/note.md',
          openTabs: ['/vault/note.md'],
          source: 'workspace-restore',
        })
        assertEqual(reads.length, 0, 'non-empty cache must skip the disk read')
        assert(
          getDocumentRuntimeSnapshot().content.includes('unsaved live'),
          'non-empty cache must win over disk',
        )
      }),
  },
])

export async function assertPersistWorkspaceSnapshotSuite(): Promise<{ passed: number; failed: number }> {
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
