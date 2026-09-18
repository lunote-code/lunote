import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  getDocumentSavedContent,
  purgeOpenDocumentPlaintext,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from './documentKernel'
import { getDocumentEventLog } from './documentEventStream'
import type { DocumentRuntimeCapabilities } from './documentTypes'

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

type WriteCall = {
  root: string
  path: string
  content: string
  expectedModifiedSecs?: number
  forceOverwrite?: boolean
}

function installMockCapabilities(writes: WriteCall[]): void {
  const capabilities: DocumentRuntimeCapabilities = {
    readDocument: async () => '',
    writeDocument: async (root, path, content, options) => {
      writes.push({
        root,
        path,
        content,
        expectedModifiedSecs: options?.expectedModifiedSecs,
        forceOverwrite: options?.forceOverwrite,
      })
    },
    setActiveDocument: () => {},
    renderContent: () => {},
    setTabs: () => {},
  }
  registerDocumentRuntimeCapabilities(capabilities)
}

async function withRuntime(run: () => Promise<void> | void): Promise<void> {
  resetDocumentRuntimeKernel()
  try {
    await run()
  } finally {
    registerDocumentRuntimeCapabilities(null)
    resetDocumentRuntimeKernel()
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'SAVE_DOCUMENT forwards expectedModifiedSecs to writeDocument',
    run: async () =>
      withRuntime(async () => {
        const writes: WriteCall[] = []
        installMockCapabilities(writes)
        await dispatchDocumentCommand({
          type: 'SAVE_DOCUMENT',
          root: '/vault',
          path: '/vault/note.md',
          content: '# saved\n',
          source: 'test-save-mtime',
          expectedModifiedSecs: 1700000000,
        })
        assertEqual(writes.length, 1, 'save should write once')
        assertEqual(writes[0]?.expectedModifiedSecs, 1700000000, 'mtime must reach writeDocument')
        assertEqual(writes[0]?.path, '/vault/note.md', 'save must target requested path')
        assertEqual(writes[0]?.content, '# saved\n', 'save must write requested content')
      }),
  },
  {
    name: 'SAVE_DOCUMENT forwards forceOverwrite together with expectedModifiedSecs',
    run: async () =>
      withRuntime(async () => {
        const writes: WriteCall[] = []
        installMockCapabilities(writes)
        await dispatchDocumentCommand({
          type: 'SAVE_DOCUMENT',
          root: '/vault',
          path: '/vault/note.md',
          content: '# forced\n',
          source: 'test-save-force',
          forceOverwrite: true,
          expectedModifiedSecs: 42,
        })
        assert(writes[0]?.forceOverwrite === true, 'forceOverwrite must reach writeDocument')
        assertEqual(writes[0]?.expectedModifiedSecs, 42, 'mtime still forwarded; capability may ignore it')
      }),
  },
  {
    name: 'SAVE_DOCUMENT_BATCH forwards per-document expectedModifiedSecs',
    run: async () =>
      withRuntime(async () => {
        const writes: WriteCall[] = []
        installMockCapabilities(writes)
        await dispatchDocumentCommand({
          type: 'SAVE_DOCUMENT_BATCH',
          root: '/vault',
          source: 'test-save-batch-mtime',
          documents: [
            { path: '/vault/a.md', content: '# a\n', expectedModifiedSecs: 11 },
            { path: '/vault/b.md', content: '# b\n' },
          ],
        })
        assertEqual(writes.length, 2, 'batch should write each document')
        assertEqual(writes[0]?.expectedModifiedSecs, 11, 'first document mtime must be forwarded')
        assertEqual(writes[1]?.expectedModifiedSecs, undefined, 'omitted mtime stays undefined')
      }),
  },
  {
    name: 'purgeOpenDocumentPlaintext drops bodies and keeps tabs',
    run: async () =>
      withRuntime(async () => {
        const rendered: string[] = []
        const capabilities: DocumentRuntimeCapabilities = {
          readDocument: async () => 'classified from disk\n',
          writeDocument: async () => {},
          setActiveDocument: () => {},
          renderContent: (content) => {
            rendered.push(content)
          },
          setTabs: () => {},
        }
        registerDocumentRuntimeCapabilities(capabilities)
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: '/vault',
          path: '/vault/secret.md',
          source: 'test-purge-open',
        })
        await dispatchDocumentCommand({
          type: 'SET_TABS',
          tabs: ['/vault/secret.md', '/vault/other.md'],
          activePath: '/vault/secret.md',
          source: 'test-purge-tabs',
        })
        await dispatchDocumentCommand({
          type: 'DOCUMENT_CONTENT_CHANGED',
          path: '/vault/secret.md',
          content: 'classified dirty\n',
          source: 'test-purge-dirty',
        })
        await Promise.resolve()
        const before = getDocumentRuntimeSnapshot()
        assertEqual(before.rootDir, '/vault', 'root before purge')
        assertEqual(before.activePath, '/vault/secret.md', 'active path before purge')
        assert(before.content.includes('classified'), 'kernel must hold plaintext before purge')
        assert(before.dirtyByPath['/vault/secret.md'] === true, 'dirty flag before purge')
        assert(getDocumentSavedContent('/vault/secret.md') === 'classified from disk\n', 'saved content before purge')
        purgeOpenDocumentPlaintext()
        const after = getDocumentRuntimeSnapshot()
        assertEqual(after.rootDir, '/vault', 'root must survive purge')
        assertEqual(after.activePath, '/vault/secret.md', 'active path must survive purge')
        assertEqual(after.openedTabs.join(','), '/vault/secret.md,/vault/other.md', 'tabs must survive purge')
        assertEqual(after.content, '', 'kernel content must drop')
        assertEqual(Object.keys(after.dirtyByPath).length, 0, 'dirty flags must drop')
        assert(getDocumentSavedContent('/vault/secret.md') === undefined, 'saved content must drop')
        assert(rendered.includes(''), 'editor render must be cleared')
        const log = getDocumentEventLog()
        assert(
          !JSON.stringify(log).includes('classified'),
          'document event log must not keep plaintext after purge',
        )
      }),
  },
])

export async function assertDocumentKernelSaveSuite(): Promise<{ passed: number; failed: number }> {
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
