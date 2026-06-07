#!/usr/bin/env node
/**
 * CI guard for GitHub Release workflow config (.github/release.yml + release workflow).
 * Run: npm run validate:release-config
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function testReleaseYml() {
  const text = read('.github/release.yml')
  assert(text.includes('changelog:'), 'release.yml: missing changelog root')
  assert(text.includes('ignore-for-release'), 'release.yml: missing ignore-for-release exclude')
  assert(text.includes('Bug Fixes'), 'release.yml: missing Bug Fixes category')
  assert(text.includes('labels:\n        - "*"') || text.includes('- "*"'), 'release.yml: missing catch-all category')

  const titles = [...text.matchAll(/title:\s+(.+)$/gm)].map((m) => m[1].trim())
  assert(titles.length >= 6, `release.yml: expected 6+ categories, got ${titles.length}`)
  assert(titles.includes('Bug Fixes'), 'release.yml: Bug Fixes title not found')
}

function testReleaseWorkflow() {
  const text = read('.github/workflows/release.yml')
  assert(text.includes('validate:app-icons'), 'release.yml: must run validate:app-icons')
  assert(text.includes('generate_release_notes: true'), 'workflow: generate_release_notes must be true')

  const publishIdx = text.indexOf('  publish:')
  assert(publishIdx >= 0, 'workflow: publish job missing')
  const publishBlock = text.slice(publishIdx)

  assert(
    publishBlock.includes('ref: ${{ env.RELEASE_REF }}'),
    'workflow: publish checkout must use RELEASE_REF',
  )

  const ghStep = publishBlock.match(/uses: softprops\/action-gh-release@v2[\s\S]*?(?=\n      - |\n  [a-z]|$)/)
  assert(ghStep, 'workflow: gh-release step missing')
  const body = ghStep[0]
  assert(body.includes("## What's Changed"), "workflow: body must include What's Changed")
  assert(body.includes('## Downloads'), 'workflow: body must include Downloads')

  const downloadsAt = body.indexOf('## Downloads')
  const changedAt = body.indexOf("## What's Changed")
  assert(changedAt > downloadsAt, "workflow: What's Changed must come after Downloads (auto-notes append after body)")
}

function testCiWorkflow() {
  const text = read('.github/workflows/ci.yml')
  assert(text.includes('npm run build'), 'ci.yml: must compile frontend')
  assert(text.includes('cargo build --manifest-path src-tauri/Cargo.toml'), 'ci.yml: must compile Tauri backend on Linux')
  assert(!text.includes('locale-and-scripts:'), 'ci.yml: validation job removed (compile-only CI)')
}

function testRootTsconfig() {
  const text = read('tsconfig.json')
  assert(
    !text.includes('scripts/test/tsconfig.json'),
    'tsconfig.json: must not reference gitignored scripts/test/tsconfig.json (use scripts/tsconfig.playwright.json)',
  )
  assert(
    text.includes('scripts/tsconfig.playwright.json'),
    'tsconfig.json: must reference scripts/tsconfig.playwright.json for Playwright types',
  )
}

function testPackagingDoc() {
  const text = read('docs/packaging-strategy.md')
  assert(text.includes('release.yml'), 'packaging-strategy: should reference .github/release.yml')
  assert(text.includes('mac-menu-icons'), 'packaging-strategy: should document mac-menu-icons')
}

const tests = [
  ['release.yml structure', testReleaseYml],
  ['release workflow publish job', testReleaseWorkflow],
  ['ci workflow guards', testCiWorkflow],
  ['root tsconfig references', testRootTsconfig],
  ['packaging-strategy doc', testPackagingDoc],
]

let passed = 0
for (const [name, fn] of tests) {
  fn()
  passed += 1
  console.log(`[validate-release-config] OK — ${name}`)
}

console.log(`[validate-release-config] ${passed}/${tests.length} checks passed`)
