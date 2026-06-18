/**
 * CI guard: shortcut-related locale copy must not embed duplicate or cross-platform drift.
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
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort()
}

const EMBEDDED_FOCUS_SHORTCUT = /(?:Cmd|Ctrl|Strg|⌘).*(?:\+|＋|Shift|Maj|Maiusc|Mayús|Umschalt)/i

function testFocusTitlesOmitEmbeddedShortcuts() {
  for (const localeId of listLocaleFiles('src/i18n/locales')) {
    const locale = readJson(`src/i18n/locales/${localeId}.json`)
    for (const key of ['app.focus.exit', 'app.focusMode.title']) {
      const value = locale[key]
      assert(typeof value === 'string' && value.trim(), `${localeId}: missing ${key}`)
      assert(
        !EMBEDDED_FOCUS_SHORTCUT.test(value),
        `${localeId}: ${key} must not embed shortcut copy (AppEditorMain appends toggle-focus display)`,
      )
    }
  }
}

function testLinkRevealKeysPresent() {
  const en = readJson('src/i18n/locales/en.json')
  for (const key of ['editor.linkRevealCmdClick', 'editor.linkRevealCtrlClick']) {
    assert(typeof en[key] === 'string' && en[key].trim(), `en.json missing ${key}`)
  }

  const editor = fs.readFileSync(path.join(root, 'src/editor/TiptapMarkdownEditor.tsx'), 'utf8')
  assert(editor.includes('editor.linkRevealCmdClick'), 'TiptapMarkdownEditor must use linkRevealCmdClick i18n key')
  assert(editor.includes('editor.linkRevealCtrlClick'), 'TiptapMarkdownEditor must use linkRevealCtrlClick i18n key')
}

function testToolbarModeHintsUseCollapsibleToken() {
  for (const localeId of listLocaleFiles('src/i18n/locales')) {
    const locale = readJson(`src/i18n/locales/${localeId}.json`)
    for (const key of ['app.toolbar.modeToSource', 'app.toolbar.modeToVisual']) {
      const value = locale[key]
      if (typeof value !== 'string') continue
      if (!value.includes('⌘')) continue
      const hasCollapsible =
        value.includes('(⌘/Ctrl+/)') || value.includes('（⌘/Ctrl+/）')
      assert(
        hasCollapsible,
        `${localeId}: ${key} must use collapsible (⌘/Ctrl+/) token, got: ${value}`,
      )
      const hasBareAscii = value.includes('(⌘/)') && !value.includes('(⌘/Ctrl+/)')
      const hasBareFullwidth = value.includes('（⌘/）') && !value.includes('（⌘/Ctrl+/）')
      assert(!hasBareAscii && !hasBareFullwidth, `${localeId}: ${key} still has bare (⌘/) shortcut hint`)
    }
  }
}

function testPlatformShortcutHintTokens() {
  const helper = fs.readFileSync(path.join(root, 'src/i18n/platformShortcutHint.ts'), 'utf8')
  assert(helper.includes("token: '(⌘/)'"), 'platformShortcutHint must collapse (⌘/) for Win/Linux')
  const emoji = fs.readFileSync(path.join(root, 'src/platform/emojiPanelHint.ts'), 'utf8')
  assert(
    emoji.includes('resolvePlatformShortcutHintText'),
    'emojiPanelHint must collapse shortcut tokens at read time',
  )
  assert(emoji.includes('getDesktopPlatformForHints'), 'emojiPanelHint must avoid web generic triple-list fallback')
}

const tests = [
  ['focus titles omit embedded shortcuts', testFocusTitlesOmitEmbeddedShortcuts],
  ['link reveal i18n keys', testLinkRevealKeysPresent],
  ['toolbar mode hints use collapsible token', testToolbarModeHintsUseCollapsibleToken],
  ['platform shortcut hint wiring', testPlatformShortcutHintTokens],
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
  console.error(`\n${failed} shortcut hint locale contract test(s) failed`)
} else {
  console.log(`\n${tests.length} shortcut hint locale contract test(s) passed`)
}
