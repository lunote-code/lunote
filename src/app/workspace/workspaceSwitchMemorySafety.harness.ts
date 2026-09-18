import {
  shouldLeavePreviousWorkspace,
  shouldResetWorkspaceSessionOnUnlockCancel,
} from './workspaceSwitchLifecycle'
import { finalizeLeavingWorkspaceWithDeps } from './finalizeLeavingWorkspace'
import { vaultScopeAiConversationDocKey } from '../../settings-runtime/aiSettings'
import {
  getKnowledgeSidebarSnapshotCountForTests,
  resetKnowledgeSidebarRuntime,
  seedKnowledgeSidebarSnapshotForTests,
} from '../../editor/knowledgeSurfaceRuntime/knowledgeSidebarRuntime'
import { resetKnowledgeSurfaceRuntime } from '../../editor/knowledgeSurfaceRuntime/knowledgeSurfaceBridge'

type Case = {
  readonly name: string
  readonly run: () => void | Promise<void>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = [
  {
    name: 'shouldLeavePreviousWorkspace is true when roots differ',
    run: () => {
      assert(shouldLeavePreviousWorkspace('/vault/a', '/vault/b'), 'different roots must finalize')
      assert(
        !shouldLeavePreviousWorkspace('C:/Vault/A', 'c:/vault/a'),
        'Windows roots differing only by case must not finalize',
      )
    },
  },
  {
    name: 'shouldLeavePreviousWorkspace is false for same or empty roots',
    run: () => {
      assert(!shouldLeavePreviousWorkspace('/vault/a', '/vault/a'), 'same root must not finalize')
      assert(!shouldLeavePreviousWorkspace('', '/vault/b'), 'empty previous root must not finalize')
      assert(!shouldLeavePreviousWorkspace('/vault/a', ''), 'empty next root must not finalize')
    },
  },
  {
    name: 'shouldResetWorkspaceSessionOnUnlockCancel preserves existing workspace session',
    run: () => {
      assert(!shouldResetWorkspaceSessionOnUnlockCancel('/vault/a'), 'cancelled unlock must keep prior workspace session')
      assert(shouldResetWorkspaceSessionOnUnlockCancel(''), 'first-open unlock cancel must reset to idle')
      assert(shouldResetWorkspaceSessionOnUnlockCancel('   '), 'whitespace-only previous root counts as empty')
    },
  },
  {
    name: 'finalizeLeavingWorkspaceWithDeps runs teardown steps in order',
    run: async () => {
      const events: string[] = []
      const externalPathSnapshots: Set<string>[] = []
      await finalizeLeavingWorkspaceWithDeps(
        '/vault/a',
        {
          previousRoot: '/vault/a',
          setExternalDiskChangedPaths: (next) => {
            externalPathSnapshots.push(
              typeof next === 'function' ? next(new Set(['/vault/a/note.md'])) : next,
            )
          },
        },
        {
          awaitTabMutationQueue: async () => {
            events.push('drain-tab-mutation')
          },
          awaitPendingSerialTasks: async () => {
            events.push('drain-serial')
          },
          cancelBackgroundWorkspaceIndexing: () => events.push('cancel-index'),
          teardownKnowledgeOS: (root) => events.push(`teardown:${root}`),
          clearWorkspaceClientMemory: (options) => events.push(`clear:${options.previousRoot ?? ''}`),
          evictWorkspaceAssetIndexCache: (root) => events.push(`evict-assets:${root}`),
          forbidWorkspaceAssetScope: async (root) => {
            events.push(`forbid-scope:${root}`)
          },
          lockWorkspace: async (root) => {
            events.push(`lock:${root}`)
          },
        },
      )
      assertEqual(
        events.join('|'),
        'drain-tab-mutation|drain-serial|cancel-index|teardown:/vault/a|clear:/vault/a|evict-assets:/vault/a|forbid-scope:/vault/a|lock:/vault/a',
        'finalize order',
      )
      assertEqual(externalPathSnapshots.length, 1, 'external disk drift callback must run once')
      assertEqual(externalPathSnapshots[0]?.size ?? -1, 0, 'external disk drift must reset')
    },
  },
  {
    name: 'finalizeLeavingWorkspaceWithDeps no-ops for blank root',
    run: async () => {
      let called = false
      await finalizeLeavingWorkspaceWithDeps(
        '   ',
        {},
        {
          awaitTabMutationQueue: async () => undefined,
          awaitPendingSerialTasks: async () => undefined,
          cancelBackgroundWorkspaceIndexing: () => {
            called = true
          },
          teardownKnowledgeOS: () => {
            called = true
          },
          clearWorkspaceClientMemory: () => {
            called = true
          },
          evictWorkspaceAssetIndexCache: () => {
            called = true
          },
          forbidWorkspaceAssetScope: async () => {
            called = true
          },
          lockWorkspace: async () => {
            called = true
          },
        },
      )
      assert(!called, 'blank previous root must skip finalize')
    },
  },
  {
    name: 'vaultScopeAiConversationDocKey isolates workspaces with the same relative doc key',
    run: () => {
      const a = vaultScopeAiConversationDocKey('/Users/a-vault', 'notes/foo')
      const b = vaultScopeAiConversationDocKey('/Users/b-vault', 'notes/foo')
      assert(Boolean(a && b && a !== b), 'scoped conversation keys must differ across vaults')
      assertEqual(
        vaultScopeAiConversationDocKey('/Users/a-vault', 'notes/foo'),
        vaultScopeAiConversationDocKey('/Users/a-vault', 'notes/foo'),
        'scoped key must be stable',
      )
    },
  },
  {
    name: 'resetKnowledgeSurfaceRuntime clears sidebar snapshots',
    run: () => {
      seedKnowledgeSidebarSnapshotForTests('sidebar-notes/demo', 'notes/demo')
      assertEqual(getKnowledgeSidebarSnapshotCountForTests(), 1, 'seed snapshot')
      resetKnowledgeSurfaceRuntime()
      assertEqual(getKnowledgeSidebarSnapshotCountForTests(), 0, 'KSR reset must clear sidebar snapshots')
      resetKnowledgeSidebarRuntime()
    },
  },
]

export async function assertWorkspaceSwitchMemorySafetySuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      resetKnowledgeSidebarRuntime()
      await testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      resetKnowledgeSidebarRuntime()
    }
  }
  return { passed, failed }
}
