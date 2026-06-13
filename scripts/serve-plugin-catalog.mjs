#!/usr/bin/env node
/**
 * Local plugin catalog server for development.
 * Serves docs/theme-plugin-example at http://127.0.0.1:8000
 *
 *   npm run plugin-catalog:dev
 */
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../docs/theme-plugin-example')
const HOST = '127.0.0.1'
const PORT = 8000

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
}

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
    schemaVersion: 1,
    id: pluginId,
    version: manifest.version,
    manifest,
    files,
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, 'Bad request')
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendText(res, 405, 'Method not allowed')
    return
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`)
  const pathname = decodeURIComponent(url.pathname)

  try {
    if (pathname === '/' || pathname === '/catalog/index.json') {
      const index = await readJson(path.join(ROOT, 'catalog/index.json'))
      index.catalogUrl = '/catalog/index.json'
      for (const plugin of index.plugins) {
        plugin.detailUrl = `/catalog/plugins/${plugin.id}.json`
        if (plugin.iconExplicit && plugin.icon) {
          const iconPath = String(plugin.icon).split('?')[0]
          plugin.icon = `${iconPath}?v=${plugin.latestVersion ?? '1.0.0'}`
        } else {
          delete plugin.icon
        }
      }
      sendJson(res, 200, index)
      return
    }

    const packageMatch = pathname.match(/^\/packages\/([a-z0-9-]+)\.json$/)
    if (packageMatch) {
      const pluginId = packageMatch[1]
      const staticPackagePath = path.join(ROOT, 'packages', `${pluginId}.json`)
      try {
        const pkg = await readJson(staticPackagePath)
        sendJson(res, 200, pkg)
        return
      } catch {
        const pkg = await buildPackage(pluginId)
        sendJson(res, 200, pkg)
        return
      }
    }

    const detailMatch = pathname.match(/^\/catalog\/plugins\/([a-z0-9-]+)\.json$/)
    if (detailMatch) {
      const pluginId = detailMatch[1]
      const detail = await readJson(path.join(ROOT, 'catalog/plugins', `${pluginId}.json`))
      const version = detail.versions?.[0]
      if (version) {
        version.packageUrl = `/packages/${pluginId}.json`
      }
      sendJson(res, 200, detail)
      return
    }

    const mediaMatch = pathname.match(/^\/media\/([a-z0-9-]+)\/(icon(?:@\d+)?\.png)$/)
    if (mediaMatch) {
      const [, pluginId, iconFile] = mediaMatch
      const iconCandidates = [path.join(ROOT, 'media', pluginId, iconFile)]
      if (iconFile === 'icon.png' || iconFile === 'icon@32.png') {
        iconCandidates.push(path.join(ROOT, 'media', pluginId, 'icon@128.png'))
      }
      let icon
      for (const candidate of iconCandidates) {
        try {
          icon = await fs.readFile(candidate)
          break
        } catch {
          /* try next candidate */
        }
      }
      if (!icon) {
        sendText(res, 404, 'Icon not found')
        return
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end(icon)
      return
    }

    const relative = pathname.replace(/^\/+/, '')
    const filePath = path.resolve(ROOT, relative)
    if (!filePath.startsWith(ROOT)) {
      sendText(res, 403, 'Forbidden')
      return
    }

    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      sendText(res, 404, 'Not found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const content = await fs.readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(res, 404, { error: message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Plugin catalog server: http://${HOST}:${PORT}`)
  console.log(`Catalog index: http://${HOST}:${PORT}/catalog/index.json`)
  console.log(`Serving: ${ROOT}`)
})
