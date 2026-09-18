import {
  StaleWorkspaceSaveAbortedError,
  WorkspaceSaveUnlockCancelledError,
  dispatchSaveDocumentWithEncryptionRetryWithDeps,
  handleEncryptedDocumentPersistFailure,
  persistOpenDocumentWithEncryptionRetryWithDeps,
  readClosedDocumentWithEncryptionRetryWithDeps,
  resolveEncryptedSaveFailureMessage,
} from './encryptedDocumentSave'
import { shouldAbortStaleWorkspaceSave } from './workspaceEncryptionErrors'

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

const baseSaveOptions = {
  rootAtRequest: '/vault/a',
  getCurrentRootDir: () => '/vault/a',
  path: 'notes/note.md',
  content: '# body\n',
  source: 'test-save',
  allowUnlockRetry: true,
  promptWorkspacePassword: async () => ({ password: 'pw' }),
  t,
} as const

const baseHandlers = {
  path: 'notes/note.md',
  local: '# body\n',
  t,
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'shouldAbortStaleWorkspaceSave detects root mismatch',
    run: () => {
      assert(shouldAbortStaleWorkspaceSave('/vault/a', '/vault/b'), 'different roots should abort')
      assert(!shouldAbortStaleWorkspaceSave('/vault/a', '/vault/a'), 'same root should continue')
      assert(!shouldAbortStaleWorkspaceSave('', '/vault/a'), 'empty request root should not abort')
      assert(!shouldAbortStaleWorkspaceSave('/vault/a', ''), 'empty current root should not abort')
    },
  },
  {
    name: 'resolveEncryptedSaveFailureMessage maps unlock cancelled and migrating errors',
    run: () => {
      assertEqual(
        resolveEncryptedSaveFailureMessage(new WorkspaceSaveUnlockCancelledError(), t),
        'workspace.encryption.unlock.cancelled',
        'unlock cancelled',
      )
      assertEqual(
        resolveEncryptedSaveFailureMessage(new Error('WORKSPACE_MIGRATING'), t),
        'workspace.encryption.error.migrating',
        'migrating',
      )
      assertEqual(resolveEncryptedSaveFailureMessage(new StaleWorkspaceSaveAbortedError(), t), null, 'stale is silent')
    },
  },
  {
    name: 'handleEncryptedDocumentPersistFailure routes conflict and encryption errors',
    run: async () => {
      let conflictPath = ''
      let conflictLocal = ''
      let writeError = ''
      const handlers = {
        ...baseHandlers,
        onConflict: async (path: string, local: string) => {
          conflictPath = path
          conflictLocal = local
        },
        onWriteError: (message: string) => {
          writeError = message
        },
      }

      assertEqual(
        await handleEncryptedDocumentPersistFailure(new Error('FILE_CONFLICT: stale disk'), handlers),
        false,
        'conflict should return false',
      )
      assertEqual(conflictPath, 'notes/note.md', 'conflict handler should receive path')
      assertEqual(conflictLocal, '# body\n', 'conflict handler should receive local snapshot')

      assertEqual(
        await handleEncryptedDocumentPersistFailure(new StaleWorkspaceSaveAbortedError(), handlers),
        false,
        'stale save should return false without side effects',
      )
      assertEqual(writeError, '', 'stale save should not call onWriteError')

      writeError = ''
      assertEqual(
        await handleEncryptedDocumentPersistFailure(new Error('WORKSPACE_LOCKED'), handlers),
        false,
        'encryption error should return false',
      )
      assertEqual(writeError, 'workspace.encryption.error.locked', 'encryption error should surface message')

      writeError = ''
      assertEqual(
        await handleEncryptedDocumentPersistFailure(new WorkspaceSaveUnlockCancelledError(), handlers),
        false,
        'unlock cancelled should return false',
      )
      assertEqual(writeError, 'workspace.encryption.unlock.cancelled', 'unlock cancelled should surface message')

      writeError = ''
      assertEqual(
        await handleEncryptedDocumentPersistFailure(new Error('disk busy'), handlers),
        false,
        'generic error should return false',
      )
      assertEqual(writeError, 'disk busy', 'generic error should surface message')
    },
  },
  {
    name: 'persistOpenDocumentWithEncryptionRetryWithDeps returns true on successful save',
    run: async () => {
      const calls: string[] = []
      const saved = await persistOpenDocumentWithEncryptionRetryWithDeps(
        { ...baseSaveOptions, source: 'document-frontmatter-update' },
        baseHandlers,
        {
          dispatchSave: async ({ root, path, content, source }) => {
            calls.push(`${source}:${root}:${path}:${content}`)
          },
          ensureUnlocked: async () => true,
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => false,
        },
      )
      assert(saved, 'successful persist should return true')
      assertEqual(
        calls[0],
        'document-frontmatter-update:/vault/a:notes/note.md:# body\n',
        'persist should delegate save payload',
      )
    },
  },
  {
    name: 'persistOpenDocumentWithEncryptionRetryWithDeps retries after unlock and returns true',
    run: async () => {
      let saveAttempts = 0
      let unlockedRoot = ''
      const saved = await persistOpenDocumentWithEncryptionRetryWithDeps(
        { ...baseSaveOptions, source: 'knowledge-graph-link' },
        baseHandlers,
        {
          dispatchSave: async ({ root }) => {
            saveAttempts += 1
            if (saveAttempts === 1) {
              throw new Error('WORKSPACE_LOCKED')
            }
            assertEqual(root, '/vault/a', 'save must target rootAtRequest')
          },
          ensureUnlocked: async (root) => {
            unlockedRoot = root
            return true
          },
          shouldAbortStale: () => false,
          shouldRetryUnlock: (_error, allowRetry, hasPrompt) => allowRetry && hasPrompt,
        },
      )
      assert(saved, 'persist should succeed after unlock retry')
      assertEqual(saveAttempts, 2, 'persist should retry save once')
      assertEqual(unlockedRoot, '/vault/a', 'persist must unlock rootAtRequest')
    },
  },
  {
    name: 'persistOpenDocumentWithEncryptionRetryWithDeps returns false on stale save without unlock',
    run: async () => {
      let unlockCalls = 0
      let writeError = 'unset'
      const saved = await persistOpenDocumentWithEncryptionRetryWithDeps(
        {
          ...baseSaveOptions,
          rootAtRequest: '/vault/old',
          getCurrentRootDir: () => '/vault/new',
          source: 'autosave-document',
        },
        {
          ...baseHandlers,
          onWriteError: (message) => {
            writeError = message
          },
        },
        {
          dispatchSave: async () => {
            throw new Error('WORKSPACE_LOCKED')
          },
          ensureUnlocked: async () => {
            unlockCalls += 1
            return true
          },
          shouldAbortStale: shouldAbortStaleWorkspaceSave,
          shouldRetryUnlock: () => true,
        },
      )
      assert(!saved, 'stale persist should return false')
      assertEqual(unlockCalls, 0, 'stale persist must not unlock')
      assertEqual(writeError, 'unset', 'stale persist must stay silent')
    },
  },
  {
    name: 'persistOpenDocumentWithEncryptionRetryWithDeps routes conflict through handlers',
    run: async () => {
      let conflictLocal = ''
      const saved = await persistOpenDocumentWithEncryptionRetryWithDeps(
        { ...baseSaveOptions, source: 'knowledge-graph-link-remove' },
        {
          ...baseHandlers,
          onConflict: async (_path, local) => {
            conflictLocal = local
          },
        },
        {
          dispatchSave: async () => {
            throw new Error('FILE_CONFLICT: disk changed')
          },
          ensureUnlocked: async () => true,
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => false,
        },
      )
      assert(!saved, 'conflict persist should return false')
      assertEqual(conflictLocal, '# body\n', 'conflict handler should receive local content')
    },
  },
  {
    name: 'persistOpenDocumentWithEncryptionRetryWithDeps forwards forceOverwrite to save dispatch',
    run: async () => {
      let forceOverwrite: boolean | undefined
      await persistOpenDocumentWithEncryptionRetryWithDeps(
        { ...baseSaveOptions, source: 'save-conflict-force', forceOverwrite: true },
        baseHandlers,
        {
          dispatchSave: async (command) => {
            forceOverwrite = command.forceOverwrite
          },
          ensureUnlocked: async () => true,
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => false,
        },
      )
      assertEqual(forceOverwrite, true, 'forceOverwrite should pass through to dispatchSave')
    },
  },
  {
    name: 'persistOpenDocumentWithEncryptionRetryWithDeps forwards expectedModifiedSecs to save dispatch',
    run: async () => {
      let expectedModifiedSecs: number | undefined
      await persistOpenDocumentWithEncryptionRetryWithDeps(
        { ...baseSaveOptions, source: 'save-mtime', expectedModifiedSecs: 1700000000 },
        baseHandlers,
        {
          dispatchSave: async (command) => {
            expectedModifiedSecs = command.expectedModifiedSecs
          },
          ensureUnlocked: async () => true,
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => false,
        },
      )
      assertEqual(expectedModifiedSecs, 1700000000, 'expectedModifiedSecs should pass through to dispatchSave')
    },
  },
  {
    name: 'dispatchSaveDocumentWithEncryptionRetry aborts stale save before unlock',
    run: async () => {
      let unlockCalls = 0
      await dispatchSaveDocumentWithEncryptionRetryWithDeps(
        {
          rootAtRequest: '/vault/old',
          getCurrentRootDir: () => '/vault/new',
          path: 'note.md',
          content: 'body',
          source: 'test',
          allowUnlockRetry: true,
          promptWorkspacePassword: async () => {
            unlockCalls += 1
            return { password: 'pw' }
          },
          t,
        },
        {
          dispatchSave: async () => {
            throw new Error('WORKSPACE_LOCKED')
          },
          ensureUnlocked: async () => {
            unlockCalls += 1
            return true
          },
          shouldAbortStale: shouldAbortStaleWorkspaceSave,
          shouldRetryUnlock: () => true,
        },
      ).catch((error) => {
        assert(error instanceof StaleWorkspaceSaveAbortedError, 'stale save must abort')
      })
      assertEqual(unlockCalls, 0, 'stale save must not prompt unlock')
    },
  },
  {
    name: 'dispatchSaveDocumentWithEncryptionRetry unlocks rootAtRequest and retries save',
    run: async () => {
      let saveAttempts = 0
      let unlockedRoot = ''
      await dispatchSaveDocumentWithEncryptionRetryWithDeps(
        {
          rootAtRequest: '/vault/old',
          getCurrentRootDir: () => '/vault/new',
          path: 'note.md',
          content: 'body',
          source: 'test',
          allowUnlockRetry: true,
          promptWorkspacePassword: async () => ({ password: 'pw' }),
          t,
        },
        {
          dispatchSave: async ({ root }) => {
            saveAttempts += 1
            if (saveAttempts === 1) {
              throw new Error('WORKSPACE_LOCKED')
            }
            assertEqual(root, '/vault/old', 'save must target rootAtRequest')
          },
          ensureUnlocked: async (root) => {
            unlockedRoot = root
            return true
          },
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => true,
        },
      )
      assertEqual(saveAttempts, 2, 'save should succeed after unlock retry')
      assertEqual(unlockedRoot, '/vault/old', 'unlock must use rootAtRequest not current root')
    },
  },
  {
    name: 'dispatchSaveDocumentWithEncryptionRetry throws when unlock is cancelled',
    run: async () => {
      let caught: unknown
      try {
        await dispatchSaveDocumentWithEncryptionRetryWithDeps(
          {
            rootAtRequest: '/vault/a',
            getCurrentRootDir: () => '/vault/a',
            path: 'note.md',
            content: 'body',
            source: 'test',
            allowUnlockRetry: true,
            promptWorkspacePassword: async () => null,
            t,
          },
          {
            dispatchSave: async () => {
              throw new Error('WORKSPACE_LOCKED')
            },
            ensureUnlocked: async () => false,
            shouldAbortStale: () => false,
            shouldRetryUnlock: () => true,
          },
        )
      } catch (error) {
        caught = error
      }
      assert(caught instanceof WorkspaceSaveUnlockCancelledError, 'cancelled unlock should surface dedicated error')
    },
  },
  {
    name: 'readClosedDocumentWithEncryptionRetry unlocks then rereads',
    run: async () => {
      let reads = 0
      let unlocked = 0
      const content = await readClosedDocumentWithEncryptionRetryWithDeps(
        {
          rootAtRequest: '/vault/a',
          getCurrentRootDir: () => '/vault/a',
          path: 'notes/closed.md',
          allowUnlockRetry: true,
          promptWorkspacePassword: async () => ({ password: 'pw' }),
          t,
          readDocument: async () => {
            reads += 1
            if (reads === 1) throw new Error('WORKSPACE_LOCKED')
            return '# closed\n'
          },
        },
        {
          ensureUnlocked: async () => {
            unlocked += 1
            return true
          },
          shouldAbortStale: () => false,
          shouldRetryUnlock: () => true,
        },
      )
      assertEqual(content, '# closed\n', 'retry after unlock should return plaintext')
      assertEqual(reads, 2, 'read should retry once after unlock')
      assertEqual(unlocked, 1, 'unlock should run once')
    },
  },
])

export async function assertEncryptedDocumentSaveSuite(): Promise<{ passed: number; failed: number }> {
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
