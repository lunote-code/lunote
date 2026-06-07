/**
 * Build a clean tree containing only files git would publish (respects .gitignore).
 * Used by simulate_github_workflow.mjs to mirror GitHub checkout.
 */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/** Heavy local dirs excluded before rsync (git would ignore them anyway). */
const RSYNC_EXCLUDES = [
  'node_modules',
  'dist',
  'dist-ssr',
  'src-tauri/target',
  'tmp',
  '.git',
  'coverage',
  'playwright-report',
  'test-results',
  '.venv',
  '.venv-i18n',
  '.cursor',
]

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' })
}

/**
 * @returns {{ stagingDir: string, checkoutDir: string, cleanup: () => void }}
 */
export function createPublishSnapshot() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lunote-gh-sim-'))
  const stagingDir = path.join(base, 'staging')
  const checkoutDir = path.join(base, 'checkout')

  fs.mkdirSync(stagingDir)
  fs.mkdirSync(checkoutDir)

  const excludeArgs = RSYNC_EXCLUDES.map((e) => `--exclude=${e}`).join(' ')
  run(`rsync -a ${excludeArgs} "${SOURCE_ROOT}/" "${stagingDir}/"`, SOURCE_ROOT)

  run('git init -b main', stagingDir)
  run('git config user.email "sim@local"', stagingDir)
  run('git config user.name "GitHub Sim"', stagingDir)
  run('git add -A', stagingDir)

  const status = spawnSync('git', ['status', '--porcelain'], { cwd: stagingDir, encoding: 'utf8' })
  if (!status.stdout.trim()) {
    throw new Error('Publish snapshot is empty — nothing would be tracked by git.')
  }

  run('git commit -m "sim: publish snapshot"', stagingDir)
  run(`git archive HEAD | tar -x -C "${checkoutDir}"`, stagingDir)

  const tracked = execSync('git ls-files', { cwd: stagingDir, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

  for (const forbidden of ['scripts/maintenance/', 'scripts/test/', 'tmp/']) {
    const hit = tracked.find((p) => p === forbidden.replace(/\/$/, '') || p.startsWith(forbidden))
    if (hit) {
      throw new Error(`Forbidden path would be published: ${hit}`)
    }
  }

  return {
    stagingDir,
    checkoutDir,
    trackedCount: tracked.length,
    cleanup: () => fs.rmSync(base, { recursive: true, force: true }),
  }
}
