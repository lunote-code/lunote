/** Preferences dialog switch (decoupled from settings persistence)*/

import type { PrefsTabId } from './types'

type Sub = () => void

let open = false
let pendingTab: PrefsTabId | null = null
const subs = new Set<Sub>()

function notify() {
  for (const s of subs) s()
}

export function openPreferencesDialog(tab?: PrefsTabId): void {
  if (tab) pendingTab = tab
  open = true
  notify()
}

export function takePendingPreferencesTab(): PrefsTabId | null {
  const tab = pendingTab
  pendingTab = null
  return tab
}

export function closePreferencesDialog(): void {
  if (!open) return
  open = false
  notify()
}

export function isPreferencesDialogOpen(): boolean {
  return open
}

export function subscribePreferencesDialog(cb: Sub): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}
