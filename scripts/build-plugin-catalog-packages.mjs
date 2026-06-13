#!/usr/bin/env node
/**
 * Regenerate docs/theme-plugin-example/packages/*.json from installed/ examples.
 *
 *   npm run plugin-catalog:build-packages
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../docs/theme-plugin-example')

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function collectInstalledFiles(pluginId) {
  const base = path.join(ROOT, 'installed', pluginId)
  const files = []

  async function walk(relativeDir) {
    const abs = path.join(base, relativeDir)
    const entries = await fs.readdir(abs, { withFileTypes: true })
    for (const entry of entries) {
      const rel = path.posix.join(relativeDir, entry.name)
      if (entry.isDirectory()) {
        await walk(rel)
        continue
      }
      const content = await fs.readFile(path.join(base, rel), 'utf8')
      files.push({ path: rel.replace(/\\/g, '/'), content })
    }
  }

  await walk('')
  return files
}

async function buildPackage(pluginId) {
  const manifestPath = path.join(ROOT, 'installed', pluginId, 'plugin.json')
  const manifest = await readJson(manifestPath)
  const files = await collectInstalledFiles(pluginId)
  return {
    schemaVersion: 2,
    id: pluginId,
    version: manifest.version,
    manifest,
    files,
  }
}

async function main() {
  const installedDir = path.join(ROOT, 'installed')
  const packagesDir = path.join(ROOT, 'packages')
  const pluginIds = (await fs.readdir(installedDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  await fs.mkdir(packagesDir, { recursive: true })

  for (const pluginId of pluginIds) {
    const pkg = await buildPackage(pluginId)
    const outPath = path.join(packagesDir, `${pluginId}.json`)
    await fs.writeFile(outPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${path.relative(ROOT, outPath)}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
