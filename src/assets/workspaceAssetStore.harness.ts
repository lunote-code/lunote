import {
  evictAllWorkspaceAssetIndexCachesExcept,
  evictWorkspaceAssetIndexCache,
  getWorkspaceAssetIndexCacheSizeForTests,
  resetWorkspaceAssetStoreForTests,
  seedWorkspaceAssetIndexCacheForTests,
} from './workspaceAssetStore'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = [
  {
    name: 'evictWorkspaceAssetIndexCache removes a seeded workspace cache entry',
    run: () => {
      seedWorkspaceAssetIndexCacheForTests('/Users/a')
      seedWorkspaceAssetIndexCacheForTests('/Users/b')
      assertEqual(getWorkspaceAssetIndexCacheSizeForTests(), 2, 'seed two caches')
      evictWorkspaceAssetIndexCache('/Users/a')
      assertEqual(getWorkspaceAssetIndexCacheSizeForTests(), 1, 'one cache remains')
    },
  },
  {
    name: 'evictAllWorkspaceAssetIndexCachesExcept keeps only the active workspace cache',
    run: () => {
      seedWorkspaceAssetIndexCacheForTests('/Users/a')
      seedWorkspaceAssetIndexCacheForTests('/Users/b')
      evictAllWorkspaceAssetIndexCachesExcept('/Users/b')
      assertEqual(getWorkspaceAssetIndexCacheSizeForTests(), 1, 'keeper cache remains')
    },
  },
]

export function assertWorkspaceAssetStoreSuite(): { passed: number; failed: number } {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      resetWorkspaceAssetStoreForTests()
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      resetWorkspaceAssetStoreForTests()
    }
  }
  return { passed, failed }
}
