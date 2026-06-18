/**
 * Shared helpers for local CI job mirrors (verify_github_ci.mjs).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export function hasGitHead() {
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return result.status === 0
}

export function runStep(label, command, args, { env } = {}) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    env: env ? { ...process.env, ...env } : process.env,
  })
  if (result.status !== 0) {
    console.error(`\nCI verify: failed at "${label}"`)
    process.exit(result.status ?? 1)
  }
}

export function npmRun(script, extraArgs = []) {
  const npmArgs = ['run', script]
  if (extraArgs.length > 0) npmArgs.push('--', ...extraArgs)
  runStep(`npm ${npmArgs.join(' ')}`, 'npm', npmArgs)
}

export function runNode(relScript, args = []) {
  runStep(`node ${relScript}`, 'node', [path.join(ROOT, relScript), ...args])
}

export function runPython(relScript, args = []) {
  runStep(`python3 ${relScript}`, 'python3', [path.join(ROOT, relScript), ...args])
}

export function runCargo(args) {
  runStep(`cargo ${args.join(' ')}`, 'cargo', args, {
    env: { CARGO_TARGET_DIR: path.join(ROOT, 'src-tauri', 'target') },
  })
}

/** Mirrors GitHub CI install step (.github/workflows/ci.yml). */
export function runNpmCi() {
  runStep('npm ci', 'npm', ['ci'])
}
