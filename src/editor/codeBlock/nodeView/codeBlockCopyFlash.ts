import { useEffect } from 'react'

const codeBlockCopyFlashRoots = new Map<HTMLElement, () => void>()
let codeBlockCopyListenerBound = false

function handleCodeBlockCopyCapture(event: ClipboardEvent): void {
  const target = event.target as Node | null
  if (!target) return
  for (const [root, flash] of codeBlockCopyFlashRoots) {
    if (!root.contains(target)) continue
    flash()
    return
  }
}

function bindGlobalCodeBlockCopyListener(): void {
  if (codeBlockCopyListenerBound || typeof document === 'undefined') return
  document.addEventListener('copy', handleCodeBlockCopyCapture, true)
  codeBlockCopyListenerBound = true
}

function unbindGlobalCodeBlockCopyListenerIfIdle(): void {
  if (!codeBlockCopyListenerBound || codeBlockCopyFlashRoots.size > 0 || typeof document === 'undefined') return
  document.removeEventListener('copy', handleCodeBlockCopyCapture, true)
  codeBlockCopyListenerBound = false
}

/** Register copy-flash callback for a code block wrap root; cleans up on unmount. */
export function useCodeBlockCopyFlashRoot(
  wrapRef: React.RefObject<HTMLElement | null>,
  onFlash: () => void,
): void {
  useEffect(() => {
    const root = wrapRef.current
    if (!root) return
    codeBlockCopyFlashRoots.set(root, onFlash)
    bindGlobalCodeBlockCopyListener()
    return () => {
      codeBlockCopyFlashRoots.delete(root)
      unbindGlobalCodeBlockCopyListenerIfIdle()
    }
  }, [onFlash, wrapRef])
}
