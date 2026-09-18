#!/usr/bin/env node
/**
 * Rebuild src/i18n/locales/*.json to full sparse coverage:
 * 1) build_ui_locales.py (corpus + gaps + patches)
 * 2) apply_ui_locale_gaps_2026 batches
 * 3) all scripts/locale_corpus/data/*.json gap batches
 * 4) apply-ai-locale-packs.mjs
 * 5) apply_locale_polish_batch.mjs (UX polish overrides)
 * 6) refresh meta.* authenticity fields
 * 7) sync_shell_menu_from_ui.py
 * 8) persist_shipped_to_gaps.py (keep corpus gaps in sync for CI bare build)
 *
 * Run: node scripts/locale/rebuild_shipped_locales.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const localesDir = path.join(root, 'src/i18n/locales')
const dataDir = path.join(root, 'scripts/locale_corpus/data')
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'))
const enKeys = Object.keys(en).filter((k) => !k.startsWith('meta.'))

function run(cmd, args, label) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0) {
    console.error(`\n${label} failed (exit ${result.status})`)
    if (result.stdout) console.error(result.stdout)
    if (result.stderr) console.error(result.stderr)
    process.exit(result.status ?? 1)
  }
  console.log(`${label}: OK`)
}

function mergeBatch(batchPath, { overwrite = false } = {}) {
  if (!fs.existsSync(batchPath)) return 0
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'))
  let total = 0
  for (const [locale, entries] of Object.entries(batch)) {
    const localePath = path.join(localesDir, `${locale}.json`)
    if (!fs.existsSync(localePath)) continue
    const raw = JSON.parse(fs.readFileSync(localePath, 'utf8'))
    let added = 0
    for (const [key, value] of Object.entries(entries)) {
      if (!(key in en)) continue
      const prev = raw[key]
      if (overwrite || prev === undefined || String(prev).trim() === '') {
        if (prev !== value) {
          raw[key] = value
          added += 1
        }
      }
    }
    if (added > 0) {
      const sorted = Object.fromEntries(Object.keys(raw).sort().map((k) => [k, raw[k]]))
      fs.writeFileSync(localePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
    }
    console.log(`${locale}: +${added} (${path.basename(batchPath)})`)
    total += added
  }
  return total
}

function refreshMeta() {
  for (const file of fs.readdirSync(localesDir).filter((n) => n.endsWith('.json') && n !== 'en.json')) {
    const localePath = path.join(localesDir, file)
    const raw = JSON.parse(fs.readFileSync(localePath, 'utf8'))
    let translated = 0
    let fallback = 0
    let missing = 0
    for (const key of enKeys) {
      if (!(key in raw)) missing += 1
      else if (raw[key] === en[key]) fallback += 1
      else translated += 1
    }
    const total = enKeys.length
    const pct = (n) => String(Math.round((100 * n) / total))
    raw['meta.translated'] = pct(translated)
    raw['meta.fallback'] = pct(fallback)
    raw['meta.missing'] = pct(missing)
    raw['meta.completion'] = pct(translated)
    const ordered = {}
    for (const mk of ['meta.nativeName', 'meta.translated', 'meta.fallback', 'meta.missing', 'meta.completion']) {
      if (mk in raw) ordered[mk] = raw[mk]
    }
    for (const k of Object.keys(raw).sort()) {
      if (!k.startsWith('meta.')) ordered[k] = raw[k]
    }
    fs.writeFileSync(localePath, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8')
    console.log(`${file.replace('.json', '')}: meta translated=${ordered['meta.translated']}% missing=${ordered['meta.missing']}%`)
  }
}

console.log('==> build_ui_locales.py')
run('python3', ['scripts/locale/build_ui_locales.py'], 'build_ui_locales')

console.log('\n==> apply_ui_locale_gaps_2026.mjs')
run('node', ['scripts/locale/apply_ui_locale_gaps_2026.mjs'], 'apply_ui_locale_gaps_2026')

console.log('\n==> merge data gap batches')
const skip = new Set(['native_ux_polish_2026.json', '.ui_missing_gaps_cache.json'])
let batchTotal = 0
for (const name of fs.readdirSync(dataDir).filter((n) => n.endsWith('.json') && !skip.has(n)).sort()) {
  batchTotal += mergeBatch(path.join(dataDir, name))
}
console.log(`gap batches merged: ${batchTotal} key updates`)

console.log('\n==> apply-ai-locale-packs.mjs')
run('node', ['scripts/locale/apply-ai-locale-packs.mjs'], 'apply-ai-locale-packs')

console.log('\n==> generate_zh_tw_polish_2026.py')
run('python3', ['scripts/locale/generate_zh_tw_polish_2026.py'], 'generate_zh_tw_polish')

console.log('\n==> merge zh-TW polish (overwrite ai pack regressions)')
mergeBatch(path.join(dataDir, 'chinese_ux_polish_zh_tw_2026.json'), { overwrite: true })

console.log('\n==> cleanup stale locale keys')
const staleAiKeys = [
  'ai.editor.blockAi.doneExplainCode',
  'ai.editor.blockAi.doneSimplify',
  'ai.editor.blockAi.doneToList',
  'ai.editor.blockAi.failed',
  'ai.editor.blockAi.insertFailed',
]
const migrateAi = {
  'ai.editor.blockAi.doneSimplify': 'ai.editor.directApply.doneSimplify',
  'ai.editor.blockAi.doneToList': 'ai.editor.directApply.doneToList',
  'ai.editor.blockAi.doneExplainCode': 'ai.editor.directApply.doneExplainCode',
  'ai.editor.blockAi.failed': 'ai.editor.directApply.failed',
}
for (const file of fs.readdirSync(localesDir).filter((n) => n.endsWith('.json') && n !== 'en.json')) {
  const localePath = path.join(localesDir, file)
  const raw = JSON.parse(fs.readFileSync(localePath, 'utf8'))
  let changed = false
  for (const [oldKey, newKey] of Object.entries(migrateAi)) {
    if (oldKey in raw && !(newKey in raw)) {
      raw[newKey] = raw[oldKey]
      changed = true
    }
  }
  for (const key of staleAiKeys) {
    if (key in raw) {
      delete raw[key]
      changed = true
    }
  }
  for (const key of Object.keys(raw)) {
    if (!key.startsWith('meta.') && !(key in en)) {
      delete raw[key]
      changed = true
    }
  }
  if (changed) {
    const sorted = Object.fromEntries(Object.keys(raw).sort().map((k) => [k, raw[k]]))
    fs.writeFileSync(localePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
    console.log(`${file}: cleaned stale keys`)
  }
}

console.log('\n==> apply_locale_polish_batch.mjs')
run('node', ['scripts/locale/apply_locale_polish_batch.mjs'], 'apply_locale_polish_batch')

console.log('\n==> menu gap batch (all locales)')
batchTotal += mergeBatch(path.join(dataDir, 'menu_gaps_2026.json'), { overwrite: true })

console.log('\n==> merge prefs terminology (zh-CN/zh-TW overwrite)')
mergeBatch(path.join(dataDir, 'chinese_terminology_prefs_2026.json'), { overwrite: true })

console.log('\n==> merge P0 UX polish (zh-CN/zh-TW overwrite)')
mergeBatch(path.join(dataDir, 'chinese_ux_polish_p0_2026.json'), { overwrite: true })

console.log('\n==> merge zh terminology + actionable copy (zh-CN/zh-TW overwrite)')
mergeBatch(path.join(dataDir, 'terminology_zh_2026.json'), { overwrite: true })

console.log('\n==> refresh meta.*')
refreshMeta()

console.log('\n==> sync_shell_menu_from_ui.py')
run('python3', ['scripts/locale/sync_shell_menu_from_ui.py'], 'sync_shell_menu')

console.log('\n==> persist_shipped_to_gaps.py')
run('python3', ['scripts/locale/persist_shipped_to_gaps.py'], 'persist_shipped_to_gaps')

console.log('\nrebuild_shipped_locales: done')
