import {
  runWorkspaceSearch,
  scoreWorkspaceMetadataMatch,
  type WorkspaceSearchIndexEntry,
} from './workspaceSearch'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const PROMO_ENTRY: WorkspaceSearchIndexEntry = {
  path: '/vault/notes/promo-sites.md',
  title: 'promo-sites.md',
  displayTitle: '推广网站',
  matchText: '推广网站',
  sublabel: 'notes',
  relativePath: 'notes/promo-sites.md',
}

export function runWorkspaceGlobalSearchHarness(): void {
  assert(
    scoreWorkspaceMetadataMatch('推广', PROMO_ENTRY) > 0,
    'partial CJK query must match display title / heading text',
  )
  assert(
    scoreWorkspaceMetadataMatch('zzznomatch', PROMO_ENTRY) === 0,
    'unrelated query must not match promo heading entry',
  )

  const filenameOnly: WorkspaceSearchIndexEntry = {
    path: '/vault/notes/other.md',
    title: 'other.md',
    sublabel: 'notes',
    relativePath: 'notes/other.md',
  }
  assertEqual(
    scoreWorkspaceMetadataMatch('推广', filenameOnly),
    0,
    'filename-only entry without display title',
  )
}

async function runWorkspaceSearchHarness(): Promise<void> {
  const hits = await runWorkspaceSearch('/vault', '推广', [PROMO_ENTRY], 10)
  assertEqual(hits.length, 1, 'metadata search hit count')
  assertEqual(hits[0]?.title, '推广网站', 'metadata search result title')
  assertEqual(hits[0]?.path, PROMO_ENTRY.path, 'metadata search result path')
}

export async function runWorkspaceGlobalSearchAsyncHarness(): Promise<void> {
  await runWorkspaceSearchHarness()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWorkspaceGlobalSearchHarness()
  await runWorkspaceGlobalSearchAsyncHarness()
  console.log('ok workspace global search harness')
}
