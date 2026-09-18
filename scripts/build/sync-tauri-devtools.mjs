/**
 * Toggle WebView DevTools in src-tauri/tauri.conf.json.
 *
 * Release builds keep devtools disabled (see CHANGELOG release hardening).
 * Local dev enables devtools before `tauri dev` so Cmd+Option+I / Inspect works.
 *
 * Usage:
 *   node scripts/build/sync-tauri-devtools.mjs --enable
 *   node scripts/build/sync-tauri-devtools.mjs --disable
 *   node scripts/build/sync-tauri-devtools.mjs --check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json')
const MAIN_WINDOW_LABEL = 'main'

function readConfig() {
  return JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'))
}

function writeConfig(conf) {
  fs.writeFileSync(tauriConfPath, `${JSON.stringify(conf, null, 2)}\n`)
}

function findMainWindowIndex(conf) {
  const windows = conf.app?.windows
  if (!Array.isArray(windows) || windows.length === 0) {
    throw new Error('tauri.conf.json: app.windows is missing or empty')
  }
  const index = windows.findIndex((window) => window.label === MAIN_WINDOW_LABEL)
  if (index < 0) {
    throw new Error(`tauri.conf.json: window "${MAIN_WINDOW_LABEL}" not found`)
  }
  return index
}

function readMainDevtools(conf) {
  return conf.app.windows[findMainWindowIndex(conf)].devtools
}

function setMainDevtools(enabled) {
  const conf = readConfig()
  const index = findMainWindowIndex(conf)
  const current = conf.app.windows[index].devtools
  conf.app.windows[index].devtools = enabled
  if (current !== enabled) {
    writeConfig(conf)
    console.log(`[sync-tauri-devtools] main window devtools=${enabled}`)
    return
  }
  console.log(`[sync-tauri-devtools] Already devtools=${enabled}`)
}

function checkReleaseDevtoolsDisabled() {
  const devtools = readMainDevtools(readConfig())
  if (devtools !== false) {
    console.error(
      '[sync-tauri-devtools] release check failed: app.windows[main].devtools must be false (run --disable)',
    )
    process.exit(1)
  }
  console.log('[sync-tauri-devtools] OK — release devtools disabled')
}

const args = process.argv.slice(2)
if (args.includes('--check')) {
  checkReleaseDevtoolsDisabled()
} else if (args.includes('--enable')) {
  setMainDevtools(true)
} else if (args.includes('--disable')) {
  setMainDevtools(false)
} else {
  console.error('Usage: sync-tauri-devtools.mjs --enable | --disable | --check')
  process.exit(1)
}
