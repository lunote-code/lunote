import { isTauri } from '@tauri-apps/api/core'

const PRINT_STORAGE_PREFIX = 'lunote-print:'

export class PrintPermissionRequiredError extends Error {
  constructor() {
    super('print-permission-required')
    this.name = 'PrintPermissionRequiredError'
  }
}

export class PrintContentTooLargeError extends Error {
  constructor() {
    super('print-content-too-large')
    this.name = 'PrintContentTooLargeError'
  }
}

function isPermissionDeniedMessage(message: string): boolean {
  return /not allowed|denied|permission|forbidden|allow-print/i.test(message)
}

async function openPrintableHtmlTauri(printUrl: string, title: string, storageKey: string): Promise<void> {
  const label = `secondary-print-${Date.now()}`
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const w = new WebviewWindow(label, {
    url: printUrl,
    title,
    width: 900,
    height: 700,
    center: true,
    visible: true,
    focus: true,
  })

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Print window timed out')), 15000)
      w.once('tauri://created', () => {
        window.clearTimeout(timer)
        resolve()
      })
      w.once('tauri://error', (ev) => {
        window.clearTimeout(timer)
        const message = typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)
        if (isPermissionDeniedMessage(message)) {
          reject(new PrintPermissionRequiredError())
          return
        }
        reject(new Error(message))
      })
    })
  } catch (error) {
    localStorage.removeItem(storageKey)
    throw error
  }
}

function openPrintableHtmlBrowser(printUrl: string): void {
  const popup = window.open(printUrl, '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!popup) {
    throw new Error('Popup blocked — allow popups to print')
  }
}

/** Opens the system print dialog (same HTML pipeline as export). */
export async function openPrintableHtml(html: string, title?: string): Promise<void> {
  const storageKey = `${PRINT_STORAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    localStorage.setItem(storageKey, html)
  } catch {
    throw new PrintContentTooLargeError()
  }

  const params = new URLSearchParams({
    key: storageKey,
    title: title ?? 'Print',
  })
  const printUrl = `/print.html?${params.toString()}`
  const windowTitle = title ?? 'Print'

  if (isTauri()) {
    await openPrintableHtmlTauri(printUrl, windowTitle, storageKey)
    return
  }
  openPrintableHtmlBrowser(printUrl)
}
