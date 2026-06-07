import { isTauri } from '@tauri-apps/api/core'

import { appendLunaLog } from '../lunaPersistence'

export type LunaLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH'

type LunaLogKind = 'app' | 'crash'

function serializeExtra(extra: unknown): string {
  if (extra == null) return ''
  if (extra instanceof Error) {
    return JSON.stringify({
      message: extra.message,
      stack: extra.stack,
      name: extra.name,
    })
  }
  try {
    return JSON.stringify(extra)
  } catch {
    return String(extra)
  }
}

function formatLogLine(level: LunaLogLevel, message: string, extra?: unknown): string {
  const ts = new Date().toISOString()
  const build = import.meta.env.DEV ? 'debug' : 'release'
  const detail = extra === undefined ? '' : ` ${serializeExtra(extra)}`
  return `[${ts}] [${level}] [${build}] ${message}${detail}`
}

function writeLogLine(level: LunaLogLevel, message: string, extra?: unknown): void {
  const line = formatLogLine(level, message, extra)
  const kind: LunaLogKind = level === 'CRASH' ? 'crash' : 'app'

  if (import.meta.env.DEV) {
    if (level === 'ERROR' || level === 'CRASH') console.error(line)
    else if (level === 'WARN') console.warn(line)
    else console.info(line)
  }

  if (!isTauri()) return
  appendLunaLog(line, kind)
}

export function logInfo(message: string, extra?: unknown): void {
  writeLogLine('INFO', message, extra)
}

export function logWarn(message: string, extra?: unknown): void {
  writeLogLine('WARN', message, extra)
}

export function logError(message: string, extra?: unknown): void {
  writeLogLine('ERROR', message, extra)
}

export function logCrash(message: string, extra?: unknown): void {
  writeLogLine('CRASH', message, extra)
}

let globalHandlersInstalled = false

export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled || !isTauri()) return
  globalHandlersInstalled = true

  window.addEventListener('error', (event) => {
    logCrash('uncaught_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    logCrash('unhandled_rejection', {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
}
