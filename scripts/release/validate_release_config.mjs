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
  assert(text.includes('release-build.yml'), 'release.yml must call release-build reusable workflow')
  assert(text.includes('workflow_dispatch'), 'release.yml must support manual release runs')

  const build = read('.github/workflows/release-build.yml')
  assert(build.includes('softprops/action-gh-release@v2'), 'release-build must publish GitHub Release')
  assert(build.includes('tauri:bundle:dmg'), 'release-build must build DMG')
  assert(build.includes('tauri:bundle:msi'), 'release-build must build MSI')
  assert(build.includes('tauri:bundle:deb'), 'release-build must build DEB')
  assert(!build.includes('tauri:bundle:rpm'), 'release-build must not build RPM')
  assert(build.includes('macos-14'), 'release-build must target macOS')
  assert(build.includes('windows-2022'), 'release-build must target Windows x86_64')
  assert(build.includes('windows-11-arm'), 'release-build must target Windows ARM64')
  assert(build.includes('ubuntu-22.04'), 'release-build must target Linux deb on Ubuntu 22.04')
  assert(build.includes('arch: x86_64'), 'release-build MSI matrix must include x86_64')
  assert(build.includes('arch: aarch64'), 'release-build MSI matrix must include ARM64')
  assert(!build.includes('WINDOWS_CERTIFICATE'), 'release-build must not use Windows code signing')
  assert(!build.includes('GPG_PRIVATE_KEY'), 'release-build must not use GPG deb signing')
  assert(!build.includes('.deb.asc'), 'release-build must not publish GPG signatures')
  assert(
    (build.match(/check-git-clean: "true"/g) ?? []).length >= 3,
    'release-build locale-pipeline must check committed outputs on all platform jobs',
  )
}

function testCiWorkflow() {
  const text = read('.github/workflows/ci.yml')
  assert(text.includes('npm run build'), 'ci.yml: must compile frontend')
  assert(text.includes('cargo build --manifest-path src-tauri/Cargo.toml'), 'ci.yml: must compile Tauri backend on Linux')
  assert(text.includes('locale-check:'), 'ci.yml: must run locale-check job')
  assert(text.includes('plan_release.mjs'), 'ci.yml: must use shared plan_release script')
  assert(text.includes('release-build.yml'), 'ci.yml: must auto-publish release after compile')
}

function testRootTsconfig() {
  const text = read('tsconfig.json')
  assert(
    !text.includes('scripts/test/tsconfig.json'),
    'tsconfig.json: must not reference gitignored scripts/test/tsconfig.json',
  )
  assert(
    !text.includes('scripts/tsconfig.playwright.json'),
    'tsconfig.json: must not reference Playwright tsconfig in tsc -b (scripts/test/ is not on CI)',
  )
  assert(
    text.includes('tsconfig.app.json'),
    'tsconfig.json: must reference tsconfig.app.json',
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
