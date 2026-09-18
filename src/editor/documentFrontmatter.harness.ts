import {
  joinMarkdownWithFrontmatter,
  serializeFrontmatter,
  splitDocumentMarkdown,
} from './documentFrontmatter'
import {
  bodyOffsetToSourceOffset,
  bodyScrollRatioToSourceScrollRatio,
  clampDocumentOffset,
  computeLeadingFrontmatterPrefixLength,
  sourceOffsetToBodyOffset,
  sourceScrollRatioToBodyScrollRatio,
  sourceSelectionToBodySelection,
  splitFullSourceMarkdown,
} from './documentFrontmatterOffsets'
import {
  attachDocumentFrontmatter,
  clearDocumentFrontmatter,
  documentFrontmatterPathsEqual,
  getDocumentFrontmatterFields,
  getDocumentFrontmatterHadLeadingBlock,
  getDocumentFrontmatterRevision,
  hasDocumentFrontmatterCache,
  migrateDocumentFrontmatterPath,
  setDocumentFrontmatterFields,
  subscribeDocumentFrontmatter,
  syncDocumentFrontmatterFromMarkdown,
} from './documentFrontmatterStore'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

function assertNear(actual: number | undefined, expected: number, message: string, epsilon = 1e-9): void {
  if (actual == null || Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'serializeFrontmatter handles scalars arrays and objects',
    run: () => {
      const yaml = serializeFrontmatter({
        title: 'plain',
        quoted: 'needs: quotes',
        tags: ['a', 'b'],
        emptyList: [],
        meta: { nested: true },
        skip: null,
      })
      assert(yaml.includes('title: plain'), 'plain scalar')
      assert(yaml.includes('quoted: "needs: quotes"'), 'quoted scalar')
      assert(yaml.includes('tags:') && yaml.includes('- a'), 'array items')
      assert(yaml.includes('emptyList:'), 'empty array key')
      assert(yaml.includes('meta: {"nested":true}'), 'object value')
      assert(!yaml.includes('skip:'), 'null skipped')
    },
  },
  {
    name: 'joinMarkdownWithFrontmatter respects hadLeadingBlock',
    run: () => {
      assertEqual(joinMarkdownWithFrontmatter('# Body', {}, false), '# Body', 'no block no fields')
      assertEqual(joinMarkdownWithFrontmatter('# Body', {}, true), '# Body', 'had block but empty fields')
      const joined = joinMarkdownWithFrontmatter('# Body', { title: 'T' }, false)
      assert(joined.startsWith('---\n') && joined.includes('title: T') && joined.endsWith('# Body'), 'join yaml')
    },
  },
  {
    name: 'splitDocumentMarkdown detects leading yaml block',
    run: () => {
      const split = splitDocumentMarkdown('---\ntitle: x\n---\n# Body\n')
      assert(split.hadLeadingBlock, 'leading block detected')
      assertEqual(split.frontmatter.title, 'x', 'parsed title')
      assertEqual(split.body.trim(), '# Body', 'body extracted')
      const plain = splitDocumentMarkdown('# Only body')
      assert(!plain.hadLeadingBlock, 'no leading block')
    },
  },
  {
    name: 'frontmatter offsets map body and source coordinates',
    run: () => {
      const full = '---\ntitle: x\n---\n# Body\n'
      const prefixLen = computeLeadingFrontmatterPrefixLength(full)
      assert(prefixLen > 0, 'prefix length')
      assertEqual(computeLeadingFrontmatterPrefixLength('# plain'), 0, 'no prefix')
      assertEqual(clampDocumentOffset(Number.NaN, 10), 0, 'non-finite offset')
      assertEqual(clampDocumentOffset(5, 0), 0, 'zero max length')
      const { body, frontmatterPrefixLength } = splitFullSourceMarkdown(full)
      assertEqual(frontmatterPrefixLength, prefixLen, 'split full source')
      assertEqual(bodyOffsetToSourceOffset(2, prefixLen, full.length), prefixLen + 2, 'body to source')
      assertEqual(sourceOffsetToBodyOffset(1, prefixLen, body.length), 0, 'source in yaml maps to 0')
      assertEqual(sourceOffsetToBodyOffset(prefixLen + 2, prefixLen, body.length), 2, 'source in body')
      const sel = sourceSelectionToBodySelection(prefixLen + 1, prefixLen + 3, prefixLen, body.length)
      assertEqual(sel.bodyAnchor, 1, 'selection anchor')
      assertEqual(sel.bodyHead, 3, 'selection head')
    },
  },
  {
    name: 'scroll ratio helpers weight yaml prefix share',
    run: () => {
      const sourceLen = 100
      const prefixLen = 20
      assertNear(bodyScrollRatioToSourceScrollRatio(0.5, prefixLen, sourceLen), 0.6, 'body to source scroll')
      assertEqual(sourceScrollRatioToBodyScrollRatio(0.1, prefixLen, sourceLen), 0, 'source in prefix')
      assertNear(sourceScrollRatioToBodyScrollRatio(0.6, prefixLen, sourceLen), 0.5, 'source to body scroll')
      assertEqual(bodyScrollRatioToSourceScrollRatio(undefined, prefixLen, sourceLen), undefined, 'undefined ratio')
    },
  },
  {
    name: 'frontmatter store sync attach migrate and subscribe',
    run: () => {
      const path = '/vault/frontmatter-note.md'
      try {
        assert(!hasDocumentFrontmatterCache(path), 'starts uncached')
        syncDocumentFrontmatterFromMarkdown(path, '---\ntags:\n  - a\n---\n# Title\n')
        assert(hasDocumentFrontmatterCache(path), 'cached after sync')
        assert(JSON.stringify(getDocumentFrontmatterFields(path)?.tags) === JSON.stringify(['a']), 'synced tags')
        assert(getDocumentFrontmatterHadLeadingBlock(path), 'had leading block')

        const revision = getDocumentFrontmatterRevision()
        let notified = 0
        const unsubscribe = subscribeDocumentFrontmatter(() => {
          notified += 1
        })
        setDocumentFrontmatterFields(path, { title: 'Renamed' }, { hadLeadingBlock: true })
        unsubscribe()
        assert(getDocumentFrontmatterRevision() > revision, 'revision bumped')
        assert(notified >= 1, 'subscriber notified')

        const attached = attachDocumentFrontmatter(path, '# Title\n')
        assert(attached.startsWith('---\n') && attached.includes('title: Renamed'), 'attach merges yaml')

        migrateDocumentFrontmatterPath(path, '/vault/renamed-note.md')
        assert(!hasDocumentFrontmatterCache(path), 'old path cleared')
        assert(hasDocumentFrontmatterCache('/vault/renamed-note.md'), 'migrated path cached')

        clearDocumentFrontmatter('/vault/renamed-note.md')
        assert(!hasDocumentFrontmatterCache('/vault/renamed-note.md'), 'cleared cache')
        assert(documentFrontmatterPathsEqual('a\\b.md', 'a/b.md'), 'path equality')
        assertEqual(attachDocumentFrontmatter('scratch', '# Body'), '# Body', 'scratch skipped')

        // Windows drive paths compare case-insensitively via pathCompareKey.
        const winPath = 'C:/Vault/Note.md'
        syncDocumentFrontmatterFromMarkdown(winPath, '---\ntitle: Win\n---\n# Body\n')
        assert(hasDocumentFrontmatterCache('c:/vault/note.md'), 'case-insensitive cache hit')
        const winAttached = attachDocumentFrontmatter('c:/Vault/Note.md', '# Body\n')
        assert(winAttached.includes('title: Win'), 'attach via alternate case path')
        clearDocumentFrontmatter('c:/vault/NOTE.md')
        assert(!hasDocumentFrontmatterCache(winPath), 'cleared via alternate case')
      } finally {
        clearDocumentFrontmatter(path)
        clearDocumentFrontmatter('/vault/renamed-note.md')
        clearDocumentFrontmatter('C:/Vault/Note.md')
      }
    },
  },
])

export async function assertDocumentFrontmatterSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[documentFrontmatter] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
