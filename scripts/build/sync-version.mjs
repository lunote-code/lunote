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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
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

function semverToMsiVersion(version) {
  const core = version.trim().split('+')[0]
  const match = core.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!match) {
    throw new Error(`Invalid semver for MSI mapping: "${version}"`)
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  const prerelease = match[4]
  if (major > 255 || minor > 255) {
    throw new Error(`MSI major/minor must be <= 255: "${version}"`)
  }
  if (patch > 65535) {
    throw new Error(`MSI patch must be <= 65535: "${version}"`)
  }
  let build = 0
  if (prerelease) {
    const trailing = prerelease.match(/(\d+)$/)
    build = trailing ? Number(trailing[1]) : 0
  }
  if (build > 65535) {
    throw new Error(`MSI build must be <= 65535: "${version}"`)
  }
  return `${major}.${minor}.${patch}.${build}`
}

function readTauriMsiVersion() {
  const conf = JSON.parse(fs.readFileSync(paths.tauriConf, 'utf8'))
  return String(conf.bundle?.windows?.wix?.version ?? '').trim()
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

function readTauriVersion() {
  const conf = JSON.parse(fs.readFileSync(paths.tauriConf, 'utf8'))
  return String(conf.version ?? '').trim()
}

function writeTauriVersion(version) {
  const conf = JSON.parse(fs.readFileSync(paths.tauriConf, 'utf8'))
  conf.version = version
  conf.bundle ??= {}
  conf.bundle.windows ??= {}
  conf.bundle.windows.wix ??= {}
  conf.bundle.windows.wix.version = semverToMsiVersion(version)
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
  const expectedMsiVersion = semverToMsiVersion(canonical)
  const packageVersion = readPackageVersion()
  const tauriVersion = readTauriVersion()
  const tauriMsiVersion = readTauriMsiVersion()
  const cargoVersion = readCargoVersion()
  const lockVersion = readPackageLockVersion()

  const mismatches = [
    ['package.json', packageVersion, canonical],
    ['package-lock.json', lockVersion, canonical],
    ['src-tauri/tauri.conf.json', tauriVersion, canonical],
    ['src-tauri/tauri.conf.json (windows.wix.version)', tauriMsiVersion, expectedMsiVersion],
    ['src-tauri/Cargo.toml', cargoVersion, canonical],
  ].filter(([, actual, expected]) => actual !== expected)

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
  if (tauriVersion !== canonical || tauriMsiVersion !== expectedMsiVersion) writeTauriVersion(canonical)
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
