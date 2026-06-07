import {
  clearAllHistoryRestoreState,
  getHistoryRestoreState,
  isAutosaveSuspended,
  resumeAutosaveForPath,
  suspendAutosaveForPath,
} from './historyRestoreState'
import { createManualSnapshotForDocument, restoreSnapshotToEditor } from './historyService'
import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import type { DocumentRuntimeCapabilities } from '../documentRuntime/documentTypes'
import { clearTabBodies, setTabBody } from '../app/document/tabBodiesStore'

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
  clearAllHistoryRestoreState()
  clearTabBodies()
  try {
    await run()
  } finally {
    registerDocumentRuntimeCapabilities(null)
    resetDocumentRuntimeKernel()
    clearAllHistoryRestoreState()
    clearTabBodies()
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'restore state matches by path and clears cleanly',
    run: () => {
      suspendAutosaveForPath('/tmp/demo.md', 'snap-1')
      assert(isAutosaveSuspended('/tmp/demo.md'), 'autosave should be suspended')
      assertEqual(getHistoryRestoreState('/tmp/demo.md')?.snapshotId ?? '', 'snap-1', 'snapshot id stored')
      resumeAutosaveForPath('/tmp/demo.md')
      assert(!isAutosaveSuspended('/tmp/demo.md'), 'autosave suspension should clear')
      assert(getHistoryRestoreState('/tmp/demo.md') == null, 'restore state should clear')
    },
  },
  {
    name: 'manual snapshot resolves target path body when active path differs',
    run: async () => withRuntime(async () => {
      installMockCapabilities({
        '/vault/alpha.md': '# alpha disk\n',
        '/vault/beta.md': '# beta disk\n',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/beta.md',
        source: 'test-open-beta',
      })
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: '/vault/beta.md',
        content: '# beta live\n',
        source: 'test-beta-live',
      })
      setTabBody('/vault/alpha.md', '# alpha cached\n')
      const created: Array<{ rootDir: string; path: string; content: string; source?: string }> = []
      await createManualSnapshotForDocument({
        rootDir: '/vault',
        path: '/vault/alpha.md',
        flushEditorToMemory: async () => true,
        createSnapshot: async (input) => {
          created.push({ ...input })
          return {
            id: 'snap-created',
            workspaceId: 'vault',
            path: input.path,
            createdAt: Date.now(),
            source: input.source ?? 'manual',
            title: input.title ?? null,
            excerpt: null,
            contentHash: 'hash',
            size: input.content.length,
          }
        },
      })
      assertEqual(created.length, 1, 'snapshot should be created once')
      assertEqual(created[0]?.path ?? '', '/vault/alpha.md', 'snapshot path should use target path')
      assertEqual(created[0]?.content ?? '', '# alpha cached\n', 'snapshot content should use target path body')
    }),
  },
  {
    name: 'history restore marks document dirty without clearing restore suspension',
    run: async () => withRuntime(async () => {
      installMockCapabilities({ '/vault/note.md': '# disk\n' })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/note.md',
        source: 'test-open',
      })
      await dispatchDocumentCommand({
        type: 'RESTORE_DOCUMENT_HISTORY_SNAPSHOT',
        path: '/vault/note.md',
        content: '# old snapshot\n',
        snapshotId: 'snap-restore',
        source: 'history-restore',
      })
      suspendAutosaveForPath('/vault/note.md', 'snap-restore')
      const runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.content, '# old snapshot\n', 'restored content becomes active content')
      assert(Boolean(runtime.dirtyByPath['/vault/note.md']), 'restored content should stay dirty')
      assert(isAutosaveSuspended('/vault/note.md'), 'restore suspension should remain active')
    }),
  },
  {
    name: 'restore pre_restore snapshot resolves target path body when active path differs',
    run: async () => withRuntime(async () => {
      installMockCapabilities({
        '/vault/alpha.md': '# alpha disk\n',
        '/vault/beta.md': '# beta disk\n',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/beta.md',
        source: 'test-open-beta',
      })
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: '/vault/beta.md',
        content: '# beta live before restore\n',
        source: 'test-beta-live',
      })
      setTabBody('/vault/alpha.md', '# alpha cached before restore\n')
      const created: Array<{ rootDir: string; path: string; content: string; source?: string }> = []
      const restored = await restoreSnapshotToEditor({
        rootDir: '/vault',
        path: '/vault/alpha.md',
        snapshotId: 'snap-alpha',
        flushEditorToMemory: async () => true,
        dispatchDocumentCommand,
        createSnapshot: async (input) => {
          created.push({ ...input })
          return {
            id: 'pre-restore',
            workspaceId: 'vault',
            path: input.path,
            createdAt: Date.now(),
            source: input.source ?? 'manual',
            title: input.title ?? null,
            excerpt: null,
            contentHash: 'hash',
            size: input.content.length,
          }
        },
        readSnapshot: async () => ({
          entry: {
            id: 'snap-alpha',
            workspaceId: 'vault',
            path: '/vault/alpha.md',
            createdAt: Date.now(),
            source: 'manual',
            title: null,
            excerpt: null,
            contentHash: 'hash',
            size: '# alpha restored\n'.length,
          },
          content: '# alpha restored\n',
        }),
      })
      assertEqual(created.length, 1, 'pre_restore snapshot should be created once')
      assertEqual(created[0]?.source ?? '', 'pre_restore', 'pre_restore source should be used')
      assertEqual(
        created[0]?.content ?? '',
        '# alpha cached before restore\n',
        'pre_restore snapshot should use target path body',
      )
      assertEqual(restored.content, '# alpha restored\n', 'restored snapshot content should be returned')
      assertEqual(getDocumentRuntimeSnapshot().content, '# alpha restored\n', 'restore should update active content')
      assert(isAutosaveSuspended('/vault/alpha.md'), 'target path should remain autosave suspended')
      assert(!isAutosaveSuspended('/vault/beta.md'), 'non-target path should not be autosave suspended')
    }),
  },
  {
    name: 'manual save clears restore suspension and dirty flag',
    run: async () => withRuntime(async () => {
      installMockCapabilities({ '/vault/note.md': '# disk\n' })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/note.md',
        source: 'test-open',
      })
      await dispatchDocumentCommand({
        type: 'RESTORE_DOCUMENT_HISTORY_SNAPSHOT',
        path: '/vault/note.md',
        content: '# snapshot content\n',
        snapshotId: 'snap-save',
        source: 'history-restore',
      })
      suspendAutosaveForPath('/vault/note.md', 'snap-save')
      await dispatchDocumentCommand({
        type: 'SAVE_DOCUMENT',
        root: '/vault',
        path: '/vault/note.md',
        content: '# snapshot content\n',
        source: 'test-save',
      })
      const runtime = getDocumentRuntimeSnapshot()
      assert(!runtime.dirtyByPath['/vault/note.md'], 'save should clear dirty flag')
      assert(!isAutosaveSuspended('/vault/note.md'), 'save should clear restore suspension')
    }),
  },
  {
    name: 'restore rejects snapshot whose path mismatches target path',
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
      let threw = false
      try {
        await restoreSnapshotToEditor({
          rootDir: '/vault',
          path: '/vault/alpha.md',
          snapshotId: 'snap-wrong-path',
          dispatchDocumentCommand,
          readSnapshot: async () => ({
            entry: {
              id: 'snap-wrong-path',
              workspaceId: 'vault',
              path: '/vault/beta.md',
              createdAt: Date.now(),
              source: 'manual',
              title: null,
              excerpt: null,
              contentHash: 'hash',
              size: '# beta restored\n'.length,
            },
            content: '# beta restored\n',
          }),
        })
      } catch (error) {
        threw = true
        assert(
          String(error).includes('History snapshot path mismatch'),
          'restore should reject mismatched snapshot path',
        )
      }
      assert(threw, 'restore should throw for mismatched snapshot path')
      assert(!isAutosaveSuspended('/vault/alpha.md'), 'failed restore should not suspend autosave')
      assertEqual(getDocumentRuntimeSnapshot().content, '# alpha disk\n', 'failed restore should not replace content')
    }),
  },
  {
    name: 'reload from disk clears restore suspension and restores baseline content',
    run: async () => withRuntime(async () => {
      installMockCapabilities({ '/vault/note.md': '# disk latest\n' })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/note.md',
        source: 'test-open',
      })
      await dispatchDocumentCommand({
        type: 'RESTORE_DOCUMENT_HISTORY_SNAPSHOT',
        path: '/vault/note.md',
        content: '# snapshot content\n',
        snapshotId: 'snap-revert',
        source: 'history-restore',
      })
      suspendAutosaveForPath('/vault/note.md', 'snap-revert')
      await dispatchDocumentCommand({
        type: 'REVERT_DOCUMENT',
        root: '/vault',
        path: '/vault/note.md',
        source: 'test-revert',
      })
      const runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.content, '# disk latest\n', 'revert should restore disk content')
      assert(!runtime.dirtyByPath['/vault/note.md'], 'revert should clear dirty flag')
      assert(!isAutosaveSuspended('/vault/note.md'), 'revert should clear restore suspension')
    }),
  },
])

export async function assertHistoryRestoreSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      await testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.error(`FAIL ${testCase.name}: ${message}`)
    }
  }
  return { passed, failed }
}
