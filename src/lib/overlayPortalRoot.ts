/** Prefer the open preferences dialog so nested overlays render above its modal top layer. */
export function resolveOverlayPortalRoot(): HTMLElement {
  const prefsDialog = document.querySelector('dialog.prefs-dialog[open]')
  return prefsDialog instanceof HTMLElement ? prefsDialog : document.body
}
