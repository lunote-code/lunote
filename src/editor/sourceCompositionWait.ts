/** Minimal CodeMirror-like surface used while waiting out IME composition. */
export type SourceCompositionView = {
  readonly composing: boolean
  readonly dom: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
}

/**
 * Source→visual must wait for IME the same way visual→source waits on TipTap.
 * Resolves immediately when the view is missing or not composing.
 */
export function waitForCodeMirrorCompositionEnd(
  view: SourceCompositionView | null | undefined,
  timeoutMs = 3000,
): Promise<void> {
  if (!view || !view.composing) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      view.dom.removeEventListener('compositionend', finish)
      clearTimeout(timerId)
      resolve()
    }
    view.dom.addEventListener('compositionend', finish)
    const timerId = setTimeout(finish, timeoutMs)
  })
}
