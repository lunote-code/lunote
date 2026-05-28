/**
 * Keep app version in sync across version.json, package.json,
 * package-lock.json, tauri.conf.json, and Cargo.toml.
 *
 * Source of truth: version.json "version"
 *
 * Usage:
 *   node scripts/sync-version.mjs          # write synced version to all files
 *   node scripts/sync-version.mjs --check  # exit 1 if any file differs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const paths = {
  versionJson: path.join(root, 'version.json'),
  packageJson: path.join(root, 'package.json'),
  packageLock: path.join(root, 'package-lock.json'),
  tauriConf: path.join(root, 'src-tauri', 'tauri.conf.json'),
  cargoToml: path.join(root, 'src-tauri', 'Cargo.toml'),
}

function readCanonicalVersion() {
  const config = JSON.parse(fs.readFileSync(paths.versionJson, 'utf8'))
  const version = String(config.version ?? '').trim()
  if (!/^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/.test(version)) {
    throw new Error(`Invalid semver in version.json: "${version}"`)
  }
  return version
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(paths.packageJson, 'utf8'))
  return String(pkg.version ?? '').trim()
}

function readTauriVersion() {
  const conf = JSON.parse(fs.readFileSync(paths.tauriConf, 'utf8'))
  return String(conf.version ?? '').trim()
}

function readCargoVersion() {
  const cargo = fs.readFileSync(paths.cargoToml, 'utf8')
  const match = cargo.match(/^version\s*=\s*"([^"]+)"/m)
  if (!match) throw new Error('Could not find version in src-tauri/Cargo.toml')
  return match[1]
}

function readPackageLockVersion() {
  if (!fs.existsSync(paths.packageLock)) return null
  const lock = JSON.parse(fs.readFileSync(paths.packageLock, 'utf8'))
  const rootVersion = String(lock.version ?? '').trim()
  const pkgVersion = String(lock.packages?.['']?.version ?? '').trim()
  if (rootVersion && pkgVersion && rootVersion !== pkgVersion) {
    return `${rootVersion} / ${pkgVersion}`
  }
  return rootVersion || pkgVersion || null
}

function writeTauriVersion(version) {
  const conf = JSON.parse(fs.readFileSync(paths.tauriConf, 'utf8'))
  conf.version = version
  fs.writeFileSync(paths.tauriConf, `${JSON.stringify(conf, null, 2)}\n`)
}

function writePackageJsonVersion(version) {
  const pkg = JSON.parse(fs.readFileSync(paths.packageJson, 'utf8'))
  pkg.version = version
  fs.writeFileSync(paths.packageJson, `${JSON.stringify(pkg, null, 2)}\n`)
}

function writeCargoVersion(version) {
  const cargo = fs.readFileSync(paths.cargoToml, 'utf8')
  const next = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`)
  if (next === cargo) throw new Error('Could not update version in src-tauri/Cargo.toml')
  fs.writeFileSync(paths.cargoToml, next)
}

function writePackageLockVersion(version) {
  if (!fs.existsSync(paths.packageLock)) return
  const lock = JSON.parse(fs.readFileSync(paths.packageLock, 'utf8'))
  lock.version = version
  if (lock.packages?.['']) {
    lock.packages[''].version = version
  }
  fs.writeFileSync(paths.packageLock, `${JSON.stringify(lock, null, 2)}\n`)
}

function main() {
  const canonical = readCanonicalVersion()
  const packageVersion = readPackageVersion()
  const tauriVersion = readTauriVersion()
  const cargoVersion = readCargoVersion()
  const lockVersion = readPackageLockVersion()

  const mismatches = [
    ['package.json', packageVersion, canonical],
    ['package-lock.json', lockVersion, canonical],
    ['src-tauri/tauri.conf.json', tauriVersion, canonical],
    ['src-tauri/Cargo.toml', cargoVersion, canonical],
  ].filter(([, actual]) => actual !== canonical)

  if (checkOnly) {
    if (mismatches.length === 0) {
      console.log(`[sync-version] OK — all files at ${canonical}`)
      return
    }
    console.error('[sync-version] Version mismatch (source: version.json):')
    for (const [file, actual, expected] of mismatches) {
      console.error(`  ${file}: ${actual} (expected ${expected})`)
    }
    console.error('Run: npm run version:sync')
    process.exit(1)
  }

  if (packageVersion !== canonical) writePackageJsonVersion(canonical)
  if (lockVersion !== canonical) writePackageLockVersion(canonical)
  if (tauriVersion !== canonical) writeTauriVersion(canonical)
  if (cargoVersion !== canonical) writeCargoVersion(canonical)

  if (mismatches.length === 0) {
    console.log(`[sync-version] Already synced at ${canonical}`)
    return
  }

  console.log(`[sync-version] Synced to ${canonical}`)
  for (const [file] of mismatches) {
    console.log(`  updated ${file}`)
  }
}

main()
