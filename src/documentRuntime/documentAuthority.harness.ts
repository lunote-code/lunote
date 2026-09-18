import { clearTabBodies, setTabBody } from './tabBodiesStore'
import {
  getDocumentAuthorityProjection,
  resolveDocumentBody,
  resolveLatestDocumentBody,
} from './documentAuthority'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'resolveDocumentBody reads inactive tabs from tabBodiesStore only',
    run: () => {
      setTabBody('/vault/b.md', 'tab cache body')
      const body = resolveDocumentBody('/vault/b.md')
      assert(body === 'tab cache body', 'inactive tab body must come from tabBodiesStore')
    },
  },
  {
    name: 'resolveDocumentBody prefers tabBodiesStore over kernel runtime for active path',
    run: () => {
      setTabBody('/vault/a.md', 'tab live body')
      const body = resolveDocumentBody('/vault/a.md', {
        projection: {
          runtime: {
            rootDir: '/vault',
            activePath: '/vault/a.md',
            content: 'kernel stale',
            openedTabs: ['/vault/a.md'],
            dirtyByPath: {},
            updatedAt: 0,
          },
          derivedTabBodies: {},
        },
      })
      assert(body === 'tab live body', 'active document body must prefer tabBodiesStore when present')
    },
  },
  {
    name: 'resolveDocumentBody falls back to kernel runtime when tab cache is missing',
    run: () => {
      const body = resolveDocumentBody('/vault/a.md', {
        projection: {
          runtime: {
            rootDir: '/vault',
            activePath: '/vault/a.md',
            content: 'kernel body',
            openedTabs: ['/vault/a.md'],
            dirtyByPath: {},
            updatedAt: 0,
          },
          derivedTabBodies: {},
        },
      })
      assert(body === 'kernel body', 'active document body must fall back to kernel runtime')
    },
  },
  {
    name: 'resolveLatestDocumentBody matches resolveDocumentBody',
    run: () => {
      setTabBody('/vault/c.md', 'tab live body')
      const projection = {
        runtime: {
          rootDir: '/vault',
          activePath: '/vault/c.md',
          content: 'kernel stale',
          openedTabs: ['/vault/c.md'],
          dirtyByPath: {},
          updatedAt: 0,
        },
        derivedTabBodies: { '/vault/c.md': 'kernel stale' },
      }
      assert(
        resolveLatestDocumentBody('/vault/c.md', { projection }) === 'tab live body',
        'latest body must prefer tabBodiesStore for live comparisons',
      )
      assert(
        resolveDocumentBody('/vault/c.md', { projection }) ===
          resolveLatestDocumentBody('/vault/c.md', { projection }),
        'resolveLatestDocumentBody must stay aligned with resolveDocumentBody',
      )
    },
  },
  {
    name: 'document authority projection exposes kernel + tab body caches',
    run: () => {
      const projection = getDocumentAuthorityProjection()
      assert(typeof projection.runtime.content === 'string', 'projection must include kernel runtime')
      assert(typeof projection.derivedTabBodies === 'object', 'projection must include tab body cache snapshot')
    },
  },
]

export async function assertDocumentAuthoritySuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    try {
      clearTabBodies()
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}:`, error)
    } finally {
      clearTabBodies()
    }
  }
  return { passed, failed }
}
