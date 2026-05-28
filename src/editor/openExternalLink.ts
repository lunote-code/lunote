import { invoke, isTauri } from '@tauri-apps/api/core'

/** Whether to handle modifier key prompts according to the desktop "Mac system" (Cmd vs Ctrl)*/
export function isModifierHintMacLike(): boolean {
  if (typeof navigator === 'undefined') return false
  const p = navigator.platform ?? ''
  if (/Mac|iPhone|iPod|iPad/i.test(p)) return true
  return /Mac OS X/u.test(navigator.userAgent)
}

export function externalLinkModifierTooltip(): string {
  return isModifierHintMacLike() ? 'Cmd + Click to open link' : 'Ctrl + Click to open link'
}

const MAX_OPENABLE_HREF_LEN = 2048
const MAX_HTTPS_QUERY_FRAGMENT_LEN = 256
const MAX_MAILTO_QUERY_LEN = 1024

function queryAndFragmentLen(url: string): number {
  const q = url.indexOf('?')
  const h = url.indexOf('#')
  if (q >= 0 && h >= 0) return url.length - Math.min(q, h)
  if (q >= 0) return url.length - q
  if (h >= 0) return url.length - h
  return 0
}

/** Allow hrefs (http(s), mailto, tel) to be opened in system browser/default app*/
export function isOpenableExternalHref(href: string): boolean {
  const t = href.trim()
  if (!t || t.length > MAX_OPENABLE_HREF_LEN) return false
  const low = t.toLowerCase()
  if (low.startsWith('javascript:') || low.startsWith('data:') || low.startsWith('vbscript:')) return false
  if (low.startsWith('note:') || low.startsWith('file:')) return false
  if (low.startsWith('mailto:')) {
    const queryLen = t.includes('?') ? t.length - t.indexOf('?') : 0
    return queryLen <= MAX_MAILTO_QUERY_LEN
  }
  if (low.startsWith('tel:')) return t.length <= 64
  if (!/^https?:\/\//iu.test(t)) return false
  const schemeEnd = t.indexOf('://') + 3
  if (t.slice(schemeEnd).includes('@')) return false
  return queryAndFragmentLen(t) <= MAX_HTTPS_QUERY_FRAGMENT_LEN
}

/** Use temporary `<a target="_blank">` to open under non-Tauri (such as Vite browser debugging) to avoid `window.open` and navigation within webview*/
function openUrlInBrowserTabViaTransientAnchor(url: string): void {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function openExternalUrlInSystemBrowser(href: string): Promise<void> {
  const url = href.trim()
  if (!isOpenableExternalHref(url)) return
  try {
    if (isTauri()) {
      await invoke('open_external_url', { url })
    } else {
      openUrlInBrowserTabViaTransientAnchor(url)
    }
  } catch {
    try {
      openUrlInBrowserTabViaTransientAnchor(url)
    } catch {
      /* ignore */
    }
  }
}
