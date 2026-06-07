#!/usr/bin/env node
/**
 * CI/release guard: iconRegistry ↔ macMenuIconLucide ↔ committed PNG assets.
 * Run: npm run validate:mac-menu-assets
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { build } from 'vite'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const entryPoint = path.join(workspaceRoot, 'src/platform/tauri/macMenuIconConsistencyHarness.ts')
const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cpn-mac-menu-icon-validate-'))
const outfile = path.join(outDir, 'macMenuIconConsistencyHarness.mjs')

const iconRegistrySource = await fs.readFile(
  path.join(workspaceRoot, 'src/design-system/icons/iconRegistry.ts'),
  'utf8',
)
const lucideDtsSource = await fs.readFile(
  path.join(workspaceRoot, 'node_modules/lucide-react/dist/lucide-react.d.ts'),
  'utf8',
)
const exportScriptSource = await fs.readFile(
  path.join(workspaceRoot, 'scripts/build/export_mac_menu_icons.mjs'),
  'utf8',
)

const macMenuIconsDir = path.join(workspaceRoot, 'public', 'mac-menu-icons')
let macMenuPngBasenames = []
try {
  macMenuPngBasenames = (await fs.readdir(macMenuIconsDir)).filter((name) => name.endsWith('.png'))
} catch {
  console.error(
    'validate_mac_menu_assets: missing public/mac-menu-icons/. Run: npm run export:mac-menu-icons && commit PNGs.',
  )
  process.exit(1)
}

const lucideIconsDir = path.join(
  workspaceRoot,
  'node_modules',
  'lucide-react',
  'dist',
  'esm',
  'icons',
)
const lucideIconStems = new Set(
  (await fs.readdir(lucideIconsDir))
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => name.replace(/\.mjs$/, '')),
)

try {
  await build({
    configFile: false,
    logLevel: 'silent',
    define: {
      'import.meta.env.DEV': 'true',
    },
    ssr: {
      noExternal: true,
    },
    build: {
      ssr: entryPoint,
      outDir,
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      rollupOptions: {
        output: {
          format: 'es',
          entryFileNames: path.basename(outfile),
        },
      },
    },
  })

  const harness = await import(pathToFileURL(outfile).href)
  const { results } = harness.assertMacMenuIconConsistencySuite({
    iconRegistrySource,
    lucideDtsSource,
    macMenuPngBasenames,
    exportScriptSource,
    lucideIconStems,
  })
  console.log(harness.formatMacMenuIconConsistencySummary(results))
  if (results.some((r) => !r.ok)) process.exit(1)
} finally {
  await fs.rm(outDir, { recursive: true, force: true })
}
