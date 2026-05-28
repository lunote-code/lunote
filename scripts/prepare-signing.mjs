/**
 * Inject platform signing settings into tauri.conf.json before release builds.
 * - macOS ad-hoc is configured directly in tauri.conf.json (signingIdentity: "-").
 * - Windows Authenticode signing is enabled when WINDOWS_CERTIFICATE_THUMBPRINT is set.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configPath = path.join(root, 'src-tauri', 'tauri.conf.json')

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
config.bundle ??= {}
config.bundle.windows ??= {}

const thumbprint = process.env.WINDOWS_CERTIFICATE_THUMBPRINT?.trim()
if (thumbprint) {
  config.bundle.windows.certificateThumbprint = thumbprint.replace(/\s/g, '')
  config.bundle.windows.digestAlgorithm =
    process.env.WINDOWS_DIGEST_ALGORITHM?.trim() || 'sha256'
  config.bundle.windows.timestampUrl =
    process.env.WINDOWS_TIMESTAMP_URL?.trim() || 'http://timestamp.digicert.com'
  console.log('[prepare-signing] Windows Authenticode signing enabled')
} else {
  delete config.bundle.windows.certificateThumbprint
  console.log('[prepare-signing] WINDOWS_CERTIFICATE_THUMBPRINT not set; Windows bundle will be unsigned')
}

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
console.log('[prepare-signing] Updated src-tauri/tauri.conf.json')
