import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../../documentRuntime/documentKernel'
import { editorSurfaceForDocumentPath } from '../../documentRuntime/documentBodyProjection'
import type { DocumentRuntimeCapabilities } from '../../documentRuntime/documentTypes'
import {
  clearTabBodies,
  getTabBody,
  installTabBodiesKernelSync,
  MAX_TAB_BODY_CACHE_ENTRIES,
  peekTabBody,
  projectTabBodyFromKernel,
  setLiveTabBody,
  setTabBody,
  getTabBodyCacheSnapshot,
} from './tabBodiesStore'

type Case = {
  readonly name: string
  readonly run: () => Promise<void> | void
}

function assert(condition: unknown, message: string): void {
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
    projectOpenDocumentBody: projectTabBodyFromKernel,
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
    name: 'tab body eviction keeps dirty inactive drafts in memory',
    run: async () => withRuntime(async () => {
      const dirtyPath = '/vault/dirty.md'
      installMockCapabilities({
        [dirtyPath]: '# dirty disk\n',
      })
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: '/vault',
        path: dirtyPath,
        source: 'test-open-dirty',
      })
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path: dirtyPath,
        content: '# dirty live\n',
        source: 'test-dirty-live',
      })
      setTabBody(dirtyPath, '# dirty live\n')

      for (let index = 0; index < MAX_TAB_BODY_CACHE_ENTRIES; index += 1) {
        setTabBody(`/vault/clean-${index}.md`, `# clean ${index}\n`)
      }

      assert(
        getTabBody(dirtyPath) === '# dirty live\n',
        'dirty tab body should not be evicted while unsaved',
      )
      assert(
        getTabBody('/vault/clean-0.md') === undefined,
        'oldest clean tab body should be evicted first',
      )
    }),
  },
  {
    name: 'peekTabBody does not refresh LRU order',
    run: () => {
      clearTabBodies()
      try {
        for (let index = 0; index < MAX_TAB_BODY_CACHE_ENTRIES; index += 1) {
          setTabBody(`/vault/peek-${index}.md`, `# peek ${index}\n`)
        }
        assert(peekTabBody('/vault/peek-0.md') === '# peek 0\n', 'peek must return the oldest body')
        setTabBody('/vault/peek-extra.md', '# extra\n')
        assert(
          getTabBody('/vault/peek-0.md') === undefined,
          'peek must not protect the oldest clean body from eviction',
        )
      } finally {
        clearTabBodies()
      }
    },
  },
  {
    name: 'DocumentOpened sync stores editor body only in tabBodiesStore',
    run: async () =>
      withRuntime(async () => {
        const path = '/vault/frontmatter.md'
        const disk = '---\ntitle: Note\n---\n\n# Body\n'
        const expectedBody = editorSurfaceForDocumentPath(path, disk)
        installMockCapabilities({ [path]: disk })
        const unsubscribe = installTabBodiesKernelSync()
        try {
          await dispatchDocumentCommand({
            type: 'OPEN_DOCUMENT',
            root: '/vault',
            path,
            source: 'test-open-frontmatter',
          })
          assert(getTabBody(path) === expectedBody, 'tab body must exclude YAML frontmatter')
          assert(
            getDocumentRuntimeSnapshot().content === expectedBody,
            'kernel content must exclude YAML frontmatter',
          )
        } finally {
          unsubscribe()
        }
      }),
  },
  {
    name: 'live overlay wins over cached body until kernel projection matches',
    run: () => {
      clearTabBodies()
      try {
        const path = '/vault/live.md'
        setTabBody(path, '# cached\n')
        setLiveTabBody(path, '# typed\n')
        assert(peekTabBody(path) === '# typed\n', 'peek must prefer live overlay')
        assert(getTabBody(path) === '# typed\n', 'get must prefer live overlay')
        assert(
          getTabBodyCacheSnapshot()[path] === '# typed\n',
          'snapshot must overlay live body',
        )
        projectTabBodyFromKernel(path, '# typed\n')
        assert(getTabBody(path) === '# typed\n', 'matching kernel projection must keep the body')
        setLiveTabBody(path, '# still typing\n')
        projectTabBodyFromKernel(path, '# typed\n')
        assert(
          getTabBody(path) === '# still typing\n',
          'mismatched kernel projection must not clear a newer overlay',
        )
      } finally {
        clearTabBodies()
      }
    },
  },
  {
    name: 'OPEN_SCRATCH_TAB projects body same tick via DocumentOpened',
    run: async () =>
      withRuntime(async () => {
        installMockCapabilities({})
        const id = 'buffer:scratch-1'
        await dispatchDocumentCommand({
          type: 'OPEN_SCRATCH_TAB',
          id,
          content: '# scratch\n',
          source: 'test-open-scratch',
        })
        assert(getTabBody(id) === '# scratch\n', 'scratch tab body must project without waiting for events')
        assert(
          getDocumentRuntimeSnapshot().activePath === id,
          'scratch tab must become active',
        )
      }),
  },
])

export async function assertTabBodiesStoreSuite(): Promise<{ passed: number; failed: number }> {
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
