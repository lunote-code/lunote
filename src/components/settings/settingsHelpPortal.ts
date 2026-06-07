/** Prefer the open preferences dialog so help panels render above the modal top layer.*/
export function resolveSettingsHelpPortalRoot(): HTMLElement {
  const prefsDialog = document.querySelector('dialog.prefs-dialog[open]')
  return prefsDialog instanceof HTMLElement ? prefsDialog : document.body
}
