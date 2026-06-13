#!/usr/bin/env node
/**
 * Capture plugin catalog screenshots and icons under docs/theme-plugin-example/media/.
 *
 * Uses the English QA playground (?qa=plugin-catalog-media&locale=en).
 * Requires the Vite dev server (started automatically unless reuseExistingServer applies).
 *
 *   npm run plugin-catalog:capture-media
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXAMPLE = path.join(ROOT, 'docs/theme-plugin-example')
const CATALOG_PLUGINS = path.join(EXAMPLE, 'catalog/plugins')
const INSTALLED = path.join(EXAMPLE, 'installed')
const MEDIA = path.join(EXAMPLE, 'media')
const PORT = Number(process.env.PORT || 5173)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`

const PLUGIN_ICON_COLORS = {
  'reading-comfort-pack': '#8b6f47',
  'compact-workspace-pack': '#4b5563',
  'tokyo-night-pack': '#7aa2f7',
  'forest-dawn-pack': '#4a6741',
  'midnight-aurora-pack': '#38bdba',
  'sakura-breeze-pack': '#d4849a',
  'cobalt-dusk-pack': '#3b82f6',
  'graphite-noir-pack': '#6b7280',
  'ocean-glass-pack': '#0891b2',
  'link-accent-pack': '#2563eb',
  'serif-headings-pack': '#7c6a58',
  'reading-edge-pack': '#0d9488',
  'warm-selection-pack': '#c2410c',
  'code-clarity-pack': '#334155',
}

function inferThemeMode(css) {
  const hasDark = /html\[data-theme=['"]dark['"]\]/u.test(css)
  const hasLight = /html\[data-theme=['"]light['"]\]/u.test(css)
  if (hasLight && !hasDark) return 'light'
  if (hasDark && !hasLight) return 'dark'
  return 'dark'
}

function inferAccentColor(css, fallback = '#64748b') {
  const match = css.match(/--accent:\s*([^;]+);/u)
  return match?.[1]?.trim() || fallback
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8')
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath))
}

async function listPluginIds() {
  const entries = await fs.readdir(CATALOG_PLUGINS)
  return entries
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/u, ''))
    .sort()
}

async function buildPackConfig(pluginId) {
  const manifestPath = path.join(INSTALLED, pluginId, 'plugin.json')
  const manifest = await readJson(manifestPath)
  const theme = manifest.contributes?.theme ?? {}
  const installedRoot = path.join(INSTALLED, pluginId)

  let externalCss = ''
  let externalCssFile = ''
  const snippets = {}
  const enabledSnippets = []
  let customThemeJSON = ''
  let themeActive = 'github-dark'

  for (const entry of theme.style ?? []) {
    const cssPath = path.join(installedRoot, entry.file)
    externalCss = await readText(cssPath)
    externalCssFile = path.basename(entry.file)
    themeActive = inferThemeMode(externalCss) === 'light' ? 'github-light' : 'github-dark'
  }

  for (const entry of theme.snippets ?? []) {
    const cssPath = path.join(installedRoot, entry.file)
    const css = await readText(cssPath)
    const snippetId = entry.id || path.basename(entry.file, '.css')
    snippets[snippetId] = css
    enabledSnippets.push(snippetId)
  }

  if (!externalCss && enabledSnippets.length > 0) {
    const firstSnippetCss = snippets[enabledSnippets[0]] ?? ''
    themeActive = inferThemeMode(firstSnippetCss) === 'light' ? 'github-light' : 'github-dark'
  }

  let tokenThemeId = ''
  for (const entry of theme.tokens ?? []) {
    const tokenPath = path.join(installedRoot, entry.file)
    const tokenJson = await readText(tokenPath)
    customThemeJSON = tokenJson
    const parsed = JSON.parse(tokenJson)
    tokenThemeId = typeof parsed.id === 'string' ? parsed.id : ''
    if (!externalCss && tokenThemeId) {
      themeActive = tokenThemeId
    } else if (parsed.variant === 'light') {
      themeActive = 'github-light'
    } else if (parsed.variant === 'dark') {
      themeActive = 'github-dark'
    }
  }

  return {
    themeActive,
    customThemeJSON,
    externalCss,
    externalCssFile,
    snippets,
    enabledSnippets,
  }
}

async function waitForMediaQa(page) {
  await page.goto(`${BASE_URL}/?qa=plugin-catalog-media&locale=en`)
  await page.getByTestId('qa-ready').waitFor({ state: 'attached', timeout: 60_000 })
  await page.waitForFunction(() => window.__QA_PLUGIN_CATALOG_MEDIA__?.getStatus() === 'ready', null, {
    timeout: 60_000,
  })
}

async function applyPack(page, config) {
  await page.evaluate(async (payload) => {
    await window.__QA_PLUGIN_CATALOG_MEDIA__?.applyPack(payload)
  }, config)
  await page.waitForTimeout(350)
}

async function captureFrame(page, targetPath, clipSelector = '[data-testid="plugin-media-capture-frame"]') {
  const locator = page.locator(clipSelector)
  await locator.waitFor({ state: 'visible', timeout: 30_000 })
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await locator.screenshot({ path: targetPath, type: 'png' })
}

async function captureSidebar(page, targetPath) {
  const locator = page.locator('[data-testid="plugin-media-capture-frame"] .sidebar')
  await locator.waitFor({ state: 'visible', timeout: 30_000 })
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await locator.screenshot({ path: targetPath, type: 'png' })
}

async function renderPluginIcon(page, pluginId, pluginName, accent) {
  const initial = pluginName.trim().charAt(0).toUpperCase() || 'P'
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; background: transparent; }
    .icon {
      width: var(--size);
      height: var(--size);
      border-radius: calc(var(--size) * 0.22);
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, color-mix(in srgb, ${accent} 72%, #ffffff 28%), color-mix(in srgb, ${accent} 88%, #000000 12%));
      color: #fff;
      font: 700 calc(var(--size) * 0.45)/1 system-ui, -apple-system, Segoe UI, sans-serif;
      letter-spacing: -0.04em;
      box-shadow: 0 10px 28px color-mix(in srgb, ${accent} 28%, transparent);
    }
  </style></head><body><div class="icon"></div></body></html>`

  const outDir = path.join(MEDIA, pluginId)
  await fs.mkdir(outDir, { recursive: true })

  let icon128Buffer = null
  for (const size of [128, 32]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      html.replace('<div class="icon"></div>', `<div class="icon" style="--size:${size}px">${initial}</div>`),
      { waitUntil: 'load' },
    )
    const buffer = await page.locator('.icon').screenshot({
      type: 'png',
      omitBackground: true,
    })
    const target =
      size === 128
        ? path.join(outDir, 'icon@128.png')
        : path.join(outDir, 'icon@32.png')
    await fs.writeFile(target, buffer)
    if (size === 128) icon128Buffer = buffer
  }

  if (icon128Buffer) {
    await fs.writeFile(path.join(outDir, 'icon.png'), icon128Buffer)
  }
}

async function capturePreferencesPluginDetail(page, pluginId, targetPath) {
  const detail = await readJson(path.join(CATALOG_PLUGINS, `${pluginId}.json`))
  const indexEntry = {
    id: detail.id,
    name: detail.name,
    author: detail.author?.name ?? 'Lunote Examples',
    tagline: detail.description,
    category: 'appearance',
    latestVersion: detail.versions?.[0]?.version ?? '1.0.0',
    detailUrl: `./plugins/${pluginId}.json`,
    pluginType: detail.pluginType,
    capabilities: detail.capabilities,
    platforms: detail.platforms,
    verified: true,
  }

  await page.route('**/catalog/index.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ schemaVersion: 2, plugins: [indexEntry] }),
    })
  })

  await page.route(`**/catalog/plugins/${pluginId}.json`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detail),
    })
  })

  await page.goto(`${BASE_URL}/?qa=preferences&locale=en`)
  await page.getByTestId('qa-ready').waitFor({ state: 'attached', timeout: 60_000 })
  await page.waitForFunction(() => window.__QA_PREFERENCES__?.getSetting != null, null, { timeout: 60_000 })
  await page.evaluate(() => window.__QA_PREFERENCES__?.open('plugins'))
  const dialog = page.locator('dialog.prefs-dialog[open]')
  await dialog.waitFor({ state: 'attached', timeout: 30_000 })
  await page.evaluate(() => {
    const prefsDialog = document.querySelector('dialog.prefs-dialog[open]')
    if (prefsDialog instanceof HTMLElement) {
      prefsDialog.style.opacity = '1'
      prefsDialog.style.display = 'block'
      prefsDialog.style.position = 'fixed'
      prefsDialog.style.inset = '24px'
      prefsDialog.style.margin = '0'
      prefsDialog.style.width = 'auto'
      prefsDialog.style.height = 'auto'
      prefsDialog.style.maxWidth = 'none'
    }
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    document.querySelector('.prefs-plugin-card-open')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
  })
  await page.locator('.prefs-plugin-detail').waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(400)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await page.locator('.prefs-plugin-detail').screenshot({ path: targetPath, type: 'png' })
}

async function capturePluginMedia(browser, pluginId) {
  const detail = await readJson(path.join(CATALOG_PLUGINS, `${pluginId}.json`))
  const manifest = await readJson(path.join(INSTALLED, pluginId, 'plugin.json'))
  const packConfig = await buildPackConfig(pluginId)
  const accent =
    PLUGIN_ICON_COLORS[pluginId] ||
    inferAccentColor(packConfig.externalCss || Object.values(packConfig.snippets)[0] || '', '#64748b')

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  try {
    await renderPluginIcon(page, pluginId, detail.name || manifest.name, accent)

    const screenshots = detail.media?.screenshots ?? []
    if (screenshots.length === 0) {
      console.log(`[skip] ${pluginId}: no screenshots declared`)
      return
    }

    const needsSettings = screenshots.some(
      (shot) => shot.url.includes('settings.png') || shot.url.includes('preferences.png'),
    )
    const needsSidebar = screenshots.some((shot) => shot.url.includes('sidebar.png'))
    const needsEditor = screenshots.some(
      (shot) =>
        shot.url.includes('editor.png') ||
        shot.url.includes('preview.png'),
    )

    if (needsEditor || needsSidebar) {
      await waitForMediaQa(page)
      await applyPack(page, packConfig)
    }

    for (const shot of screenshots) {
      const relative = shot.url.replace(/^\/media\//u, '')
      const targetPath = path.join(EXAMPLE, 'media', relative)

      if (shot.url.endsWith('settings.png') || shot.url.endsWith('preferences.png')) {
        await capturePreferencesPluginDetail(page, pluginId, targetPath)
        console.log(`[ok] ${pluginId}: ${relative}`)
        continue
      }

      if (shot.url.endsWith('sidebar.png')) {
        await captureSidebar(page, targetPath)
        console.log(`[ok] ${pluginId}: ${relative}`)
        continue
      }

      await captureFrame(page, targetPath)
      console.log(`[ok] ${pluginId}: ${relative}`)
    }
  } finally {
    await page.close()
  }
}

async function ensureDevServer() {
  try {
    const response = await fetch(`${BASE_URL}/`)
    if (response.ok) return
  } catch {
    /* start below */
  }
  throw new Error(
    `Dev server is not reachable at ${BASE_URL}. Start it with "npm run dev" in another terminal, then rerun.`,
  )
}

async function main() {
  await ensureDevServer()
  const pluginIds = await listPluginIds()
  const browser = await chromium.launch({ headless: true })

  try {
    for (const pluginId of pluginIds) {
      await capturePluginMedia(browser, pluginId)
    }
    console.log(`Captured media for ${pluginIds.length} plugins → ${MEDIA}`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
