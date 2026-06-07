/**
 * Steps mirrored from .github/actions/locale-pipeline/action.yml
 */
import { spawnSync } from 'node:child_process'

import { hasGitHead, runNode, runPython, runStep, ROOT } from './ci_job_runner.mjs'

export const GENERATED_LOCALE_PATHS = [
  'src/i18n/locales',
  'src-tauri/i18n',
  'scripts/locale/menu_canonical.json',
  'src-tauri/src/menu_manifest.rs',
  'src-tauri/resources/mac-menu-boot.json',
]

/** Match locale-pipeline composite (build inputs only). */
export function runLocalePipelineBuildInputs() {
  runPython('scripts/locale/build_ui_locales.py')
  runPython('scripts/locale/sync_shell_menu_from_ui.py')
  runPython('scripts/locale/export_menu_canonical.py')
  runPython('scripts/locale/export_menu_rust_manifest.py')
  runNode('scripts/build/generate_mac_menu_boot.mjs')
  runNode('scripts/validate/validate_mac_menu_boot.mjs')
}

/** Match locale-pipeline with run-validation: true. */
export function runLocalePipelineValidators() {
  runPython('scripts/locale/validate_menu_i18n_sync.py')
  runPython('scripts/locale/validate_menu_runtime.py')
  runPython('scripts/locale/validate_locale.py', ['--strict', '--check-min-translated'])
  runPython('scripts/locale/validate_shell_locale.py')
  runStep('npm run validate:chrome-candidates', 'npm', ['run', 'validate:chrome-candidates'])
}

/** Match locale-pipeline check-git-clean step. */
export function assertGeneratedLocaleOutputsMatchHead() {
  if (!hasGitHead()) {
    console.log('\n==> git HEAD check (skipped — not a git repository)')
    return
  }

  console.log('\n==> Require committed locale/menu outputs (git diff HEAD)')
  const diff = spawnSync('git', ['diff', '--exit-code', 'HEAD', '--', ...GENERATED_LOCALE_PATHS], {
    cwd: ROOT,
    encoding: 'utf8',
  })

  if (diff.status !== 0) {
    if (diff.status === 1) {
      console.error('\nGenerated locale/menu files differ from HEAD.')
      console.error('Run: npm run verify:locale-pipeline')
      console.error('Then commit the updated files.')
      console.error('\nChanged paths:')
      spawnSync('git', ['diff', '--name-only', 'HEAD', '--', ...GENERATED_LOCALE_PATHS], {
        cwd: ROOT,
        stdio: 'inherit',
      })
      spawnSync('git', ['diff', '--stat', 'HEAD', '--', ...GENERATED_LOCALE_PATHS], {
        cwd: ROOT,
        stdio: 'inherit',
      })
    }
    process.exit(diff.status ?? 1)
  }

  console.log('Locale/menu generated outputs match HEAD.')
}

/** Full locale-and-scripts locale-pipeline inputs. */
export function runLocalePipelineFull() {
  runLocalePipelineBuildInputs()
  runLocalePipelineValidators()
  assertGeneratedLocaleOutputsMatchHead()
}
