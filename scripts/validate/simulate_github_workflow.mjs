#!/usr/bin/env node
/**
 * Simulate GitHub CI/Release using only publishable files (real .gitignore).
 *
 * Usage:
 *   npm run verify:github-workflow
 *   node scripts/validate/simulate_github_workflow.mjs [--skip-npm-ci]
 *
 * Phases:
 *   1. git snapshot — rsync + git init/add/commit/archive (mirrors checkout)
 *   2. ci-build     — npm ci, npm run build, cargo build
 *   3. ci-locale    — locale-pipeline (validation + git clean)
 *   4. release-validate — version:check + validate:release-config
 *   5. plan-release — scenario tests for plan_release.mjs
 */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublishSnapshot, SOURCE_ROOT } from './lib/git_publish_snapshot.mjs'
import { planRelease } from '../release/plan_release.mjs'

const args = process.argv.slice(2)
const skipNpmCi = args.includes('--skip-npm-ci')

function runStep(label, fn) {
  console.log(`\n=== ${label} ===`)
  const started = Date.now()
  try {
    fn()
    console.log(`✓ ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`)
  } catch (error) {
    console.error(`✗ ${label}: ${error instanceof Error ? error.message : error}`)
    throw error
  }
}

function execIn(cwd, command, env = {}) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command}`)
  }
}

function parsePlanOutput(text) {
  const out = {}
  for (const line of text.split('\n')) {
    const idx = line.indexOf('=')
    if (idx > 0) out[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return out
}

function runPlanReleaseInRepo(repoDir, { ref, sha }) {
  const result = spawnSync('node', ['scripts/release/plan_release.mjs'], {
    cwd: repoDir,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REF: ref, GITHUB_SHA: sha },
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'plan_release failed')
  }
  return parsePlanOutput(result.stdout)
}

function gitIn(repoDir, cmd) {
  return execSync(cmd, { cwd: repoDir, encoding: 'utf8' }).trim()
}

function testPlanReleaseScenarios(stagingDir) {
  const versionPath = path.join(stagingDir, 'version.json')
  const readVersion = () => JSON.parse(fs.readFileSync(versionPath, 'utf8')).version
  const writeVersion = (v) => {
    fs.writeFileSync(versionPath, `${JSON.stringify({ version: v }, null, 2)}\n`)
  }

  const sha = gitIn(stagingDir, 'git rev-parse HEAD')

  // Scenario 1: first (only) commit on main — must NOT release
  {
    const out = runPlanReleaseInRepo(stagingDir, { ref: 'refs/heads/main', sha })
    if (out.should_release !== 'false') {
      throw new Error(`first commit: expected should_release=false, got ${out.should_release}`)
    }
    console.log('  ok  first commit on main → compile only')
  }

  // Add second commit (same version) — still no release
  fs.writeFileSync(path.join(stagingDir, 'sim-touch.txt'), 'noop\n')
  gitIn(stagingDir, 'git add sim-touch.txt && git commit -m "sim: noop"')
  const sha2 = gitIn(stagingDir, 'git rev-parse HEAD')
  {
    const out = runPlanReleaseInRepo(stagingDir, { ref: 'refs/heads/main', sha: sha2 })
    if (out.should_release !== 'false') {
      throw new Error(`unchanged version: expected should_release=false, got ${out.should_release}`)
    }
    console.log('  ok  version.json unchanged → compile only')
  }

  // Bump version — should release
  const prev = readVersion()
  const parts = prev.split('.').map(Number)
  parts[2] += 1
  const bumped = parts.join('.')
  writeVersion(bumped)
  gitIn(stagingDir, 'git add version.json && git commit -m "sim: bump version"')
  const sha3 = gitIn(stagingDir, 'git rev-parse HEAD')
  {
    const out = runPlanReleaseInRepo(stagingDir, { ref: 'refs/heads/main', sha: sha3 })
    if (out.should_release !== 'true' || out.tag !== `v${bumped}`) {
      throw new Error(`version bump: expected release v${bumped}, got ${JSON.stringify(out)}`)
    }
    console.log(`  ok  version.json bump → auto-release v${bumped}`)
  }

  // Tag for current version already exists — no duplicate auto-release
  gitIn(stagingDir, `git tag v${bumped}`)
  {
    const out = runPlanReleaseInRepo(stagingDir, { ref: 'refs/heads/main', sha: sha3 })
    if (out.should_release !== 'false') {
      throw new Error(`existing tag for current version: expected should_release=false, got ${out.should_release}`)
    }
    console.log(`  ok  tag v${bumped} already exists → compile only`)
  }

  // Tag push — always release
  {
    const out = runPlanReleaseInRepo(stagingDir, { ref: `refs/tags/v${bumped}`, sha: sha3 })
    if (out.should_release !== 'true' || out.tag !== `v${bumped}`) {
      throw new Error(`tag push: expected release, got ${JSON.stringify(out)}`)
    }
    console.log(`  ok  tag push v${bumped} → release`)
  }

  // Non-main branch — compile only
  {
    const direct = planRelease({ ref: 'refs/heads/feature/x', sha: sha3 })
    if (direct.should_release) throw new Error('feature branch must not release')
    console.log('  ok  feature branch → compile only')
  }
}

function main() {
  console.log('simulate_github_workflow — mirror GitHub checkout + CI/Release guards')
  console.log(`Source: ${SOURCE_ROOT}`)

  let snapshot
  try {
    runStep('Publish snapshot (gitignore-respecting checkout)', () => {
      snapshot = createPublishSnapshot()
      console.log(`  tracked files: ${snapshot.trackedCount}`)
      console.log(`  checkout: ${snapshot.checkoutDir}`)
    })

    const { checkoutDir, stagingDir } = snapshot

    if (!skipNpmCi) {
      runStep('CI build job (npm ci + build + cargo build)', () => {
        execIn(checkoutDir, 'npm ci')
        execIn(checkoutDir, 'npm run build')
        execIn(
          checkoutDir,
          'cargo build --manifest-path src-tauri/Cargo.toml',
          { CARGO_TARGET_DIR: path.join(checkoutDir, 'src-tauri/target') },
        )
      })
    } else {
      console.log('\n=== CI build job (skipped — --skip-npm-ci) ===')
    }

    runStep('CI locale-check job (locale-pipeline + validation + git clean)', () => {
      // Re-init git in checkout so check-git-clean works (archive has no .git)
      execIn(checkoutDir, 'git init -b main && git config user.email sim@local && git config user.name sim')
      execIn(checkoutDir, 'git add -A && git commit -m "sim checkout"')
      execIn(checkoutDir, 'npm run verify:locale-pipeline')
    })

    runStep('Release validate-release job', () => {
      execIn(checkoutDir, 'npm run version:check')
      execIn(checkoutDir, 'node scripts/release/validate_release_config.mjs')
      execIn(checkoutDir, 'node scripts/validate/run_platform_ci_contract_tests.mjs')
      execIn(checkoutDir, 'python3 scripts/validate/validate_git_publish_paths.py')
      execIn(checkoutDir, 'npm run test:release')
    })

    runStep('plan-release scenario tests', () => {
      testPlanReleaseScenarios(stagingDir)
    })

    console.log('\n✓ simulate_github_workflow — all phases passed')
  } finally {
    snapshot?.cleanup()
  }
}

main()
