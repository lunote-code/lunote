import { COMMAND_MANIFEST } from './commandManifest.entries'
import {
  type DesktopPlatform,
  getDesktopPlatform,
  isMacDesktopPlatform,
  isWindowsDesktopPlatform,
} from '../platform/desktopPlatform'

export type PlatformAccel = {
  /** Windows/Linux Default (Mod=Ctrl)*/
  win?: string
  mac?: string
  linux?: string
  /** Same across all platforms*/
  default?: string
}

/** @deprecated Use isMacDesktopPlatform from platform/desktopPlatform */
export function isMacPlatform(): boolean {
  return isMacDesktopPlatform()
}

/** @deprecated Use isWindowsDesktopPlatform from platform/desktopPlatform */
export function isWindowsPlatform(): boolean {
  return isWindowsDesktopPlatform()
}

function resolvePlatformAccelFor(spec: PlatformAccel, platform: DesktopPlatform): string | undefined {
  if (platform === 'mac' && spec.mac) return spec.mac
  if (platform === 'win' && spec.win) return spec.win
  if (platform === 'linux' && spec.linux) return spec.linux
  return spec.win ?? spec.linux ?? spec.mac ?? spec.default
}

/** Platform difference accelerator aligned with Typora (manifest.accelerator for Win/Linux baseline)*/
export const PLATFORM_ACCELERATORS: Partial<Record<string, PlatformAccel>> = {
  'edit-redo': { win: 'Mod+y', mac: 'Mod+Shift+z', linux: 'Mod+Shift+z' },
  'edit-find-replace': { win: 'Mod+h', mac: 'Mod+Alt+f', linux: 'Mod+h' },
  'edit-find-next': { win: 'F3', mac: 'Mod+g', linux: 'F3' },
  'edit-find-prev': { win: 'Shift+F3', mac: 'Mod+Shift+g', linux: 'Shift+F3' },
  'fmt-strike': { win: 'Alt+Shift+5', mac: 'Ctrl+Shift+`', linux: 'Alt+Shift+5' },
  'fmt-highlight': { win: 'Mod+Shift+H', mac: 'Mod+Shift+H', linux: 'Mod+Shift+H' },
  'para-insert-code-block': { win: 'Mod+Shift+k', mac: 'Mod+Alt+c', linux: 'Mod+Shift+k' },
  'fmt-image': { win: 'Mod+Shift+i', mac: 'Mod+Ctrl+i', linux: 'Mod+Shift+i' },
  'para-math-block': { win: 'Mod+Shift+m', mac: 'Mod+Alt+b', linux: 'Mod+Shift+m' },
  'para-table-insert': { win: 'Mod+t', mac: 'Mod+Alt+t', linux: 'Mod+t' },
  'para-ul': { win: 'Mod+Shift+[', mac: 'Mod+Alt+u', linux: 'Mod+Shift+[' },
  'para-ol': { win: 'Mod+Shift+]', mac: 'Mod+Alt+o', linux: 'Mod+Shift+]' },
  'para-task': { win: 'Mod+Shift+x', mac: 'Mod+Alt+x', linux: 'Mod+Shift+x' },
  'app-quit': { win: 'Alt+F4', mac: 'Mod+q', linux: 'Mod+q' },
  'toggle-focus': { default: 'F8' },
  'view-fullscreen': { win: 'F11', mac: 'Mod+Ctrl+f', linux: 'F11' },
}

/** Configurable menu shortcuts shown in preferences (consistent with product shortcuts table)*/
export const MENU_CONFIGURABLE_SHORTCUT_IDS = [
  'file-new',
  'file-new-window',
  'file-open-file',
  'save',
  'file-save-as',
  'preferences',
  'file-close',
  'app-quit',
  'edit-undo',
  'edit-redo',
  'edit-cut',
  'edit-copy',
  'edit-paste',
  'edit-select-all',
  'edit-find',
  'edit-find-replace',
  'edit-find-next',
  'edit-find-prev',
  'fmt-bold',
  'fmt-italic',
  'fmt-underline',
  'fmt-strike',
  'fmt-highlight',
  'fmt-inline-code',
  'fmt-clear-style',
  'para-h1',
  'para-h2',
  'para-h3',
  'para-h4',
  'para-h5',
  'para-h6',
  'para-paragraph',
  'para-quote',
  'para-insert-code-block',
  'para-ul',
  'para-ol',
  'para-task',
  'fmt-link',
  'fmt-image',
  'para-link-ref',
  'para-table-insert',
  'para-math-block',
  'toggle-source-mode',
  'toggle-focus',
  'command-palette-open',
  'view-search',
  'view-zoom-in',
  'view-zoom-out',
  'view-fullscreen',
] as const

export type MenuConfigurableShortcutId = (typeof MENU_CONFIGURABLE_SHORTCUT_IDS)[number]

/** Shortcut keys that are only displayed in the preferences and cannot be customized (editing type, follow the system/browser default behavior)*/
export const NON_CUSTOMIZABLE_SHORTCUT_IDS = [
  'edit-undo',
  'edit-redo',
  'edit-cut',
  'edit-copy',
  'edit-paste',
  'edit-select-all',
  'edit-find',
  'edit-find-replace',
  'edit-find-next',
  'edit-find-prev',
] as const satisfies ReadonlyArray<MenuConfigurableShortcutId>

const NON_CUSTOMIZABLE_SET = new Set<string>(NON_CUSTOMIZABLE_SHORTCUT_IDS)

export function isShortcutCustomizable(commandId: string): boolean {
  return MENU_CONFIGURABLE_SHORTCUT_IDS.includes(commandId as MenuConfigurableShortcutId) &&
    !NON_CUSTOMIZABLE_SET.has(commandId)
}

/** Preferences shortcut page grouping (consistent with product documentation chapter)*/
export const SHORTCUT_PREF_SECTIONS: ReadonlyArray<{
  id: string
  labelKey: string
  commandIds: readonly MenuConfigurableShortcutId[]
  /** Only the default shortcut keys are displayed and no recording or modification is allowed.*/
  readOnly?: boolean
}> = [
  {
    id: 'file',
    labelKey: 'settings.shortcuts.group.file',
    commandIds: [
      'file-new',
      'file-new-window',
      'file-open-file',
      'save',
      'file-save-as',
      'preferences',
      'file-close',
      'app-quit',
    ],
  },
  {
    id: 'edit',
    labelKey: 'settings.shortcuts.group.edit',
    readOnly: true,
    commandIds: [...NON_CUSTOMIZABLE_SHORTCUT_IDS],
  },
  {
    id: 'formatting',
    labelKey: 'settings.shortcuts.group.formatting',
    commandIds: [
      'fmt-bold',
      'fmt-italic',
      'fmt-underline',
      'fmt-strike',
      'fmt-highlight',
      'fmt-inline-code',
      'fmt-clear-style',
    ],
  },
  {
    id: 'markdown',
    labelKey: 'settings.shortcuts.group.markdown',
    commandIds: [
      'para-h1',
      'para-h2',
      'para-h3',
      'para-h4',
      'para-h5',
      'para-h6',
      'para-paragraph',
      'para-quote',
      'para-insert-code-block',
      'para-ul',
      'para-ol',
      'para-task',
    ],
  },
  {
    id: 'link',
    labelKey: 'settings.shortcuts.group.link',
    commandIds: ['fmt-link', 'fmt-image', 'para-link-ref'],
  },
  {
    id: 'table',
    labelKey: 'settings.shortcuts.group.table',
    commandIds: ['para-table-insert', 'para-math-block'],
  },
  {
    id: 'view',
    labelKey: 'settings.shortcuts.group.view',
    commandIds: [
      'toggle-source-mode',
      'toggle-focus',
      'command-palette-open',
      'view-search',
      'view-zoom-in',
      'view-zoom-out',
      'view-fullscreen',
    ],
  },
]

export function getManifestDefaultAcceleratorFor(
  commandId: string,
  platform: DesktopPlatform,
): string | undefined {
  const plat = PLATFORM_ACCELERATORS[commandId]
  if (plat) {
    const resolved = resolvePlatformAccelFor(plat, platform)
    if (resolved) return resolved
  }
  return manifestEntryAccelerator(commandId)
}

export function getManifestDefaultAccelerator(commandId: string): string | undefined {
  return getManifestDefaultAcceleratorFor(commandId, getDesktopPlatform())
}

function manifestEntryAccelerator(commandId: string): string | undefined {
  return COMMAND_MANIFEST[commandId]?.accelerator
}
