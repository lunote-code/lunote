/**
 * CI guard: emoji picker dialog copy must be localized (not hard-coded English).
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

function testEmojiPickerUsesI18nModule() {
  const picker = fs.readFileSync(path.join(root, 'src/editor/lunaEmojiPicker.ts'), 'utf8')
  assert(picker.includes('readEmojiPickerCopy'), 'lunaEmojiPicker must use readEmojiPickerCopy')
  assert(!picker.includes('Search emoji or symbols'), 'lunaEmojiPicker must not hard-code search placeholder')
  assert(!picker.includes("'No matches'"), 'lunaEmojiPicker must not hard-code empty state')
}

function testEmojiPickerI18nKeys() {
  const en = readJson('src/i18n/locales/en.json')
  for (const key of ['editor.emoji.searchPlaceholder', 'editor.emoji.noMatches', 'editor.slash.emoji']) {
    assert(typeof en[key] === 'string' && en[key].trim(), `en.json missing ${key}`)
  }
}

const tests = [
  ['emoji picker uses i18n module', testEmojiPickerUsesI18nModule],
  ['emoji picker i18n keys', testEmojiPickerI18nKeys],
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
  console.error(`\n${failed} emoji picker i18n contract test(s) failed`)
} else {
  console.log(`\n${tests.length} emoji picker i18n contract test(s) passed`)
}
