const PM_MIRROR_SELECTOR = '.pm-code-block-pm-mirror'

function isMirrorReadOnly(mirror: HTMLElement): boolean {
  return mirror.contentEditable === 'false' && mirror.getAttribute('data-pm-readonly') === 'true'
}

/** Apply read-only attrs to the off-screen PM contentDOM mirror (Solution B: CM owns input). */
export function applyPmCodeBlockMirrorReadOnly(mirror: HTMLElement): void {
  if (isMirrorReadOnly(mirror)) return
  mirror.contentEditable = 'false'
  mirror.setAttribute('contenteditable', 'false')
  mirror.setAttribute('aria-hidden', 'true')
  mirror.setAttribute('data-pm-readonly', 'true')
  mirror.setAttribute('spellcheck', 'false')
  mirror.tabIndex = -1
}

/** PM contentDOM mirror must stay non-editable while CM owns input (avoids protectLocalComposition crashes). */
export function disablePmCodeBlockMirrorEditing(wrap: HTMLElement | null): void {
  const mirror = wrap?.querySelector(PM_MIRROR_SELECTOR) as HTMLElement | null
  if (!mirror) return
  applyPmCodeBlockMirrorReadOnly(mirror)
}

/** Re-apply mirror read-only after PM/Tiptap resets contentDOM attributes (mirror only — not the whole wrap). */
export function installPmCodeBlockMirrorReadOnlyGuard(wrap: HTMLElement): () => void {
  let applying = false
  let mirrorObserver: MutationObserver | null = null
  let watchedMirror: HTMLElement | null = null

  const attachMirrorObserver = (mirror: HTMLElement) => {
    if (watchedMirror === mirror) return
    mirrorObserver?.disconnect()
    watchedMirror = mirror
    mirrorObserver = new MutationObserver(() => {
      if (applying) return
      applying = true
      applyPmCodeBlockMirrorReadOnly(mirror)
      applying = false
    })
    mirrorObserver.observe(mirror, {
      attributes: true,
      attributeFilter: ['contenteditable'],
    })
  }

  const reapply = () => {
    if (applying) return
    const mirror = wrap.querySelector(PM_MIRROR_SELECTOR) as HTMLElement | null
    if (!mirror) return
    applying = true
    applyPmCodeBlockMirrorReadOnly(mirror)
    applying = false
    attachMirrorObserver(mirror)
  }

  reapply()

  const wrapObserver = new MutationObserver(() => {
    reapply()
  })
  wrapObserver.observe(wrap, { childList: true, subtree: true })

  return () => {
    wrapObserver.disconnect()
    mirrorObserver?.disconnect()
    mirrorObserver = null
    watchedMirror = null
  }
}
