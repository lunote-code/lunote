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
import {
  clearTabBodies,
  setTabBody,
  getTabBody,
  installTabBodiesKernelSync,
  projectTabBodyFromKernel,
} from '../app/document/tabBodiesStore'

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

async function awaitDocumentEvents(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve))
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
    projectOpenDocumentBody: projectTabBodyFromKernel,
  }
  registerDocumentRuntimeCapabilities(capabilities)
}

async function withRuntime(run: () => Promise<void> | void): Promise<void> {
  resetDocumentRuntimeKernel()
  clearAllHistoryRestoreState()
  clearTabBodies()
  const unsubBodies = installTabBodiesKernelSync()
  try {
    await run()
  } finally {
    unsubBodies()
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
    name: 'active restore without flush still creates pre_restore backup',
    run: async () => withRuntime(async () => {
      installMockCapabilities({ '/vault/note.md': '# disk\n' })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/note.md',
        source: 'test-open',
      })
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: '/vault/note.md',
        content: '# live before restore\n',
        source: 'test-live',
      })
      setTabBody('/vault/note.md', '# live before restore\n')
      const created: Array<{ source?: string; content: string }> = []
      await restoreSnapshotToEditor({
        rootDir: '/vault',
        path: '/vault/note.md',
        snapshotId: 'snap-live',
        dispatchDocumentCommand,
        createSnapshot: async (input) => {
          created.push({ source: input.source, content: input.content })
          return {
            id: input.source === 'pre_restore' ? 'pre-restore-active-no-flush' : 'unused',
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
            id: 'snap-live',
            workspaceId: 'vault',
            path: '/vault/note.md',
            createdAt: Date.now(),
            source: 'manual',
            title: null,
            excerpt: null,
            contentHash: 'hash',
            size: '# snapshot body\n'.length,
          },
          content: '# snapshot body\n',
        }),
      })
      assertEqual(created.length, 1, 'pre_restore should be created even without flush hook')
      assertEqual(created[0]?.source ?? '', 'pre_restore', 'backup source should be pre_restore')
      assertEqual(created[0]?.content ?? '', '# live before restore\n', 'backup should use latest tab body')
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
      const runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.activePath, '/vault/beta.md', 'inactive restore should keep active tab')
      assertEqual(runtime.content, '# beta live before restore\n', 'inactive restore should preserve active editor content')
      assert(Boolean(runtime.dirtyByPath['/vault/alpha.md']), 'inactive restored tab should stay dirty')
      assert(isAutosaveSuspended('/vault/alpha.md'), 'target path should remain autosave suspended')
      assert(!isAutosaveSuspended('/vault/beta.md'), 'non-target path should not be autosave suspended')
      assertEqual(getTabBody('/vault/alpha.md') ?? '', '# alpha restored\n', 'inactive restore should sync tab body cache')
    }),
  },
  {
    name: 'inactive manual snapshot skips active flush and uses tab-body cache',
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
      setTabBody('/vault/alpha.md', '# alpha cached for snapshot\n')
      let flushCount = 0
      const entry = await createManualSnapshotForDocument({
        rootDir: '/vault',
        path: '/vault/alpha.md',
        flushEditorToMemory: async () => {
          flushCount += 1
          return false
        },
        createSnapshot: async (input) => ({
          id: 'snap-inactive-manual',
          workspaceId: 'vault',
          path: input.path,
          createdAt: Date.now(),
          source: input.source ?? 'manual',
          title: input.title ?? null,
          excerpt: null,
          contentHash: 'hash',
          size: input.content.length,
        }),
      })
      assert(entry != null, 'inactive manual snapshot should succeed without active flush')
      assertEqual(flushCount, 0, 'inactive manual snapshot should not flush active editor')
      assertEqual(entry?.path ?? '', '/vault/alpha.md', 'snapshot should target inactive path')
      const runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.content, '# beta live\n', 'inactive manual snapshot should preserve active editor content')
    }),
  },
  {
    name: 'inactive restore then tab switch loads restored body and preserves prior active tab',
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
      await restoreSnapshotToEditor({
        rootDir: '/vault',
        path: '/vault/alpha.md',
        snapshotId: 'snap-alpha',
        dispatchDocumentCommand,
        createSnapshot: async (input) => ({
          id: 'pre-restore-inactive',
          workspaceId: 'vault',
          path: input.path,
          createdAt: Date.now(),
          source: input.source ?? 'pre_restore',
          title: input.title ?? null,
          excerpt: null,
          contentHash: 'hash',
          size: input.content.length,
        }),
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
      await awaitDocumentEvents()
      let runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.content, '# beta live before restore\n', 'active tab should stay on beta before switch')
      await dispatchDocumentCommand({
        type: 'SET_TABS',
        tabs: ['/vault/alpha.md', '/vault/beta.md'],
        activePath: '/vault/alpha.md',
        source: 'test-switch-to-restored-inactive',
      })
      await dispatchDocumentCommand({
        type: 'REPLACE_ACTIVE_DOCUMENT',
        path: '/vault/alpha.md',
        content: getTabBody('/vault/alpha.md') ?? '# alpha restored\n',
        source: 'test-switch-to-restored-inactive',
      })
      runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.activePath, '/vault/alpha.md', 'switch should activate restored tab')
      assertEqual(runtime.content, '# alpha restored\n', 'switch should load restored tab body')
      await dispatchDocumentCommand({
        type: 'SET_TABS',
        tabs: ['/vault/alpha.md', '/vault/beta.md'],
        activePath: '/vault/beta.md',
        source: 'test-switch-back',
      })
      await dispatchDocumentCommand({
        type: 'REPLACE_ACTIVE_DOCUMENT',
        path: '/vault/beta.md',
        content: getTabBody('/vault/beta.md') ?? '# beta live before restore\n',
        source: 'test-switch-back',
      })
      runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.content, '# beta live before restore\n', 'switching back should restore prior active body')
      assert(isAutosaveSuspended('/vault/alpha.md'), 'history restore suspension should survive tab switches')
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
  {
    name: 'revert keeps current editor when target tab is inactive',
    run: async () => withRuntime(async () => {
      installMockCapabilities({
        '/vault/alpha.md': '# alpha disk\n',
        '/vault/beta.md': '# beta disk updated\n',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: '/vault/beta.md',
        source: 'test-open-beta',
      })
      await dispatchDocumentCommand({
        type: 'RESTORE_WORKSPACE',
        root: '/vault',
        activePath: '/vault/alpha.md',
        openTabs: ['/vault/alpha.md', '/vault/beta.md'],
        source: 'test-restore-alpha',
      })
      await dispatchDocumentCommand({
        type: 'REVERT_DOCUMENT',
        root: '/vault',
        path: '/vault/beta.md',
        source: 'test-revert-inactive',
      })
      const runtime = getDocumentRuntimeSnapshot()
      assertEqual(runtime.activePath, '/vault/alpha.md', 'inactive revert should not switch active path')
      assertEqual(runtime.content, '# alpha disk\n', 'inactive revert should preserve active editor content')
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
