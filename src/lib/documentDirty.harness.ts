import {
  dispatchDocumentCommand,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import type { DocumentRuntimeCapabilities } from '../documentRuntime/documentTypes'
import { clearTabBodies, setLiveTabBody, setTabBody } from '../app/document/tabBodiesStore'
import { isPathDirty } from './documentDirty'

type Case = {
  readonly name: string
  readonly run: () => Promise<void> | void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
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
    name: 'body-only tab cache against YAML saved baseline is not dirty',
    run: async () =>
      withRuntime(async () => {
        const path = '/vault/frontmatter.md'
        const disk = '---\ntitle: Note\n---\n\n# Body\n'
        installMockCapabilities({ [path]: disk })
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: '/vault',
          path,
          source: 'test-open-frontmatter',
        })
        setTabBody(path, '\n# Body\n')
        assert(!isPathDirty(path), 'projected body must not look unsaved against YAML baseline')
      }),
  },
  {
    name: 'tab body without saved baseline is not dirty until kernel flags it',
    run: async () =>
      withRuntime(async () => {
        const path = '/vault/restored-inactive.md'
        installMockCapabilities({})
        setTabBody(path, '# cached after restore\n')
        assert(!isPathDirty(path), 'missing saved baseline must not paint a save badge')
      }),
  },
  {
    name: 'kernel dirty flag still reports unsaved edits',
    run: async () =>
      withRuntime(async () => {
        const path = '/vault/edited.md'
        installMockCapabilities({ [path]: '# original\n' })
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: '/vault',
          path,
          source: 'test-open-edited',
        })
        await dispatchDocumentCommand({
          type: 'DOCUMENT_CONTENT_CHANGED',
          path,
          content: '# original\n\nedited\n',
          source: 'test-edit',
        })
        assert(isPathDirty(path), 'real edits must stay dirty')
      }),
  },
  {
    name: 'live overlay typing is dirty before the kernel debounce lands',
    run: async () =>
      withRuntime(async () => {
        const path = '/vault/overlay.md'
        installMockCapabilities({ [path]: '# original\n' })
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: '/vault',
          path,
          source: 'test-open-overlay',
        })
        setLiveTabBody(path, '# original\n\nlive type\n')
        assert(isPathDirty(path), 'unsynced overlay edits must count as dirty')
      }),
  },
])

export async function assertDocumentDirtySuite(): Promise<{ passed: number; failed: number }> {
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
