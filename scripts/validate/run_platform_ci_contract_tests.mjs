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
  assert(ci.includes('locale-check:'), 'ci.yml must define locale-check job')
  assert(ci.includes('run-validation: "true"'), 'ci.yml locale-check must run locale validation')
  assert(ci.includes('check-git-clean: "true"'), 'ci.yml locale-check must require committed locale outputs')
  assert(ci.includes('plan_release.mjs'), 'ci.yml must use scripts/release/plan_release.mjs')
  assert(ci.includes('npm run build'), 'ci.yml build job must compile frontend')
  assert(ci.includes('cargo build --manifest-path src-tauri/Cargo.toml'), 'ci.yml build job must compile Tauri backend')
  assert(ci.includes('release-build.yml'), 'ci.yml must publish release after successful build')
  assert(ci.includes('plan-release'), 'ci.yml must plan auto-release after compile')
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
  for (const action of ['edit-paste', 'edit-copy', 'edit-cut']) {
    assert(
      findAccel(boot.bar, action) === undefined,
      `mac-menu-boot.json ${action} must not register Tauri accelerator`,
    )
  }
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

function testTrayReadinessGuardsCloseToTray() {
  const quickCapture = read('src/platform/tauri/quickCapture.ts')
  assert(quickCapture.includes('syncCloseToTrayRuntime(true)'), 'quickCapture must mark tray ready after install')
  assert(quickCapture.includes('syncCloseToTrayRuntime(false)'), 'quickCapture must clear tray ready on failure/teardown')

  const bootstrap = read('src/app/hooks/useAppBootstrap.ts')
  assert(bootstrap.includes('hideMainWindowToBackground'), 'window close must hide to background when enabled')
  assert(bootstrap.includes('isCloseToTrayAvailable()'), 'window close must consult close-to-tray availability')
  assert(
    bootstrap.includes('hideToBackground) {\n          event.preventDefault()'),
    'window close must preventDefault synchronously before await when hide-to-tray is enabled',
  )

  const backend = read('src-tauri/src/lib.rs')
  assert(backend.includes('CloseToTrayState'), 'backend must track close-to-tray readiness state')
  assert(
    backend.includes('close_to_tray_allowed'),
    'backend close handler must gate hide-to-tray through close_to_tray_allowed',
  )
  assert(
    quickCapture.includes('isMacDesktopPlatform()'),
    'macOS must allow hide-to-tray without requiring tray icon readiness',
  )
}

function testRaiseMainWindowTargetsMainLabel() {
  const source = read('src/platform/tauri/raiseMainWindow.ts')
  assert(source.includes("WebviewWindow.getByLabel('main')"), 'raiseMainWindow must target the main window label')
  const singleInstance = read('src/app/singleInstance.ts')
  assert(singleInstance.includes('raiseMainWindow()'), 'single-instance restore must reuse main-window raise helper')
}

function testPlatformShortcutHintsResolvedAtTranslateTime() {
  const provider = read('src/i18n/provider.tsx')
  assert(
    provider.includes('resolvePlatformShortcutHintText(text)'),
    'i18n provider must normalize Cmd/Ctrl style shortcut copy by current platform',
  )
  const helper = read('src/i18n/platformShortcutHint.ts')
  assert(helper.includes('Cmd/Ctrl'), 'shortcut hint helper must collapse Cmd/Ctrl tokens')
  assert(helper.includes('⌘/Ctrl'), 'shortcut hint helper must collapse symbol shortcut tokens')
  assert(helper.includes("token: '(⌘/)'"), 'shortcut hint helper must collapse (⌘/) toolbar tokens')
}

function testUiLocaleParityContractExists() {
  const pkg = read('package.json')
  assert(pkg.includes('validate:ui-locale-parity'), 'package.json must define validate:ui-locale-parity')
  const contract = read('scripts/validate/run_ui_locale_parity_contract.mjs')
  assert(contract.includes('testUiLocaleKeyParity'), 'ui locale parity contract must check UI keys')
  assert(contract.includes('testShellMenuKeyParity'), 'ui locale parity contract must check shell menu keys')
  const ci = read('scripts/validate/verify_github_ci.mjs')
  assert(ci.includes('validate:ui-locale-parity'), 'verify:ci checks must run ui locale parity contract')
}

function testVerifyCiMirrorsNpmCi() {
  const verify = read('scripts/validate/verify_github_ci.mjs')
  assert(verify.includes('runNpmCi()'), 'verify:ci must run npm ci before build/locale jobs')
  const runner = read('scripts/validate/lib/ci_job_runner.mjs')
  assert(runner.includes("runStep('npm ci', 'npm', ['ci'])"), 'ci_job_runner must define runNpmCi helper')
}

const tests = [
  ['playwright scope and modKey', testPlaywrightScopeAndModKey],
  ['ci build job', testCiBuildJob],
  ['verify:ci mirrors npm ci', testVerifyCiMirrorsNpmCi],
  ['mac-menu-boot pipeline', testMacMenuBootPipeline],
  ['contract tests use published paths only', testContractTestsUsePublishedPathsOnly],
  ['workspace watch path normalization', testWorkspaceWatchNormalizesSeparators],
  ['app-hide/show cross-platform', testAppHideShowCrossPlatform],
  ['tray readiness guards close-to-tray', testTrayReadinessGuardsCloseToTray],
  ['raise main window targets main label', testRaiseMainWindowTargetsMainLabel],
  ['platform shortcut hints resolved', testPlatformShortcutHintsResolvedAtTranslateTime],
  ['ui locale parity contract wiring', testUiLocaleParityContractExists],
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
