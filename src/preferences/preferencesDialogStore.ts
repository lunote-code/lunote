/** Preferences dialog switch (decoupled from settings persistence)*/

type Sub = () => void

let open = false
const subs = new Set<Sub>()

function notify() {
  for (const s of subs) s()
}

export function openPreferencesDialog(): void {
  open = true
  notify()
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
