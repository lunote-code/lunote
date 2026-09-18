type Sub = () => void

let open = false
const subs = new Set<Sub>()

function notify() {
  for (const s of subs) s()
}

export function openShortcutsCheatsheetDialog(): void {
  open = true
  notify()
}

export function closeShortcutsCheatsheetDialog(): void {
  if (!open) return
  open = false
  notify()
}

export function isShortcutsCheatsheetDialogOpen(): boolean {
  return open
}

export function subscribeShortcutsCheatsheetDialog(cb: Sub): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}
