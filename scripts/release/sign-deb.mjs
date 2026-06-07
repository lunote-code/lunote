/**
 * GPG detached-sign .deb packages after Tauri bundling.
 * Skips gracefully when GPG_PRIVATE_KEY is not configured.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const debDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'deb')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const privateKey = process.env.GPG_PRIVATE_KEY?.trim()
if (!privateKey) {
  console.log('[sign-deb] GPG_PRIVATE_KEY not set; skipping deb GPG signature')
  process.exit(0)
}

if (!fs.existsSync(debDir)) {
  console.error(`[sign-deb] deb output directory not found: ${debDir}`)
  process.exit(1)
}

const debFiles = fs.readdirSync(debDir).filter((name) => name.endsWith('.deb'))
if (debFiles.length === 0) {
  console.error('[sign-deb] no .deb files found to sign')
  process.exit(1)
}

const keyPath = path.join(debDir, '.release-signing.key')
fs.writeFileSync(keyPath, Buffer.from(privateKey, 'base64'))

try {
  run('gpg', ['--batch', '--import', keyPath])

  const keyId = process.env.GPG_KEY_ID?.trim()
  const passphrase = process.env.GPG_PASSPHRASE ?? ''

  for (const debFile of debFiles) {
    const debPath = path.join(debDir, debFile)
    const args = [
      '--batch',
      '--yes',
      '--pinentry-mode=loopback',
      '--passphrase-fd',
      '0',
      '--detach-sign',
      '--armor',
      debPath,
    ]
    if (keyId) {
      args.splice(args.length - 1, 0, '--local-user', keyId)
    }

    console.log(`[sign-deb] signing ${debFile}`)
    const result = spawnSync('gpg', args, {
      input: passphrase,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  }

  console.log('[sign-deb] created .deb.asc signature files')
} finally {
  fs.rmSync(keyPath, { force: true })
}
