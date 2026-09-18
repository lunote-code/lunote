export function collectEditorScrollTargets(shell: HTMLElement, editorDom: HTMLElement): HTMLElement[] {
  const targets = new Set<HTMLElement>()
  targets.add(shell)
  let el: HTMLElement | null = editorDom
  while (el) {
    const style = window.getComputedStyle(el)
    const scrollable =
      el.scrollHeight > el.clientHeight + 1 &&
      (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay')
    if (scrollable) targets.add(el)
    el = el.parentElement
  }
  return [...targets]
}
