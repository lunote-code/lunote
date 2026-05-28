const composing = new WeakMap<HTMLTextAreaElement, boolean>()

export function isTextareaComposing(el: HTMLTextAreaElement): boolean {
  return composing.get(el) === true
}

export function setTextareaComposing(el: HTMLTextAreaElement, active: boolean): void {
  if (active) composing.set(el, true)
  else composing.delete(el)
}

export function attachSelectionCycleComposition(el: HTMLTextAreaElement): () => void {
  const onStart = () => setTextareaComposing(el, true)
  const onEnd = () => setTextareaComposing(el, false)
  el.addEventListener('compositionstart', onStart)
  el.addEventListener('compositionend', onEnd)
  return () => {
    el.removeEventListener('compositionstart', onStart)
    el.removeEventListener('compositionend', onEnd)
    composing.delete(el)
  }
}

export function clearTextareaComposition(el: HTMLTextAreaElement): void {
  composing.delete(el)
}
