import {
  buildWorkspaceSearchFields,
  extractMarkdownHeadingTexts,
} from './workspaceSearchText'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

export function runWorkspaceSearchTextHarness(): void {
  const markdown = '## 推广网站\n\n- https://example.com\n'
  assertEqual(
    JSON.stringify(extractMarkdownHeadingTexts(markdown)),
    JSON.stringify(['推广网站']),
    'extract H2 heading text',
  )

  const fields = buildWorkspaceSearchFields({
    fileLabel: 'promo-sites.md',
    meta: {
      docKey: 'notes/promo-sites',
      title: 'promo-sites',
      frontmatter: {},
      bodySample: markdown,
    },
  })
  assertEqual(fields.displayTitle, 'promo-sites', 'display title falls back to doc title')
  assert(fields.matchText.includes('推广网站'), 'match text includes markdown heading')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWorkspaceSearchTextHarness()
  console.log('ok workspace search text harness')
}
