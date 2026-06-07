#!/usr/bin/env node
/**
 * Rasterize src-tauri/icons/icon.svg to PNGs for desktop / iOS / Android exports.
 * Single visual source of truth — macOS, Windows, Linux, ios/, android/ stay aligned.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'

import { defaultChromeExecutable } from '../lib/chrome-executable-candidates.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ICON_SVG = path.join(ROOT, 'src-tauri/icons/icon.svg')
const ICON_DIR = path.join(ROOT, 'src-tauri/icons')

/** @type {Array<{ rel: string, size: number }>} */
const EXPORT_TARGETS = [
  // Desktop bundle (Tauri)
  { rel: '16x16.png', size: 16 },
  { rel: '32x32.png', size: 32 },
  { rel: '48x48.png', size: 48 },
  { rel: '64x64.png', size: 64 },
  { rel: '128x128.png', size: 128 },
  { rel: '256x256.png', size: 256 },
  { rel: '512x512.png', size: 512 },
  { rel: '1024x1024.png', size: 1024 },

  // iOS (legacy folder kept in sync with desktop artwork)
  { rel: 'ios/AppIcon-20x20@1x.png', size: 20 },
  { rel: 'ios/AppIcon-20x20@2x.png', size: 40 },
  { rel: 'ios/AppIcon-20x20@2x-1.png', size: 40 },
  { rel: 'ios/AppIcon-20x20@3x.png', size: 60 },
  { rel: 'ios/AppIcon-29x29@1x.png', size: 29 },
  { rel: 'ios/AppIcon-29x29@2x.png', size: 58 },
  { rel: 'ios/AppIcon-29x29@2x-1.png', size: 58 },
  { rel: 'ios/AppIcon-29x29@3x.png', size: 87 },
  { rel: 'ios/AppIcon-40x40@1x.png', size: 40 },
  { rel: 'ios/AppIcon-40x40@2x.png', size: 80 },
  { rel: 'ios/AppIcon-40x40@2x-1.png', size: 80 },
  { rel: 'ios/AppIcon-40x40@3x.png', size: 120 },
  { rel: 'ios/AppIcon-60x60@2x.png', size: 120 },
  { rel: 'ios/AppIcon-60x60@3x.png', size: 180 },
  { rel: 'ios/AppIcon-76x76@1x.png', size: 76 },
  { rel: 'ios/AppIcon-76x76@2x.png', size: 152 },
  { rel: 'ios/AppIcon-83.5x83.5@2x.png', size: 167 },
  { rel: 'ios/AppIcon-512@2x.png', size: 1024 },

  // Android mipmaps
  { rel: 'android/mipmap-mdpi/ic_launcher.png', size: 48 },
  { rel: 'android/mipmap-mdpi/ic_launcher_round.png', size: 48 },
  { rel: 'android/mipmap-mdpi/ic_launcher_foreground.png', size: 108 },
  { rel: 'android/mipmap-hdpi/ic_launcher.png', size: 72 },
  { rel: 'android/mipmap-hdpi/ic_launcher_round.png', size: 72 },
  { rel: 'android/mipmap-hdpi/ic_launcher_foreground.png', size: 162 },
  { rel: 'android/mipmap-xhdpi/ic_launcher.png', size: 96 },
  { rel: 'android/mipmap-xhdpi/ic_launcher_round.png', size: 96 },
  { rel: 'android/mipmap-xhdpi/ic_launcher_foreground.png', size: 216 },
  { rel: 'android/mipmap-xxhdpi/ic_launcher.png', size: 144 },
  { rel: 'android/mipmap-xxhdpi/ic_launcher_round.png', size: 144 },
  { rel: 'android/mipmap-xxhdpi/ic_launcher_foreground.png', size: 324 },
  { rel: 'android/mipmap-xxxhdpi/ic_launcher.png', size: 192 },
  { rel: 'android/mipmap-xxxhdpi/ic_launcher_round.png', size: 192 },
  { rel: 'android/mipmap-xxxhdpi/ic_launcher_foreground.png', size: 432 },
]

function svgForSize(svgSource, size) {
  return svgSource.replace(/<svg\b([^>]*)>/u, (_match, attrs) => {
    const cleaned = attrs
      .replace(/\swidth="[^"]*"/gu, '')
      .replace(/\sheight="[^"]*"/gu, '')
    return `<svg${cleaned} width="${size}" height="${size}">`
  })
}

async function screenshotSvg(page, svg, size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:transparent">${svg}</body></html>`,
    { waitUntil: 'load', timeout: 15_000 },
  )
  return page.screenshot({
    type: 'png',
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  })
}

const ALPHA_THRESHOLD = 8

/** Center opaque artwork in the canvas so taskbar/dock sizes stay optically balanced. */
function opticallyCenterPng(pngBuffer) {
  const source = PNG.sync.read(pngBuffer)
  const { width, height, data } = source
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha <= ALPHA_THRESHOLD) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) return pngBuffer

  const contentW = maxX - minX + 1
  const contentH = maxY - minY + 1
  const targetMinX = Math.floor((width - contentW) / 2)
  const targetMinY = Math.floor((height - contentH) / 2)
  const shiftX = targetMinX - minX
  const shiftY = targetMinY - minY
  if (shiftX === 0 && shiftY === 0) return pngBuffer

  const centered = new PNG({ width, height })
  centered.data.fill(0)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const srcIdx = (y * width + x) * 4
      const dstX = x + shiftX
      const dstY = y + shiftY
      if (dstX < 0 || dstY < 0 || dstX >= width || dstY >= height) continue
      const dstIdx = (dstY * width + dstX) * 4
      centered.data[dstIdx] = data[srcIdx]
      centered.data[dstIdx + 1] = data[srcIdx + 1]
      centered.data[dstIdx + 2] = data[srcIdx + 2]
      centered.data[dstIdx + 3] = data[srcIdx + 3]
    }
  }

  return PNG.sync.write(centered)
}

async function main() {
  const svgSource = await fs.readFile(ICON_SVG, 'utf8')
  const executablePath = defaultChromeExecutable()
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    let exported = 0
    for (const target of EXPORT_TARGETS) {
      const outPath = path.join(ICON_DIR, target.rel)
      await fs.mkdir(path.dirname(outPath), { recursive: true })
      const png = opticallyCenterPng(
        await screenshotSvg(page, svgForSize(svgSource, target.size), target.size),
      )
      await fs.writeFile(outPath, png)
      exported += 1
    }
    console.log(`export_app_icon_pngs: wrote ${exported} PNGs from icon.svg`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
