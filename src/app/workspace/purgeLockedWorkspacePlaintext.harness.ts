import {
  closeVault,
  getActiveVaultSession,
  getDocumentMeta,
  openVault,
  registerDocumentMeta,
  searchKnowledgeAsync,
  upsertSearchIndexEntry,
} from '../../editor/knowledgeRuntime'
import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../../documentRuntime/documentKernel'
import type { DocumentRuntimeCapabilities } from '../../documentRuntime/documentTypes'
import { clearTabBodies, getTabBody, setTabBody } from '../document/tabBodiesStore'
import {
  clearTabEditorSessions,
  getTabEditorSession,
  setTabEditorSession,
} from '../document/tabEditorSessionStore'
import { BUFFER_TAB_PREFIX } from './constants'
import {
  getBackgroundWorkspaceIndexGenerationForTests,
  resetBackgroundWorkspaceIndexingForTests,
} from './workspaceIndexCoordinator'
import { purgeLockedWorkspacePlaintext, reloadLockedWorkspaceSession } from './purgeLockedWorkspacePlaintext'

type Case = {
  readonly name: string
  readonly run: () => Promise<void> | void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

function installMockCapabilities(reads: Array<{ root: string; path: string }> = []): void {
  const capabilities: DocumentRuntimeCapabilities = {
    readDocument: async (root, path) => {
      reads.push({ root, path })
      return '# reloaded from disk\n'
    },
    writeDocument: async () => {},
    setActiveDocument: () => {},
    renderContent: () => {},
    setTabs: () => {},
  }
  registerDocumentRuntimeCapabilities(capabilities)
}

async function withRuntime(run: () => Promise<void> | void): Promise<void> {
  resetDocumentRuntimeKernel()
  resetBackgroundWorkspaceIndexingForTests()
  closeVault()
  clearTabBodies()
  clearTabEditorSessions()
  try {
    await run()
  } finally {
    registerDocumentRuntimeCapabilities(null)
    resetDocumentRuntimeKernel()
    closeVault()
    clearTabBodies()
    clearTabEditorSessions()
    resetBackgroundWorkspaceIndexingForTests()
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'purgeLockedWorkspacePlaintext drops tab bodies, knowledge samples, and kernel content',
    run: async () =>
      withRuntime(async () => {
        installMockCapabilities()
        openVault('/vault')
        registerDocumentMeta({
          docKey: 'secret',
          absolutePath: '/vault/secret.md',
          title: 'Secret',
          frontmatter: {},
          links: [],
          embeds: [],
          blockRefs: [],
          outboundTags: [],
          indexedAt: 1,
          contentHash: 'hash',
          bodySample: 'classified knowledge sample',
        })
        upsertSearchIndexEntry('secret', '/vault/secret.md', 'Secret', [], 'classified knowledge sample')
        setTabBody('/vault/secret.md', 'classified overlay')
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: '/vault',
          path: '/vault/secret.md',
          source: 'test-lock-purge-open',
        })
        await dispatchDocumentCommand({
          type: 'SET_TABS',
          tabs: ['/vault/secret.md'],
          activePath: '/vault/secret.md',
          source: 'test-lock-purge-tabs',
        })
        const generationBefore = getBackgroundWorkspaceIndexGenerationForTests()
        purgeLockedWorkspacePlaintext({ previousRoot: '/vault' })
        const snap = getDocumentRuntimeSnapshot()
        assertEqual(snap.rootDir, '/vault', 'root must remain')
        assertEqual(snap.activePath, '/vault/secret.md', 'active path must remain')
        assertEqual(snap.openedTabs.join(','), '/vault/secret.md', 'tabs must remain')
        assertEqual(snap.content, '', 'kernel content must drop')
        assert(getTabBody('/vault/secret.md') === undefined, 'tab overlay must drop')
        assert(getDocumentMeta('secret') === undefined, 'knowledge meta must drop')
        assertEqual(getActiveVaultSession()?.rootDir, '/vault', 'vault session must remain for reload')
        const hits = await searchKnowledgeAsync('classified')
        assertEqual(hits.length, 0, 'knowledge search samples must drop')
        assert(
          getBackgroundWorkspaceIndexGenerationForTests() === generationBefore + 1,
          'background indexing must cancel',
        )
      }),
  },
  {
    name: 'reloadLockedWorkspaceSession reopens the active note and skips buffer tabs',
    run: async () =>
      withRuntime(async () => {
        const reads: Array<{ root: string; path: string }> = []
        installMockCapabilities(reads)
        await reloadLockedWorkspaceSession('/vault', '/vault/secret.md')
        assertEqual(reads.length, 1, 'active note must reopen')
        assertEqual(reads[0]?.path, '/vault/secret.md', 'reload path')
        assert(getDocumentRuntimeSnapshot().content.includes('reloaded'), 'kernel must load disk body')
        reads.length = 0
        await reloadLockedWorkspaceSession('/vault', `${BUFFER_TAB_PREFIX}scratch`)
        assertEqual(reads.length, 0, 'buffer tabs must not be opened from disk')
      }),
  },
  {
    name: 'idle lock purge then unlock reload restores disk document without overlay plaintext',
    run: async () =>
      withRuntime(async () => {
        const reads: Array<{ root: string; path: string }> = []
        installMockCapabilities(reads)
        openVault('/vault')
        setTabBody('/vault/secret.md', 'unsaved overlay plaintext')
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: '/vault',
          path: '/vault/secret.md',
          source: 'test-idle-lock-open',
        })
        await dispatchDocumentCommand({
          type: 'SET_TABS',
          tabs: ['/vault/secret.md'],
          activePath: '/vault/secret.md',
          source: 'test-idle-lock-tabs',
        })
        purgeLockedWorkspacePlaintext({ previousRoot: '/vault' })
        assert(getTabBody('/vault/secret.md') === undefined, 'idle encrypt must drop overlay plaintext')
        assertEqual(getDocumentRuntimeSnapshot().content, '', 'idle encrypt must drop kernel plaintext')
        await reloadLockedWorkspaceSession('/vault', '/vault/secret.md')
        assertEqual(reads.at(-1)?.path, '/vault/secret.md', 'unlock reload must re-read the active note')
        assert(getDocumentRuntimeSnapshot().content.includes('reloaded'), 'decrypt reload must restore disk body')
      }),
  },
  {
    name: 'idle lock purge keeps caret sessions so unlock can restore the viewport',
    run: async () =>
      withRuntime(async () => {
        installMockCapabilities()
        setTabEditorSession('/vault/secret.md', {
          visual: { pmAnchor: 18, pmHead: 22, scrollRatio: 0.55 },
        })
        purgeLockedWorkspacePlaintext({ previousRoot: '/vault' })
        const session = getTabEditorSession('/vault/secret.md')
        assert(session?.visual?.pmAnchor === 18, 'caret must survive plaintext purge')
        assert(session?.visual?.pmHead === 22, 'selection head must survive plaintext purge')
        assert(session?.visual?.scrollRatio === 0.55, 'scroll must survive plaintext purge')
      }),
  },
])

export async function assertPurgeLockedWorkspacePlaintextSuite(): Promise<{ passed: number; failed: number }> {
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
