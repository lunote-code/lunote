/**
 * Platform / CI contract: E2E scope, CI gates, native menu parity, workspace watch paths.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

/** Documented Playwright gaps — browser QA playground, not Tauri WebView. */
const E2E_NATIVE_GAPS = [
  'tray',
  'global shortcut',
  'native dialog',
  'pdf chrome',
  'reveal_in_explorer',
]

function testPlaywrightRunsBrowserNotTauri() {
  const cfg = read('playwright.config.ts')
  assert(cfg.includes("command: 'npm run dev'"), 'playwright: must use Vite dev server')
  assert(cfg.includes('chromium'), 'playwright: runs Chromium project only')
  assert(!cfg.includes('tauri'), 'playwright: must not claim Tauri WebView coverage')

  const helpers = read('scripts/test/lib/playwright-helpers.ts')
  assert(helpers.includes("process.platform === 'darwin' ? 'Meta' : 'Control'"), 'modKey: mac Meta, others Control')
}

function testModKeyMatchesLinuxCi() {
  const modKeySrc = read('scripts/test/lib/playwright-helpers.ts')
  assert(modKeySrc.includes("'Control'"), 'Linux CI must map modKey to Control (not Meta)')
}

function testCiHasBlockingBuildSmoke() {
  const ci = read('.github/workflows/ci.yml')
  assert(ci.includes('build-smoke:'), 'ci.yml: must define build-smoke job')
  assert(ci.includes('cargo build --manifest-path src-tauri/Cargo.toml'), 'ci.yml: build-smoke must cargo build')
  assert(ci.includes('needs: [locale-and-scripts, build-smoke, build]'), 'ci-gate: must depend on build-smoke')
  assert(ci.includes('Require Linux build smoke'), 'ci-gate: must fail when build-smoke fails')
  assert(ci.includes('continue-on-error: true'), 'ci.yml: platform matrix may stay non-blocking')
}

function testReleaseWorkflowStillExists() {
  const release = read('.github/workflows/release.yml')
  assert(release.includes('tauri build') || release.includes('npm run tauri'), 'release.yml: must run full tauri build')
}

function testAppHideShowCrossPlatform() {
  const source = read('src-tauri/src/app_menu.rs')
  assert(source.includes('fn hide_application'), 'app-hide: must route through hide_application helper')
  assert(source.includes('fn show_all_application'), 'app-show-all: must route through show_all_application helper')
  assert(source.includes('"app-hide" => {\n      hide_application(app);'), 'app-hide: must call hide_application on all platforms')
  assert(source.includes('"app-show-all" => {\n      show_all_application(app);'), 'app-show-all: must call show_all_application on all platforms')
  assert(source.includes('let _ = app.hide();'), 'hide_application: macOS path must call app.hide()')
  assert(source.includes('let _ = app.show();'), 'show_all_application: macOS path must call app.show()')
}

function testWorkspaceWatchNormalizesSeparators() {
  const source = read('src-tauri/src/core/workspace_watch.rs')
  assert(source.includes("path.replace('\\\\', \"/\")"), 'workspace_watch: must normalize path separators')
  assert(source.includes('should_ignore_event_normalizes_windows_separators'), 'workspace_watch: must test Windows paths')
}

function testRustWorkspaceWatchUnitTests() {
  const tauriDir = path.join(root, 'src-tauri')
  const result = spawnSync('cargo', ['test', '-p', 'app', 'workspace_watch::tests', '--', '--nocapture'], {
    cwd: tauriDir,
    encoding: 'utf8',
    env: { ...process.env, CARGO_TARGET_DIR: path.join(tauriDir, 'target') },
  })
  if (result.status !== 0) {
    throw new Error(`workspace_watch tests failed:\n${result.stdout}\n${result.stderr}`)
  }
}

function testDocumentedE2eNativeGaps() {
  assert(E2E_NATIVE_GAPS.length >= 5, 'E2E native gap list must stay documented')
}

function testMacMenuBootForcesMacPlatform() {
  const src = read('src/platform/tauri/macMenuBootExport.ts')
  assert(src.includes("buildAppMenuSchema('mac')"), 'macMenuBootExport must call buildAppMenuSchema("mac")')
  assert(!src.includes('APP_MENU_SCHEMA'), 'macMenuBootExport must not use runtime APP_MENU_SCHEMA (host-dependent)')
  assert(
    src.includes('assertMacMenuBootUsesMacAccelerators'),
    'macMenuBootExport must assert macOS accelerators after generation',
  )
}

function testMacMenuBootGeneratorUsesValidation() {
  const gen = read('scripts/build/generate_mac_menu_boot.mjs')
  assert(
    gen.includes('applyMacBootAcceleratorPatches'),
    'generate_mac_menu_boot.mjs must apply macOS accelerator patches after SSR build',
  )
  assert(
    gen.includes('assertMacBootAcceleratorPatchesApplied'),
    'generate_mac_menu_boot.mjs must assert macOS accelerator patches',
  )
  assert(
    gen.includes("CROSSPLATNOTE_FORCE_DESKTOP_PLATFORM = 'mac'"),
    'generate_mac_menu_boot.mjs must force macOS platform for CI/Linux hosts',
  )
}

function testLocalePipelineChecksCommittedOutputs() {
  const action = read('.github/actions/locale-pipeline/action.yml')
  assert(action.includes('check-git-clean'), 'locale-pipeline must support check-git-clean')
  assert(action.includes('src-tauri/resources/mac-menu-boot.json'), 'locale-pipeline must track mac-menu-boot.json')
}

function testMacMenuBootValidatorExists() {
  const validator = read('scripts/validate/validate_mac_menu_boot.mjs')
  assert(validator.includes('assertMacMenuBootUsesMacAccelerators'), 'validate_mac_menu_boot must assert mac accelerators')
}

function testMacMenuBootCommittedUsesMacAccelerators() {
  const boot = JSON.parse(read('src-tauri/resources/mac-menu-boot.json'))
  const findAccel = (nodes, action) => {
    for (const node of nodes) {
      if ((node.kind === 'item' || node.kind === 'check') && node.action === action) {
        return node.tauriAccelerator
      }
      if (node.kind === 'submenu') {
        const nested = findAccel(node.children ?? [], action)
        if (nested !== undefined) return nested
      }
    }
    return undefined
  }
  // Spot-check commands whose Win/Linux baseline differs from macOS (CI used to emit linux values).
  assert(
    findAccel(boot.bar, 'edit-find-prev') === 'CmdOrCtrl+Shift+KeyG',
    'edit-find-prev must use macOS accelerator in mac-menu-boot.json',
  )
  assert(
    findAccel(boot.bar, 'edit-find-next') === 'CmdOrCtrl+KeyG',
    'edit-find-next must use macOS accelerator in mac-menu-boot.json',
  )
  assert(
    findAccel(boot.bar, 'view-fullscreen') === 'CmdOrCtrl+Ctrl+KeyF',
    'view-fullscreen must use macOS accelerator in mac-menu-boot.json',
  )
}

const tests = [
  ['playwright browser-not-tauri scope', testPlaywrightRunsBrowserNotTauri],
  ['modKey linux/control mapping', testModKeyMatchesLinuxCi],
  ['ci blocking build-smoke gate', testCiHasBlockingBuildSmoke],
  ['release full tauri build path', testReleaseWorkflowStillExists],
  ['app-hide/show cross-platform', testAppHideShowCrossPlatform],
  ['workspace watch path normalization', testWorkspaceWatchNormalizesSeparators],
  ['rust workspace_watch unit tests', testRustWorkspaceWatchUnitTests],
  ['documented e2e native gaps', testDocumentedE2eNativeGaps],
  ['mac menu boot forces mac platform', testMacMenuBootForcesMacPlatform],
  ['mac menu boot generator validates accelerators', testMacMenuBootGeneratorUsesValidation],
  ['locale pipeline checks committed outputs', testLocalePipelineChecksCommittedOutputs],
  ['mac menu boot validator script', testMacMenuBootValidatorExists],
  ['mac menu boot committed mac accelerators', testMacMenuBootCommittedUsesMacAccelerators],
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
  console.log('Note: Playwright E2E intentionally skips native Tauri:', E2E_NATIVE_GAPS.join(', '))
}
