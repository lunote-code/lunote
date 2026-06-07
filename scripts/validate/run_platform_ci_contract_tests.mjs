/**
 * Platform / CI contract — lean guards for regressions that already broke CI.
 * Playwright E2E gaps (tray, global shortcut, native dialog, pdf chrome, reveal_in_explorer)
 * are browser-only; not covered here.
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

function testPlaywrightScopeAndModKey() {
  const cfg = read('playwright.config.ts')
  assert(cfg.includes("command: 'npm run dev'"), 'playwright must use Vite dev server, not Tauri')
  assert(cfg.includes('chromium'), 'playwright must run Chromium only')

  const helpers = read('scripts/lib/playwright-helpers.ts')
  assert(
    helpers.includes("process.platform === 'darwin' ? 'Meta' : 'Control'"),
    'modKey must map Meta on macOS and Control elsewhere (Linux CI)',
  )
}

function testCiBuildJob() {
  const ci = read('.github/workflows/ci.yml')
  assert(ci.includes('build:'), 'ci.yml must define a build job')
  assert(ci.includes('npm run build'), 'ci.yml build job must compile frontend')
  assert(ci.includes('cargo build --manifest-path src-tauri/Cargo.toml'), 'ci.yml build job must compile Tauri backend')
  assert(!ci.includes('validate:git-publish-paths'), 'ci.yml must not run publish-path validation (local only)')
}

function testMacMenuBootPipeline() {
  const gen = read('scripts/build/generate_mac_menu_boot.mjs')
  assert(
    gen.includes("CROSSPLATNOTE_FORCE_DESKTOP_PLATFORM = 'mac'"),
    'mac-menu-boot generator must force macOS on Linux CI hosts',
  )
  assert(gen.includes('applyMacBootAcceleratorPatches'), 'mac-menu-boot generator must patch mac accelerators')

  const action = read('.github/actions/locale-pipeline/action.yml')
  assert(action.includes('mac-menu-boot.json'), 'locale-pipeline must track mac-menu-boot.json')

  const boot = JSON.parse(read('src-tauri/resources/mac-menu-boot.json'))
  const findAccel = (nodes, actionId) => {
    for (const node of nodes) {
      if ((node.kind === 'item' || node.kind === 'check') && node.action === actionId) {
        return node.tauriAccelerator
      }
      if (node.kind === 'submenu') {
        const nested = findAccel(node.children ?? [], actionId)
        if (nested !== undefined) return nested
      }
    }
    return undefined
  }
  assert(
    findAccel(boot.bar, 'view-fullscreen') === 'CmdOrCtrl+Ctrl+KeyF',
    'mac-menu-boot.json must ship macOS accelerators (not Linux/Win defaults)',
  )
}

function testContractTestsUsePublishedPathsOnly() {
  const src = read('scripts/validate/run_platform_ci_contract_tests.mjs')
  for (const [, relPath] of src.matchAll(/read\('([^']+)'\)/g)) {
    assert(!relPath.startsWith('scripts/test/'), `must not read gitignored path: ${relPath}`)
  }
}

function testWorkspaceWatchNormalizesSeparators() {
  const source = read('src-tauri/src/core/workspace_watch.rs')
  assert(source.includes("path.replace('\\\\', \"/\")"), 'workspace_watch must normalize path separators')
}

function testAppHideShowCrossPlatform() {
  const source = read('src-tauri/src/app_menu.rs')
  assert(source.includes('fn hide_application'), 'app-hide must use hide_application helper')
  assert(source.includes('fn show_all_application'), 'app-show-all must use show_all_application helper')
  assert(source.includes('hide_application(app)'), 'app-hide handler must call hide_application')
  assert(source.includes('show_all_application(app)'), 'app-show-all handler must call show_all_application')
}

const tests = [
  ['playwright scope and modKey', testPlaywrightScopeAndModKey],
  ['ci build job', testCiBuildJob],
  ['mac-menu-boot pipeline', testMacMenuBootPipeline],
  ['contract tests use published paths only', testContractTestsUsePublishedPathsOnly],
  ['workspace watch path normalization', testWorkspaceWatchNormalizesSeparators],
  ['app-hide/show cross-platform', testAppHideShowCrossPlatform],
]

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`fail ${name}: ${error instanceof Error ? error.message : error}`)
  }
}

if (failed > 0) {
  process.exitCode = 1
  console.error(`\n${failed} platform CI contract test(s) failed`)
} else {
  console.log(`\n${tests.length} platform CI contract test(s) passed`)
}
