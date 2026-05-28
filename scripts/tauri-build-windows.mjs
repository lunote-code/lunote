/**
 * Windows: Cargo writing target on SMB/network disk (such as Z:) will trigger os error 87.
 * Point CARGO_TARGET_DIR to the local machine %LOCALAPPDATA%, and the source code can still remain in the shared directory.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.platform !== 'win32') {
  console.error('[tauri-build-windows] Windows only; on other platforms use npm run tauri:build')
  process.exit(1)
}

const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
const cargoTargetDir = path.join(localAppData, 'CrossPlatNote', 'cargo-target')
fs.mkdirSync(cargoTargetDir, { recursive: true })

console.log(`[tauri-build-windows] CARGO_TARGET_DIR=${cargoTargetDir}`)

const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'build', '--bundles', 'msi'],
  {
    cwd: root,
    env: { ...process.env, CARGO_TARGET_DIR: cargoTargetDir },
    stdio: 'inherit',
  },
)

process.exit(result.status ?? 1)
