/** Whether the event target is inside an embedded code-block CodeMirror surface (not toolbar). */
export function isCodeBlockCmDom(el: HTMLElement | null): boolean {
  if (!el) return false
  if (el.closest('.luna-code-toolbar, .luna-code-lang-palette')) return false
  return !!el.closest(
    '.pm-code-block-cm, .pm-code-block-cm-root, .cm-editor, .cm-scroller, .cm-content, .cm-gutters',
  )
}

export function isCodeBlockCmGutterDom(el: HTMLElement | null): boolean {
  return !!el?.closest('.cm-gutters, .cm-lineNumbers, .cm-gutter, .cm-gutterElement, .cm-activeLineGutter')
}

/** CM content/lines only — excludes gutter and native scrollbar chrome on .cm-scroller. */
export function isCodeBlockCmEditableDom(el: HTMLElement | null): boolean {
  if (!el) return false
  if (isCodeBlockCmGutterDom(el)) return false
  return !!el.closest('.cm-content, .cm-line')
}

/** Native horizontal scrollbar band on CM scroller — must not hijack selection/focus. */
export function isCodeBlockCmScrollerChromeTarget(
  el: HTMLElement | null,
  clientX?: number,
  clientY?: number,
): boolean {
  if (!el) return false
  const scroller = el.closest('.pm-code-block-cm .cm-scroller') as HTMLElement | null
  if (!scroller) return false
  if (el.classList.contains('cm-scroller')) return true
  if (clientX == null || clientY == null) return false
  if (scroller.scrollWidth <= scroller.clientWidth) return false
  const rect = scroller.getBoundingClientRect()
  const inHorizontalBar = clientY >= rect.bottom - 14 && clientY <= rect.bottom + 1
  const inRightTrack = clientX >= rect.right - 14 && clientX <= rect.right + 1
  return inHorizontalBar || inRightTrack
}

/** Kernel mousedown target: CM editable surface + pre padding (bottom pad lives inside CM). */
export function isCodeBlockCmMouseTarget(el: HTMLElement | null, clientX?: number, clientY?: number): boolean {
  if (!el) return false
  if (isCodeBlockToolbarDom(el)) return false
  if (isCodeBlockCmGutterDom(el)) return false
  if (isCodeBlockCmScrollerChromeTarget(el, clientX, clientY)) return false
  if (isCodeBlockCmEditableDom(el)) return true
  return !!el.closest('.pm-code-block-pre--cm')
}

export function isCodeBlockToolbarDom(el: HTMLElement | null): boolean {
  return !!el?.closest('.luna-code-toolbar, .luna-code-lang-palette')
}

/** Code-block context menu + portaled language submenu (not inside menuRef). */
export function isCodeBlockContextMenuDom(el: HTMLElement | null): boolean {
  if (!el) return false
  return Boolean(el.closest('.file-ctx-menu, .file-ctx-submenu-portal, .file-ctx-submenu--code-lang'))
}
