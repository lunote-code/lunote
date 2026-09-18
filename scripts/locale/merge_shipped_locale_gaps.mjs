#!/usr/bin/env node
/**
 * Merge gap batch JSON files into src/i18n/locales/*.json (only missing/empty keys).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dataDir = path.join(root, 'scripts/locale_corpus/data')
const localesDir = path.join(root, 'src/i18n/locales')
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'))

const batchFiles = process.argv.slice(2).length
  ? process.argv.slice(2).map((name) => path.join(dataDir, name))
  : [
      path.join(dataDir, 'missing_ui_keys_batch.json'),
      path.join(dataDir, 'plugins_i18n_es_pt_it_ru.json'),
      path.join(dataDir, 'plugins_ui_i18n.json'),
    ]

function mergeBatch(batchPath) {
  if (!fs.existsSync(batchPath)) {
    console.error(`skip missing batch: ${batchPath}`)
    return 0
  }
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'))
  let totalAdded = 0
  for (const [locale, entries] of Object.entries(batch)) {
    const localePath = path.join(localesDir, `${locale}.json`)
    if (!fs.existsSync(localePath)) {
      console.error(`skip missing locale file: ${locale}`)
      continue
    }
    const raw = JSON.parse(fs.readFileSync(localePath, 'utf8'))
    let added = 0
    for (const [key, value] of Object.entries(entries)) {
      if (!(key in en)) continue
      const prev = raw[key]
      if (prev === undefined || String(prev).trim() === '') {
        raw[key] = value
        added += 1
      }
    }
    if (added > 0) {
      const sorted = Object.fromEntries(Object.keys(raw).sort().map((k) => [k, raw[k]]))
      fs.writeFileSync(localePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
    }
    console.log(`${locale}: merged ${added} keys (${path.basename(batchPath)})`)
    totalAdded += added
  }
  return totalAdded
}

let total = 0
for (const batchPath of batchFiles) {
  total += mergeBatch(batchPath)
}
console.log(`done: ${total} keys merged`)
