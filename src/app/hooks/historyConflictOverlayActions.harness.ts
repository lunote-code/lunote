import {
  confirmDeleteFromDocumentHistory,
  createFromDocumentHistory,
  keepLocalFromSaveConflict,
  restoreFromDocumentHistory,
  applyDiskFromSaveConflict,
} from './historyConflictOverlayActions'
import type { SaveConflictState } from '../document/saveConflictState'

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

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key

function makeConflict(overrides?: Partial<SaveConflictState>): SaveConflictState {
  return {
    path: '/vault/note.md',
    base: '# base\n',
    local: '# local\n',
    disk: '# disk\n',
    diskReadable: true,
    sourceMode: 'manual',
    ...overrides,
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'use disk dispatches revert and reports info',
    run: async () => {
      const calls: string[] = []
      const ok = await applyDiskFromSaveConflict({
        conflict: makeConflict(),
        rootDir: '/vault',
        dispatchDocumentCommand: async (command) => {
          calls.push(`${command.type}:${command.path}`)
        },
        refreshActiveEditorAfterPathReload: (path) => {
          calls.push(`refresh:${path}`)
        },
        setStatus: (message, tone) => {
          calls.push(`status:${tone}:${message}`)
        },
        t,
      })
      assert(ok, 'use disk should return true')
      assertEqual(calls[0], 'REVERT_DOCUMENT:/vault/note.md', 'should revert target path')
      assertEqual(calls[1], 'refresh:/vault/note.md', 'should refresh target path')
      assertEqual(calls[2], 'status:info:app.menu.revertedFromDisk', 'should report info status')
    },
  },
  {
    name: 'keep local force saves and reports success',
    run: async () => {
      const calls: string[] = []
      const ok = await keepLocalFromSaveConflict({
        conflict: makeConflict(),
        rootDir: '/vault',
        dispatchDocumentCommand: async (command) => {
          calls.push(`${command.type}:${command.path}:${String(command.forceOverwrite)}`)
        },
        markWorkspaceRefreshSuppressed: () => {
          calls.push('suppress')
        },
        setSavedAt: (value) => {
          calls.push(`savedAt:${Boolean(value)}`)
        },
        refreshActiveEditorAfterPathReload: (path) => {
          calls.push(`refresh:${path}`)
        },
        setStatus: (message, tone) => {
          calls.push(`status:${tone}:${message}`)
        },
        t,
      })
      assert(ok, 'keep local should return true')
      assertEqual(calls[0], 'SAVE_DOCUMENT:/vault/note.md:true', 'should force save target path')
      assertEqual(calls[1], 'suppress', 'should suppress workspace refresh')
      assertEqual(calls[2], 'savedAt:true', 'should stamp saved time')
      assertEqual(calls[3], 'refresh:/vault/note.md', 'should refresh target path')
      assertEqual(calls[4], 'status:success:app.status.saved', 'should report success status')
    },
  },
  {
    name: 'keep local surfaces save failure',
    run: async () => {
      const calls: string[] = []
      const ok = await keepLocalFromSaveConflict({
        conflict: makeConflict(),
        rootDir: '/vault',
        dispatchDocumentCommand: async () => {
          throw new Error('disk busy')
        },
        markWorkspaceRefreshSuppressed: () => {
          calls.push('suppress')
        },
        setSavedAt: () => {
          calls.push('savedAt')
        },
        refreshActiveEditorAfterPathReload: () => {
          calls.push('refresh')
        },
        setStatus: (message, tone) => {
          calls.push(`status:${tone}:${message}`)
        },
        t,
      })
      assert(!ok, 'keep local should return false on failure')
      assertEqual(
        calls[0],
        'status:error:app.status.saveFailed:{"message":"disk busy"}',
        'should report save error status',
      )
      assertEqual(calls.length, 1, 'should not continue success side effects')
    },
  },
  {
    name: 'restore reports warning on success',
    run: async () => {
      const calls: string[] = []
      await restoreFromDocumentHistory({
        snapshotId: 'snap-1',
        context: { rootDir: '/vault', path: '/vault/note.md' },
        flushEditorToMemory: async () => true,
        dispatchDocumentCommand: async () => undefined,
        restoreSnapshot: async () => ({
          entry: {
            id: 'snap-1',
            workspaceId: 'vault',
            path: '/vault/note.md',
            createdAt: Date.now(),
            source: 'manual',
            title: null,
            excerpt: null,
            contentHash: 'hash',
            size: 8,
          },
          content: '# old\n',
        }),
        setStatus: (message, tone) => {
          calls.push(`status:${tone}:${message}`)
        },
        t,
      })
      assertEqual(calls[0], 'status:warning:app.history.restoredPendingSave', 'should report restore warning')
    },
  },
  {
    name: 'restore reports error and rethrows on failure',
    run: async () => {
      const calls: string[] = []
      let threw = false
      try {
        await restoreFromDocumentHistory({
          snapshotId: 'snap-1',
          context: { rootDir: '/vault', path: '/vault/note.md' },
          flushEditorToMemory: async () => true,
          dispatchDocumentCommand: async () => undefined,
          restoreSnapshot: async () => {
            throw new Error('snapshot missing')
          },
          setStatus: (message, tone) => {
            calls.push(`status:${tone}:${message}`)
          },
          t,
        })
      } catch {
        threw = true
      }
      assert(threw, 'restore should rethrow')
      assertEqual(
        calls[0],
        'status:error:app.status.operationFailed:{"message":"snapshot missing"}',
        'should report restore error',
      )
    },
  },
  {
    name: 'create snapshot reports success when entry exists',
    run: async () => {
      const calls: string[] = []
      const entry = await createFromDocumentHistory({
        context: { rootDir: '/vault', path: '/vault/note.md' },
        flushEditorToMemory: async () => true,
        createSnapshot: async ({ path }) => ({
          id: 'snap-1',
          workspaceId: 'vault',
          path,
          createdAt: Date.now(),
          source: 'manual',
          title: null,
          excerpt: null,
          contentHash: 'hash',
          size: 12,
        }),
        setStatus: (message, tone) => {
          calls.push(`status:${tone}:${message}`)
        },
        t,
      })
      assertEqual(entry?.id ?? '', 'snap-1', 'should return created entry')
      assertEqual(calls[0], 'status:success:app.history.snapshotCreated', 'should report snapshot success')
    },
  },
  {
    name: 'confirm delete uses warning dialog copy',
    run: async () => {
      const result = await confirmDeleteFromDocumentHistory({
        entry: {
          id: 'snap-1',
          workspaceId: 'vault',
          path: '/vault/note.md',
          createdAt: Date.now(),
          source: 'manual',
          title: null,
          excerpt: null,
          contentHash: 'hash',
          size: 12,
        },
        confirmAppDialog: async (opts) => {
          assertEqual(opts.title, 'app.history.dialog.title', 'should use history title')
          assertEqual(opts.message, 'app.history.dialog.deleteConfirm', 'should use delete confirmation copy')
          assertEqual(opts.confirmLabel, 'ctx.file.delete', 'should use delete label')
          assertEqual(opts.cancelLabel, 'app.rename.cancel', 'should use cancel label')
          assertEqual(opts.variant, 'warning', 'should use warning variant')
          return true
        },
        t,
      })
      assert(result, 'confirm delete should return dialog result')
    },
  },
])

export async function assertHistoryConflictOverlayActionsSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      await testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[historyConflictOverlayActions] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
