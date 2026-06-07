import DOMPurify from 'dompurify'
import type { Config as DomPurifyConfig } from 'dompurify'
import { isTauri } from '@tauri-apps/api/core'

const PRINT_HTML_PURIFY: DomPurifyConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: [
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'caption', 'nav', 'section',
  ],
  ADD_ATTR: [
    'class', 'id', 'colspan', 'rowspan', 'align', 'style', 'data-language', 'data-luna-callout', 'aria-hidden',
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
}

async function closeSelf(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().close()
    return
  }
  window.close()
}

function run(): void {
  const params = new URLSearchParams(window.location.search)
  const key = params.get('key')
  if (!key) {
    document.body.textContent = 'Missing print key'
    return
  }

  const raw = localStorage.getItem(key)
  localStorage.removeItem(key)
  if (!raw) {
    document.body.textContent = 'Print content not found'
    return
  }

  const title = params.get('title')
  if (title) document.title = title

  const html = DOMPurify.sanitize(raw, PRINT_HTML_PURIFY) as string

  document.open()
  document.write(html)
  document.close()

  const startPrint = () => {
    window.addEventListener('afterprint', () => {
      void closeSelf()
    }, { once: true })
    window.setTimeout(() => window.print(), 100)
    window.setTimeout(() => {
      void closeSelf()
    }, 10 * 60 * 1000)
  }

  if (document.readyState === 'complete') {
    window.setTimeout(startPrint, 150)
  } else {
    window.addEventListener('load', () => window.setTimeout(startPrint, 150), { once: true })
  }
}

run()
