/**
 * One-command release: bump version, commit, tag, push → GitHub Actions builds & publishes.
 *
 * Usage:
 *   npm run release:publish -- 1.2.3
 *   npm run release:publish -- v1.2.3
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const semverRe = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/

function run(cmd, args, { allowFail = false } = {}) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', encoding: 'utf8' })
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1)
  }
  return result
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `Command failed: ${cmd} ${args.join(' ')}`)
  }
  return result.stdout.trim()
}

function parseVersionArg(raw) {
  const input = String(raw ?? '').trim()
  if (!input) {
    console.error('Usage: npm run release:publish -- <version>')
    console.error('Example: npm run release:publish -- 1.2.3')
    process.exit(1)
  }
  const version = input.replace(/^v/i, '')
  if (!semverRe.test(version)) {
    console.error(`Invalid semver: "${input}" (expected e.g. 1.2.3 or v1.2.3)`)
    process.exit(1)
  }
  return version
}

function readConfiguredVersion() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'))
  return String(config.version ?? '').trim()
}

function writeConfiguredVersion(version) {
  const configPath = path.join(root, 'version.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  config.version = version
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
}

function assertGitRepo() {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0 || result.stdout.trim() !== 'true') {
    console.error('[release] Not a git repository. Run git init and add a GitHub remote first.')
    process.exit(1)
  }
}

function assertCleanWorkingTree() {
  const dirty = runCapture('git', ['status', '--porcelain'])
  if (dirty) {
    console.error('[release] Working tree is not clean. Commit or stash changes first:')
    console.error(dirty)
    process.exit(1)
  }
}

function assertRemote() {
  try {
    runCapture('git', ['remote', 'get-url', 'origin'])
  } catch {
    console.error('[release] No git remote "origin". Add one first:')
    console.error('  git remote add origin git@github.com:<user>/<repo>.git')
    process.exit(1)
  }
}

function tagExists(tag) {
  const local = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
    cwd: root,
    encoding: 'utf8',
  })
  return local.status === 0
}

function currentBranch() {
  return runCapture('git', ['branch', '--show-current'])
}

function remoteUrl() {
  return runCapture('git', ['remote', 'get-url', 'origin'])
}

function guessActionsUrl() {
  const url = remoteUrl()
  const ssh = url.match(/git@github\.com:(.+?)(?:\.git)?$/i)
  if (ssh) return `https://github.com/${ssh[1]}/actions`
  const https = url.match(/github\.com[/:](.+?)(?:\.git)?$/i)
  if (https) return `https://github.com/${https[1]}/actions`
  return null
}

function main() {
  const version = parseVersionArg(process.argv[2])
  const tag = `v${version}`
  const current = readConfiguredVersion()

  assertGitRepo()
  assertRemote()
  assertCleanWorkingTree()

  if (tagExists(tag)) {
    console.error(`[release] Tag ${tag} already exists locally. Delete it first or pick a new version.`)
    process.exit(1)
  }

  console.log(`[release] Publishing ${tag} (current version.json: ${current})`)

  if (version === current) {
    console.log('[release] Version unchanged — syncing manifest files and creating tag only')
    run('npm', ['run', 'version:sync'])
  } else {
    writeConfiguredVersion(version)
    run('npm', ['run', 'version:sync'])
  }

  run('git', ['add', 'version.json', 'package.json', 'package-lock.json', 'src-tauri/Cargo.toml', 'src-tauri/tauri.conf.json'])
  const staged = runCapture('git', ['diff', '--cached', '--name-only'])
  if (staged) {
    run('git', ['commit', '-m', `release: ${tag}`])
  }
  run('git', ['tag', '-a', tag, '-m', `release: ${tag}`])

  const branch = currentBranch()
  console.log(`[release] Pushing ${branch} and ${tag} to origin…`)
  run('git', ['push', 'origin', branch])
  run('git', ['push', 'origin', tag])

  const actionsUrl = guessActionsUrl()
  console.log('')
  console.log(`[release] Done — GitHub Actions will build DMG / MSI / DEB for ${tag}.`)
  if (actionsUrl) {
    console.log(`[release] Track progress: ${actionsUrl}`)
  }
}

main()
