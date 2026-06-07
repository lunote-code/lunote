#!/usr/bin/env node
/**
 * Export PNG menu icons for macOS native menus (16×16 @2x → 32×32).
 *
 * Stems are loaded from src/platform/tauri/macMenuIconLucide.ts (single source of truth).
 *
 * Run: node scripts/export_mac_menu_icons.mjs
 * Output: public/mac-menu-icons/<semantic>.png
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import puppeteer from 'puppeteer-core'
import { build } from 'vite'

import { defaultChromeExecutable } from '../lib/chrome-executable-candidates.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT_DIR = path.join(ROOT, 'public', 'mac-menu-icons')
const LUCIDE_DIR = path.join(ROOT, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons')
const ICON_LUCIDE_ENTRY = path.join(ROOT, 'src/platform/tauri/macMenuIconLucide.ts')
const ICON_LUCIDE_CACHE_DIR = path.join(ROOT, 'node_modules/.cache/mac-menu-icon-export-gen')
const ICON_LUCIDE_OUTFILE = path.join(ICON_LUCIDE_CACHE_DIR, 'macMenuIconLucide.mjs')
const SIZE = 32
/** Pure black + alpha — macOS template images ignore RGB and use alpha only. */
const STROKE = '#000000'
const STROKE_WIDTH = 2.25
const ICON_INSET = 4

async function loadSemanticStemsFromSource() {
  await fs.mkdir(ICON_LUCIDE_CACHE_DIR, { recursive: true })
  await build({
    configFile: false,
    logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'true' },
    ssr: { noExternal: true },
    build: {
      ssr: ICON_LUCIDE_ENTRY,
      outDir: ICON_LUCIDE_CACHE_DIR,
      emptyOutDir: true,
      minify: false,
      rollupOptions: {
        output: { format: 'es', entryFileNames: path.basename(ICON_LUCIDE_OUTFILE) },
      },
    },
  })

  const mod = await import(pathToFileURL(ICON_LUCIDE_OUTFILE).href)
  const stems = mod.MAC_MENU_SEMANTIC_LUCIDE_STEM
  if (!stems || typeof stems !== 'object') {
    throw new Error('MAC_MENU_SEMANTIC_LUCIDE_STEM missing from macMenuIconLucide.ts bundle')
  }
  return stems
}

function attrsToString(attrs) {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ')
}

function iconNodeToSvg(iconNode) {
  const body = iconNode
    .map(([tag, attrs]) => `<${tag} ${attrsToString(attrs)} />`)
    .join('')
  const pad = ICON_INSET
  const inner = SIZE - pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <g transform="translate(${pad} ${pad}) scale(${inner / 24})" fill="none" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </g>
</svg>`
}

/** Line-art app logo — must NOT use the filled 32×32 app icon (template → white blob). */
function appMarkSvg() {
  const pad = ICON_INSET
  const inner = SIZE - pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <g transform="translate(${pad} ${pad}) scale(${inner / 24})" fill="none" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7.25 4.75h6.5L18.25 9v10.25H7.25z" />
    <path d="M13.75 4.75V9h4.5" />
    <path d="M8.75 15.75h4.5l2.5-3.5" />
    <circle cx="8.75" cy="15.75" r="1.45" />
    <circle cx="13.25" cy="15.75" r="1.45" />
    <circle cx="15.75" cy="12.25" r="1.45" />
  </g>
</svg>`
}

async function screenshotSvg(page, svg, outPath) {
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
    { waitUntil: 'load', timeout: 10_000 },
  )
  const png = await page.screenshot({
    type: 'png',
    omitBackground: true,
    clip: { x: 0, y: 0, width: SIZE, height: SIZE },
  })
  await fs.writeFile(outPath, png)
}

async function loadIconNode(stem, seen = new Set()) {
  if (seen.has(stem)) {
    throw new Error(`circular lucide icon alias: ${stem}`)
  }
  seen.add(stem)

  const modPath = path.join(LUCIDE_DIR, `${stem}.mjs`)
  const source = await fs.readFile(modPath, 'utf8')
  const reexport = source.match(/export \{ default \} from '\.\/(.+)\.mjs'/)
  if (reexport) {
    return loadIconNode(reexport[1], seen)
  }

  const mod = await import(pathToFileURL(modPath).href)
  if (!mod.__iconNode) {
    throw new Error(`missing __iconNode in ${modPath}`)
  }
  return mod.__iconNode
}

async function main() {
  const semanticStems = await loadSemanticStemsFromSource()
  await fs.mkdir(OUT_DIR, { recursive: true })

  const executablePath = defaultChromeExecutable()
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 })

    let exported = 0
    for (const [semantic, stem] of Object.entries(semanticStems)) {
      if (!stem) {
        throw new Error(`missing lucide stem for semantic icon: ${semantic}`)
      }
      const iconNode = await loadIconNode(stem)
      const svg = iconNodeToSvg(iconNode)
      await screenshotSvg(page, svg, path.join(OUT_DIR, `${semantic}.png`))
      exported++
    }

    await screenshotSvg(page, appMarkSvg(), path.join(OUT_DIR, 'app-mark.png'))
    exported++

    console.log(
      `export_mac_menu_icons: wrote ${exported} PNGs to public/mac-menu-icons/ (${Object.keys(semanticStems).length} semantic + app-mark)`,
    )
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
