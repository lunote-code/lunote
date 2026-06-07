import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

const ALLOWED_CHANNELS = new Set(['codeblock-cm-focus', 'paste-scroll'])

/** Same tree as Tauri `ensure_luna_dirs().logs` — agents read `~/.luna/logs/{channel}.jsonl`. */
function resolveLunaLogsDir(): string {
  return path.join(os.homedir(), '.luna', 'logs')
}

export function getLunaDebugLogDisplayPath(channel: string): string {
  return `~/.luna/logs/${channel}.jsonl`
}

/**
 * Dev-only middleware: append structured debug events to `~/.luna/logs/{channel}.jsonl`
 * so agents can read logs without Console copy/paste (outside the git workspace).
 */
export function lunaDebugLogPlugin(): Plugin {
  return {
    name: 'luna-debug-log',
    configureServer(server: ViteDevServer) {
      const debugRoot = resolveLunaLogsDir()

      server.middlewares.use('/__luna/debug-log', (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer | string) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as {
                channel?: string
                entry?: unknown
                entries?: unknown[]
              }
              const channel = String(payload.channel ?? '')
              if (!ALLOWED_CHANNELS.has(channel)) {
                res.statusCode = 400
                res.end('invalid channel')
                return
              }
              const entries = Array.isArray(payload.entries) ? payload.entries : [payload.entry]
              fs.mkdirSync(debugRoot, { recursive: true })
              const file = path.join(debugRoot, `${channel}.jsonl`)
              const lines = entries.map((entry) => `${JSON.stringify(entry)}\n`).join('')
              fs.appendFileSync(file, lines, 'utf8')
              res.statusCode = 204
              res.end()
            } catch (error) {
              res.statusCode = 500
              res.end(String(error))
            }
          })
          return
        }

        if (req.method === 'DELETE') {
          const channel = url.searchParams.get('channel') ?? ''
          if (!ALLOWED_CHANNELS.has(channel)) {
            res.statusCode = 400
            res.end('invalid channel')
            return
          }
          const file = path.join(debugRoot, `${channel}.jsonl`)
          try {
            if (fs.existsSync(file)) fs.unlinkSync(file)
            res.statusCode = 204
            res.end()
          } catch (error) {
            res.statusCode = 500
            res.end(String(error))
          }
          return
        }

        if (req.method === 'GET' && url.pathname === '/__luna/debug-log') {
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              logsDir: debugRoot,
              logsDirDisplay: '~/.luna/logs',
              channels: [...ALLOWED_CHANNELS],
              files: [...ALLOWED_CHANNELS.values()]
                .map((channel) => {
                  const file = path.join(debugRoot, `${channel}.jsonl`)
                  if (!fs.existsSync(file)) return null
                  const stat = fs.statSync(file)
                  return {
                    channel,
                    path: file,
                    displayPath: getLunaDebugLogDisplayPath(channel),
                    bytes: stat.size,
                    mtimeMs: stat.mtimeMs,
                  }
                })
                .filter(Boolean),
            }),
          )
          return
        }

        next()
      })
    },
  }
}
