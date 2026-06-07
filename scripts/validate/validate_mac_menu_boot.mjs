#!/usr/bin/env node
/**
 * Validate committed mac-menu-boot.json uses macOS accelerators (not host platform defaults).
 * Run: npm run validate:mac-menu-boot
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { build } from 'vite'

import { assertMacBootAcceleratorPatchesApplied } from '../build/mac_menu_boot_accelerator_patches.mjs'

process.env.CROSSPLATNOTE_FORCE_DESKTOP_PLATFORM = 'mac'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BOOT_JSON = path.join(ROOT, 'src-tauri', 'resources', 'mac-menu-boot.json')
const entryPoint = path.join(ROOT, 'src/platform/tauri/macMenuBootExport.ts')
const outDir = path.join(ROOT, 'node_modules/.cache/mac-menu-boot-validate')
const outfile = path.join(outDir, 'macMenuBootExport.mjs')

await fs.mkdir(outDir, { recursive: true })

await build({
  configFile: false,
  logLevel: 'silent',
  define: { 'import.meta.env.DEV': 'true' },
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
const raw = await fs.readFile(BOOT_JSON, 'utf8')
const manifest = JSON.parse(raw)

try {
  assertMacBootAcceleratorPatchesApplied(manifest)
  if (typeof mod.assertMacMenuBootUsesMacAccelerators === 'function') {
    mod.assertMacMenuBootUsesMacAccelerators(manifest)
  }
} catch (error) {
  console.error('validate_mac_menu_boot: FAILED')
  console.error(error instanceof Error ? error.message : error)
  console.error('Regenerate with: node scripts/build/generate_mac_menu_boot.mjs')
  process.exit(1)
}

console.log(`validate_mac_menu_boot: OK (${BOOT_JSON})`)
