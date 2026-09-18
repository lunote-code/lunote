#!/usr/bin/env node
/**
 * Merge ai.* keys from scripts/locale/packs/ai.{locale}.json
 * into src/i18n/locales/{locale}.json (add/overwrite ai.* only).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packsDir = path.join(root, 'scripts/locale/packs')
const localesDir = path.join(root, 'src/i18n/locales')

const packFiles = fs
  .readdirSync(packsDir)
  .filter((name) => /^ai\.[^.]+\.json$/.test(name))
  .sort()

if (packFiles.length === 0) {
  console.error('No ai.* pack files found in scripts/locale/packs/')
  process.exit(1)
}

let exitCode = 0

for (const file of packFiles) {
  const locale = file.slice(3, -5)
  const packPath = path.join(packsDir, file)
  const localePath = path.join(localesDir, `${locale}.json`)

  if (!fs.existsSync(localePath)) {
    console.error(`${locale}: missing locale file ${localePath}`)
    exitCode = 1
    continue
  }

  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
  const localeData = JSON.parse(fs.readFileSync(localePath, 'utf8'))

  let merged = 0
  for (const [key, value] of Object.entries(pack)) {
    if (!key.startsWith('ai.')) {
      console.error(`${locale}: skipping non-ai key ${key}`)
      exitCode = 1
      continue
    }
    if (localeData[key] !== value) {
      localeData[key] = value
      merged += 1
    }
  }

  const sorted = Object.fromEntries(Object.keys(localeData).sort().map((k) => [k, localeData[k]]))
  fs.writeFileSync(localePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
  console.log(`${locale}: merged ${merged} ai.* key(s) from ${file} (${Object.keys(pack).length} in pack)`)
}

if (exitCode !== 0) process.exit(exitCode)
console.log('apply-ai-locale-packs: OK')
