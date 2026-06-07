#!/usr/bin/env node
/**
 * Generate macOS startup menu manifest for Rust boot install.
 * Run: node scripts/generate_mac_menu_boot.mjs
 * Output: src-tauri/resources/mac-menu-boot.json
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { build } from 'vite'

import {
  applyMacBootAcceleratorPatches,
  assertMacBootAcceleratorPatchesApplied,
} from './mac_menu_boot_accelerator_patches.mjs'

// mac-menu-boot.json is Darwin-only; never derive accelerators from Linux CI host.
process.env.CROSSPLATNOTE_FORCE_DESKTOP_PLATFORM = 'mac'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'src-tauri', 'resources', 'mac-menu-boot.json')
const entryPoint = path.join(ROOT, 'src/platform/tauri/macMenuBootExport.ts')
const outDir = path.join(ROOT, 'node_modules/.cache/mac-menu-boot-gen')
const outfile = path.join(outDir, 'macMenuBootExport.mjs')

const LOCALE_IDS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'de', 'fr', 'es', 'it', 'pt', 'ru']

async function loadLocaleMessages() {
  const messages = {}
  for (const locale of LOCALE_IDS) {
    const file = path.join(ROOT, 'src/i18n/locales', `${locale}.json`)
    const raw = JSON.parse(await fs.readFile(file, 'utf8'))
    messages[locale] = raw
  }
  return messages
}

await fs.mkdir(outDir, { recursive: true })
await fs.mkdir(path.dirname(OUT), { recursive: true })

await build({
  configFile: false,
  logLevel: 'silent',
  define: {
    'import.meta.env.DEV': 'true',
    'process.env.CROSSPLATNOTE_FORCE_DESKTOP_PLATFORM': JSON.stringify('mac'),
  },
  ssr: { noExternal: true },
  build: {
    ssr: entryPoint,
    outDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: { format: 'es', entryFileNames: path.basename(outfile) },
    },
  },
})

const mod = await import(pathToFileURL(outfile).href)
const localeMessages = await loadLocaleMessages()
const buildManifest = mod.buildAndValidateMacMenuBootManifest ?? mod.buildMacMenuBootManifest
const manifest = buildManifest(localeMessages)
applyMacBootAcceleratorPatches(manifest)
assertMacBootAcceleratorPatchesApplied(manifest)
if (typeof mod.assertMacMenuBootUsesMacAccelerators === 'function') {
  mod.assertMacMenuBootUsesMacAccelerators(manifest)
}
await fs.writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const labelCount = Object.values(manifest.labels).reduce((n, m) => Math.max(n, Object.keys(m).length), 0)
console.log(
  `generate_mac_menu_boot: wrote ${OUT} (${manifest.bar.length} bar groups, ${labelCount} labels/locale)`,
)
