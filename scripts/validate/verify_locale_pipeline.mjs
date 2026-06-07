#!/usr/bin/env node
/**
 * Local pre-push check mirroring CI locale/menu pipeline + git cleanliness.
 * Run: npm run verify:locale-pipeline
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const GENERATED_PATHS = [
  'src/i18n/locales',
  'src-tauri/i18n',
  'scripts/locale/menu_canonical.json',
  'src-tauri/src/menu_manifest.rs',
  'src-tauri/resources/mac-menu-boot.json',
]

function run(label, command, args) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: false })
  if (result.status !== 0) {
    console.error(`\nverify_locale_pipeline: failed at "${label}"`)
    process.exit(result.status ?? 1)
  }
}

run('build UI locales', 'python3', ['scripts/locale/build_ui_locales.py'])
run('sync shell menu', 'python3', ['scripts/locale/sync_shell_menu_from_ui.py'])
run('export menu canonical', 'python3', ['scripts/locale/export_menu_canonical.py'])
run('export menu rust manifest', 'python3', ['scripts/locale/export_menu_rust_manifest.py'])
run('generate mac menu boot', 'node', ['scripts/build/generate_mac_menu_boot.mjs'])
run('validate mac menu boot', 'node', ['scripts/validate/validate_mac_menu_boot.mjs'])
run('validate menu i18n sync', 'python3', ['scripts/locale/validate_menu_i18n_sync.py'])
run('validate menu runtime', 'python3', ['scripts/locale/validate_menu_runtime.py'])
run('validate locales (strict)', 'python3', ['scripts/locale/validate_locale.py', '--strict', '--check-min-translated'])
run('validate shell locale', 'python3', ['scripts/locale/validate_shell_locale.py'])

const diff = spawnSync('git', ['diff', '--exit-code', 'HEAD', '--', ...GENERATED_PATHS], {
  cwd: ROOT,
  encoding: 'utf8',
})

if (diff.status !== 0) {
  if (diff.status === 1) {
    console.error('\nverify_locale_pipeline: generated files differ from HEAD.')
    console.error('Commit the updated outputs listed above, or revert local generation.')
    spawnSync('git', ['diff', '--stat', 'HEAD', '--', ...GENERATED_PATHS], { cwd: ROOT, stdio: 'inherit' })
  }
  process.exit(diff.status ?? 1)
}

console.log('\nverify_locale_pipeline: all checks passed (generated outputs match HEAD).')
