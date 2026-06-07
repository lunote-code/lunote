import { filterThemeCssForExport, normalizeRawExportCss } from './exportThemeCssFilter'
import { sanitizeExportFontCss } from './exportFontSanitize'

type Case = {
  name: string
  run: () => void
}

function assertIncludes(haystack: string, needle: string, message: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${message}: expected to include ${JSON.stringify(needle)}`)
  }
}

function assertExcludes(haystack: string, needle: string, message: string): void {
  if (haystack.includes(needle)) {
    throw new Error(`${message}: expected to exclude ${JSON.stringify(needle)}`)
  }
}

const CASES: Case[] = [
  {
    name: 'keeps :root variable overrides',
    run: () => {
      const css = ':root { --surface-editor: #111; }'
      const out = filterThemeCssForExport(css)
      assertIncludes(out, '--surface-editor', 'root vars')
    },
  },
  {
    name: 'strips sidebar workspace rules',
    run: () => {
      const css = '.sidebar { color: red; } .markdown-body { color: blue; }'
      const out = filterThemeCssForExport(css)
      assertExcludes(out, '.sidebar', 'sidebar')
      assertIncludes(out, '.markdown-body', 'markdown body')
    },
  },
  {
    name: 'preserves @media blocks with allowed inner rules',
    run: () => {
      const css = '@media print { .markdown-body { font-size: 12px; } .app-shell { display: none; } }'
      const out = filterThemeCssForExport(css)
      assertIncludes(out, '@media print', 'media query')
      assertIncludes(out, 'font-size: 12px', 'inner rule')
      assertExcludes(out, '.app-shell', 'blocked in media')
    },
  },
  {
    name: 'normalizeRawExportCss strips comments',
    run: () => {
      const out = normalizeRawExportCss('/* note */ body { margin: 0; }')
      assertExcludes(out, 'note', 'comment stripped')
      assertIncludes(out, 'margin: 0', 'rule kept')
    },
  },
  {
    name: 'sanitizeExportFontCss replaces SF Pro Text',
    run: () => {
      const out = sanitizeExportFontCss('.markdown-body { font-family: "SF Pro Text", sans-serif; }')
      assertExcludes(out, 'SF Pro Text', 'sf pro removed')
      assertIncludes(out, '-apple-system', 'system fallback')
    },
  },
  {
    name: 'sanitizeExportFontCss replaces SFNS internal names',
    run: () => {
      const out = sanitizeExportFontCss('body { font-family: .SFNS-Regular_wdth_opsz110000, serif; }')
      assertExcludes(out, '.SFNS-Regular', 'sfns removed')
      assertIncludes(out, '-apple-system', 'system fallback')
    },
  },
]

export function assertExportThemeCssFilterSuite(): { passed: number; failed: number } {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.error(`FAIL ${testCase.name}: ${message}`)
    }
  }
  return { passed, failed }
}
