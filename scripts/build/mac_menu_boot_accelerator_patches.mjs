/**
 * macOS-only tauriAccelerator overrides for mac-menu-boot.json.
 * Keep in sync with PLATFORM_ACCELERATORS.mac in shortcutPlatformDefaults.ts.
 * Applied after SSR build so Linux CI never emits Win/Linux baseline shortcuts.
 */
export const MAC_BOOT_TAURI_ACCELERATOR_PATCHES = {
  'edit-find-replace': 'CmdOrCtrl+Alt+KeyF',
  'edit-find-next': 'CmdOrCtrl+KeyG',
  'edit-find-prev': 'CmdOrCtrl+Shift+KeyG',
  'fmt-strike': 'Ctrl+Shift+Backquote',
  'fmt-image': 'CmdOrCtrl+Ctrl+KeyI',
  'para-math-block': 'CmdOrCtrl+Alt+KeyB',
  'para-insert-code-block': 'CmdOrCtrl+Alt+KeyC',
  'para-table-insert': 'CmdOrCtrl+Alt+KeyT',
  'para-ol': 'CmdOrCtrl+Alt+KeyO',
  'para-ul': 'CmdOrCtrl+Alt+KeyU',
  'para-task': 'CmdOrCtrl+Alt+KeyX',
  'view-fullscreen': 'CmdOrCtrl+Ctrl+KeyF',
}

export function applyMacBootAcceleratorPatches(manifest) {
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (node?.kind === 'item' || node?.kind === 'check') {
        const patch = MAC_BOOT_TAURI_ACCELERATOR_PATCHES[node.action]
        if (patch) node.tauriAccelerator = patch
      } else if (node?.kind === 'submenu') {
        walk(node.children)
      }
    }
  }
  for (const group of manifest.bar ?? []) {
    walk(group.children)
  }
}

export function assertMacBootAcceleratorPatchesApplied(manifest) {
  const findAccel = (nodes, action) => {
    if (!Array.isArray(nodes)) return undefined
    for (const node of nodes) {
      if ((node?.kind === 'item' || node?.kind === 'check') && node.action === action) {
        return node.tauriAccelerator
      }
      if (node?.kind === 'submenu') {
        const nested = findAccel(node.children, action)
        if (nested !== undefined) return nested
      }
    }
    return undefined
  }
  for (const [action, expected] of Object.entries(MAC_BOOT_TAURI_ACCELERATOR_PATCHES)) {
    let actual
    for (const group of manifest.bar ?? []) {
      actual = findAccel(group.children, action)
      if (actual !== undefined) break
    }
    if (actual !== expected) {
      throw new Error(
        `mac-menu-boot.json ${action}: expected macOS accelerator ${expected}, got ${actual ?? '(missing)'}`,
      )
    }
  }
}
