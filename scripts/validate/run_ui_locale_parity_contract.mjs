/**
 * CI guard: every non-en UI / shell locale must include all keys from en.json.
 * Catches new en.json keys before they silently fall back to English at runtime.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
}

function listLocaleFiles(relDir) {
  return fs
    .readdirSync(path.join(root, relDir))
    .filter((name) => name.endsWith('.json') && name !== 'en.json')
    .map((name) => name.replace(/\.json$/, ''))
    .sort()
}

function testUiLocaleKeyParity() {
  const en = readJson('src/i18n/locales/en.json')
  const enKeys = new Set(Object.keys(en).filter((k) => !k.startsWith('meta.')))
  const locales = listLocaleFiles('src/i18n/locales')

  assert(locales.length >= 10, 'expected at least 10 UI locale files besides en.json')

  for (const locale of locales) {
    const raw = readJson(`src/i18n/locales/${locale}.json`)

    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith('meta.')) continue
      assert(enKeys.has(key), `${locale}.json has unknown UI key: ${key}`)
      assert(String(value).trim().length > 0, `${locale}.json has empty UI value for ${key}`)
    }

    const extra = Object.keys(raw).filter((k) => !k.startsWith('meta.') && !(k in en))
    assert(
      extra.length === 0,
      `${locale}.json has ${extra.length} unknown UI key(s): ${extra.slice(0, 8).join(', ')}${
        extra.length > 8 ? '…' : ''
      }`,
    )
  }
}

function testShellMenuKeyParity() {
  const en = readJson('src-tauri/i18n/en.json')
  const enMenu = en.menu
  assert(enMenu && typeof enMenu === 'object', 'src-tauri/i18n/en.json must define menu section')
  const enKeys = Object.keys(enMenu)
  const locales = listLocaleFiles('src-tauri/i18n')

  for (const locale of locales) {
    const raw = readJson(`src-tauri/i18n/${locale}.json`)
    const menu = raw.menu
    assert(menu && typeof menu === 'object', `${locale}.json must define menu section`)

    const missing = enKeys.filter((k) => typeof menu[k] !== 'string' || !String(menu[k]).trim())
    assert(
      missing.length === 0,
      `${locale}.json menu missing ${missing.length} key(s): ${missing.slice(0, 8).join(', ')}${
        missing.length > 8 ? '…' : ''
      }`,
    )
  }
}

function testApplyLocaleGapScriptExists() {
  const script = fs.readFileSync(path.join(root, 'scripts/locale/apply_ui_locale_gaps_2026.mjs'), 'utf8')
  assert(script.includes('ui_locale_gaps_2026.json'), 'apply_ui_locale_gaps_2026 must merge primary gap batch')
  assert(
    script.includes('ui_locale_gaps_supplement_2026b.json'),
    'apply_ui_locale_gaps_2026 must merge supplement gap batch',
  )
}

const tests = [
  ['UI locale key parity', testUiLocaleKeyParity],
  ['shell menu key parity', testShellMenuKeyParity],
  ['locale gap merge script wiring', testApplyLocaleGapScriptExists],
]

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`fail ${name}: ${error instanceof Error ? error.message : error}`)
  }
}

if (failed > 0) {
  process.exitCode = 1
  console.error(`\n${failed} UI locale parity contract test(s) failed`)
} else {
  console.log(`\n${tests.length} UI locale parity contract test(s) passed`)
}
