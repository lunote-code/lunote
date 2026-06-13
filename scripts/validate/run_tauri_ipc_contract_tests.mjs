/**
 * Tauri IPC + security contract — runs in CI (scripts/validate, not gitignored).
 * Playwright uses Vite dev; this guards Rust command boundaries (file, clipboard, dialog, export).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tauriDir = path.join(root, 'src-tauri')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function runCargoTest(filter) {
  const result = spawnSync(
    'cargo',
    ['test', '-p', 'app', filter, '--', '--nocapture'],
    {
      cwd: tauriDir,
      encoding: 'utf8',
      env: { ...process.env, CARGO_TARGET_DIR: path.join(tauriDir, 'target') },
    },
  )
  if (result.status !== 0) {
    throw new Error(
      `cargo test ${filter} failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`,
    )
  }
}

function testSecurityModuleGuards() {
  const security = read('src-tauri/src/core/security.rs')
  for (const fn of [
    'ensure_export_allowed',
    'ensure_reveal_allowed',
    'ensure_listable_workspace_root',
    'validate_external_open_url',
    'sanitize_pdf_html',
  ]) {
    assert(security.includes(`pub fn ${fn}`), `security.rs must export ${fn}`)
  }
}

function testIpcCommandsUseSecurity() {
  const commands = read('src-tauri/src/commands/mod.rs')
  const files = read('src-tauri/src/core/files.rs')
  assert(commands.includes('ensure_export_allowed'), 'export_note must use ensure_export_allowed')
  assert(
    files.includes('ensure_reveal_allowed'),
    'reveal_in_explorer path must use ensure_reveal_allowed via files.rs',
  )
  assert(
    commands.includes('validate_external_open_url'),
    'open_external_url must validate URLs',
  )
  assert(
    commands.includes('read_import_files_base64') || commands.includes('import_dropped_file_bytes'),
    'import commands must exist for file boundary coverage',
  )
}

function testPlatformTauriServiceWrappers() {
  const searchRoots = ['src/platform/tauri', 'src/editor']
  let merged = ''
  for (const rel of searchRoots) {
    const abs = path.join(root, rel)
    if (!fs.existsSync(abs)) continue
    for (const file of walkSourceFiles(abs)) {
      merged += fs.readFileSync(file, 'utf8') + '\n'
    }
  }
  assert(merged.includes("invoke('"), 'frontend must wrap invoke() IPC')
  assert(merged.includes('isTauri'), 'frontend must gate desktop runtime')
  for (const cmd of ['read_note', 'save_note', 'reveal_in_explorer', 'open_external_url']) {
    assert(merged.includes(cmd), `frontend must reference ${cmd} IPC command`)
  }
}

function walkSourceFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkSourceFiles(full))
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full)
  }
  return out
}

function testRustSecurityUnitTests() {
  runCargoTest('export_roots_tests')
  runCargoTest('sanitize_pdf_html')
  runCargoTest('external_open_url_tests')
}

function testPlaywrightDocumentsTauriGap() {
  const cfg = read('playwright.config.ts')
  assert(cfg.includes("command: 'npm run dev'"), 'playwright documents Vite-only scope')
  const contract = read('scripts/validate/run_tauri_ipc_contract_tests.mjs')
  assert(
    contract.includes('runCargoTest'),
    'tauri ipc contract must run cargo security tests as Tauri E2E substitute',
  )
}

const tests = [
  ['security module guards', testSecurityModuleGuards],
  ['IPC commands use security', testIpcCommandsUseSecurity],
  ['platform tauri service wrappers', testPlatformTauriServiceWrappers],
  ['rust security unit tests', testRustSecurityUnitTests],
  ['playwright tauri gap documented', testPlaywrightDocumentsTauriGap],
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
  console.error(`\n${failed} tauri IPC contract test(s) failed`)
} else {
  console.log(`\n${tests.length} tauri IPC contract test(s) passed`)
}
