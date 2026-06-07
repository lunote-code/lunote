/** Feature flag: embedded CodeMirror 6 for fenced code blocks (on by default since Phase 3). */

const LS_KEY = 'luna.codeBlock.cm'

export function isCodeBlockCmEnabled(): boolean {
  if (import.meta.env.VITE_CODEBLOCK_CM === '0') return false
  if (import.meta.env.VITE_CODEBLOCK_CM === '1') return true
  if (typeof window === 'undefined') return true
  const params = new URLSearchParams(window.location.search)
  if (params.get('codeblockCm') === '0') return false
  if (params.get('codeblockCm') === '1') return true
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === '0') return false
    if (stored === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

/** Parse feature flag from a query string (harness / tests). */
export function isCodeBlockCmEnabledFromSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.get('codeblockCm') === '0') return false
  if (params.get('codeblockCm') === '1') return true
  return true
}

export function setCodeBlockCmEnabledForTests(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (enabled) localStorage.setItem(LS_KEY, '1')
    else localStorage.setItem(LS_KEY, '0')
  } catch {
    /* ignore */
  }
}
