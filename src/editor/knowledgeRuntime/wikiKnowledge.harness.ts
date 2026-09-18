import {
  canonicalDocKeyForGraph,
  canonicalizeWikiLinkText,
  canonicalizeWikiSegment,
  normalizeWikiPath,
} from './wikiCanonical'
import {
  docKeyFromWikiTarget,
  extractAliases,
  extractTags,
  extractTitle,
  normalizeWikiLinkBlockRefEscapesInMarkdown,
  originalToNormalizedAfterWikiBlockRefUnescape,
  parseBlockRefsInText,
  parseDocumentKnowledge,
  parseFrontmatter,
  parseInlineTags,
  parseWikiLinksInText,
  unescapeWikiLinksInMarkdown,
  wikiLinkInnerTargetText,
} from './wikiLinkParser'

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

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'normalizeWikiPath decodes uri and strips md suffix',
    run: () => {
      assertEqual(normalizeWikiPath('  Notes/My%20Doc.md  '), 'Notes/My Doc', 'uri + trim + md')
      assertEqual(normalizeWikiPath('\\vault\\note'), 'vault/note', 'backslashes')
      assertEqual(normalizeWikiPath('/leading/slash.md'), 'leading/slash', 'leading slash')
      assertEqual(normalizeWikiPath(''), '', 'empty')
    },
  },
  {
    name: 'canonicalizeWikiSegment folds spaces and escapes',
    run: () => {
      assertEqual(canonicalizeWikiSegment('Hello  World'), 'hello-world', 'spaces')
      assertEqual(canonicalizeWikiSegment('\\*bold\\*'), '*bold*', 'markdown escapes keep inner chars')
    },
  },
  {
    name: 'canonicalizeWikiLinkText normalizes nested paths',
    run: () => {
      assertEqual(canonicalizeWikiLinkText('Folder/My Note.md'), 'folder/my-note', 'nested path')
      assertEqual(canonicalDocKeyForGraph('Folder/My Note.md'), 'folder/my-note', 'graph key')
    },
  },
  {
    name: 'parseFrontmatter handles kv, inline arrays, and list items',
    run: () => {
      const doc = `---
title: Hello
tags: [a, b]
aliases:
empty:
  - one
  - two
# comment
---\n\nBody`
      const { frontmatter, body } = parseFrontmatter(doc)
      assertEqual(frontmatter.title, 'Hello', 'title scalar')
      assert(JSON.stringify(frontmatter.tags) === JSON.stringify(['a', 'b']), 'inline array')
      assert(JSON.stringify(frontmatter.aliases) === JSON.stringify([]), 'empty key becomes array')
      assert(JSON.stringify(frontmatter.empty) === JSON.stringify(['one', 'two']), 'list items')
      assertEqual(body.trim(), 'Body', 'body after frontmatter')
    },
  },
  {
    name: 'parseFrontmatter returns original markdown when no block',
    run: () => {
      const input = '# No frontmatter'
      const { frontmatter, body } = parseFrontmatter(input)
      assertEqual(Object.keys(frontmatter).length, 0, 'empty frontmatter')
      assertEqual(body, input, 'unchanged body')
    },
  },
  {
    name: 'extractTitle tags and aliases read frontmatter shapes',
    run: () => {
      assertEqual(extractTitle('notes/my-note.md', { title: '  Custom  ' }), 'Custom', 'title field')
      assertEqual(extractTitle('notes/my-note.md', {}), 'my-note', 'fallback from path')
      assert(JSON.stringify(extractTags({ tags: ['a', 'b'] })) === JSON.stringify(['a', 'b']), 'tag array')
      assert(JSON.stringify(extractTags({ tags: 'a b' })) === JSON.stringify(['a', 'b']), 'tag string')
      assertEqual(extractTags({}).length, 0, 'missing tags')
      assert(JSON.stringify(extractAliases({ aliases: ['x'] })) === JSON.stringify(['x']), 'alias array')
      assert(JSON.stringify(extractAliases({ aliases: 'solo' })) === JSON.stringify(['solo']), 'alias string')
      assertEqual(extractAliases({}).length, 0, 'missing aliases')
    },
  },
  {
    name: 'wikiLinkInnerTargetText and docKeyFromWikiTarget parse tokens',
    run: () => {
      assertEqual(wikiLinkInnerTargetText('[[Folder/Note]]'), 'Folder/Note', 'bracket token')
      assertEqual(wikiLinkInnerTargetText('plain-name', 'fallback'), 'plain-name', 'plain target')
      assertEqual(wikiLinkInnerTargetText('', 'fallback'), 'fallback', 'empty uses fallback')
      assertEqual(docKeyFromWikiTarget('Folder/My Note'), 'folder/my-note', 'doc key canonical')
    },
  },
  {
    name: 'parseWikiLinksInText covers link embed heading block alias',
    run: () => {
      const text = 'See [[Note#Heading^block-id|Alias]] and ![[Embed.md]]'
      const { links, embeds } = parseWikiLinksInText(text)
      assertEqual(links.length, 1, 'one link')
      assertEqual(embeds.length, 1, 'one embed')
      assertEqual(links[0]?.target.heading, 'Heading', 'heading')
      assertEqual(links[0]?.target.blockId, 'block-id', 'block id')
      assertEqual(links[0]?.target.alias, 'Alias', 'alias')
      assertEqual(embeds[0]?.kind, 'embed', 'embed kind')
    },
  },
  {
    name: 'parseBlockRefsInText and parseInlineTags collect references',
    run: () => {
      const refs = parseBlockRefsInText('Line one ^abc-1\nLine two ^def')
      assertEqual(refs.length, 2, 'two block refs')
      assertEqual(refs[0]?.blockId, 'abc-1', 'first block id')
      assert(JSON.stringify(parseInlineTags('Tags #one and #two/sub')) === JSON.stringify(['one', 'two/sub']), 'inline tags')
    },
  },
  {
    name: 'wiki escape helpers remap markdown offsets',
    run: () => {
      const escaped = 'See \\[\\[Note\\]\\]'
      assertEqual(unescapeWikiLinksInMarkdown(escaped), 'See [[Note]]', 'unescape wiki link brackets')
      const normalized = normalizeWikiLinkBlockRefEscapesInMarkdown('[[Note\\^block]]')
      assertEqual(normalized, '[[Note^block]]', 'normalize block ref escape')
      assertEqual(originalToNormalizedAfterWikiBlockRefUnescape('[[Note\\^block]]', 8), 7, 'offset remap')
      assertEqual(originalToNormalizedAfterWikiBlockRefUnescape('plain', -1), 0, 'non-finite clamp')
    },
  },
  {
    name: 'parseDocumentKnowledge aggregates frontmatter links and tags',
    run: () => {
      const doc = `---
title: Doc
tags: [graph]
---
# Title
Link [[Target]] embed ![[Image.png]] ref ^block-a #inline`
      const parsed = parseDocumentKnowledge(doc)
      assertEqual(parsed.frontmatter.title, 'Doc', 'frontmatter title')
      assertEqual(parsed.links.length, 1, 'one wiki link')
      assertEqual(parsed.embeds.length, 1, 'one embed')
      assertEqual(parsed.blockRefs[0]?.blockId, 'block-a', 'block ref')
      assert(parsed.inlineTags.includes('inline'), 'inline tag')
    },
  },
])

export async function assertWikiKnowledgeSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[wikiKnowledge] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
