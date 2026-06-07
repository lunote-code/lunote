#!/usr/bin/env node
/**
 * Decide whether CI should publish a release after compile.
 * Mirrors .github/workflows/ci.yml plan-release (single source of truth).
 *
 * Env:
 *   GITHUB_REF  — e.g. refs/heads/main or refs/tags/v1.0.0
 *   GITHUB_SHA  — commit SHA (for auto-release ref)
 *
 * Usage:
 *   GITHUB_REF=refs/heads/main GITHUB_SHA=abc node scripts/release/plan_release.mjs
 *   GITHUB_OUTPUT=out.txt node scripts/release/plan_release.mjs   # append key=value lines
 */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function git(args) {
  return execSync(['git', ...args].join(' '), { cwd: ROOT, encoding: 'utf8' }).trim()
}

function gitOk(args) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).status === 0
}

function readVersionFromCommit(rev) {
  const raw = execSync(`git show ${rev}:version.json`, { cwd: ROOT, encoding: 'utf8' })
  return JSON.parse(raw).version
}

function writeOutput(key, value) {
  const line = `${key}=${value}\n`
  const outFile = process.env.GITHUB_OUTPUT
  if (outFile) {
    fs.appendFileSync(outFile, line)
  }
  process.stdout.write(line)
}

function planRelease({ ref, sha }) {
  if (ref.startsWith('refs/tags/v')) {
    const tag = ref.slice('refs/tags/'.length)
    return { should_release: true, tag, release_ref: ref, reason: `Release on tag push: ${tag}` }
  }

  if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') {
    return { should_release: false, reason: 'Branch push without version tag; compile only.' }
  }

  const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version
  const tag = `v${current}`

  if (gitOk(['rev-parse', `refs/tags/${tag}`])) {
    return {
      should_release: false,
      reason: `Tag ${tag} already exists; compile only. Re-run Release workflow to republish.`,
    }
  }

  if (!gitOk(['rev-parse', 'HEAD~1'])) {
    return {
      should_release: false,
      reason: 'First commit on branch; compile only (no auto-release). Push a tag to release.',
    }
  }

  let previous
  try {
    previous = readVersionFromCommit('HEAD~1')
  } catch {
    return {
      should_release: false,
      reason: 'Cannot read previous version.json; compile only.',
    }
  }

  if (previous === current) {
    return { should_release: false, reason: `version.json unchanged (${current}); compile only.` }
  }

  const branch = ref.slice('refs/heads/'.length)
  return {
    should_release: true,
    tag,
    release_ref: sha,
    reason: `Auto-release ${tag} after version.json bump on ${branch}.`,
  }
}

function main() {
  const ref = process.env.GITHUB_REF ?? ''
  const sha = process.env.GITHUB_SHA ?? git(['rev-parse', 'HEAD'])

  if (!ref) {
    console.error('GITHUB_REF is required')
    process.exit(2)
  }

  const result = planRelease({ ref, sha })
  console.log(result.reason)

  writeOutput('should_release', result.should_release ? 'true' : 'false')
  if (result.tag) writeOutput('tag', result.tag)
  if (result.release_ref) writeOutput('release_ref', result.release_ref)
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main()
}

export { planRelease }
