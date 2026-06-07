import { isTauri } from '@tauri-apps/api/core'
import { type as readOsType } from '@tauri-apps/plugin-os'

/** Normalized desktop platform for shortcuts and modifier-key UI copy. */
export type DesktopPlatform = 'mac' | 'win' | 'linux' | 'web'

function detectFromNavigator(): DesktopPlatform {
  if (typeof navigator === 'undefined') {
    // Node/SSR generators (CI locale pipeline): avoid "web" — use host OS baseline.
    if (typeof process !== 'undefined') {
      if (process.platform === 'darwin') return 'mac'
      if (process.platform === 'win32') return 'win'
      return 'linux'
    }
    return 'linux'
  }
  const platform = navigator.platform ?? ''
  if (/Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS X/u.test(navigator.userAgent)) {
    return 'mac'
  }
  if (/Win/i.test(navigator.userAgent) || /Windows/i.test(platform)) {
    return 'win'
  }
  return 'linux'
}

function mapOsTypeToDesktop(os: ReturnType<typeof readOsType>): DesktopPlatform {
  switch (os) {
    case 'macos':
    case 'ios':
      return 'mac'
    case 'windows':
      return 'win'
    case 'linux':
    case 'android':
      return 'linux'
  }
}

/** Resolve the host OS for shortcut defaults and Cmd/Ctrl hints. */
export function getDesktopPlatform(): DesktopPlatform {
  const forced = typeof process !== 'undefined' ? process.env.CROSSPLATNOTE_FORCE_DESKTOP_PLATFORM : undefined
  if (forced === 'mac' || forced === 'win' || forced === 'linux' || forced === 'web') {
    return forced
  }
  if (!isTauri()) return detectFromNavigator()
  try {
    return mapOsTypeToDesktop(readOsType())
  } catch {
    return detectFromNavigator()
  }
}

export function isMacDesktopPlatform(): boolean {
  return getDesktopPlatform() === 'mac'
}

export function isWindowsDesktopPlatform(): boolean {
  return getDesktopPlatform() === 'win'
}

export function isLinuxDesktopPlatform(): boolean {
  return getDesktopPlatform() === 'linux'
}

/** Whether UI should describe primary modifiers as Cmd (macOS) vs Ctrl (Win/Linux). */
export function isModifierHintMacLike(): boolean {
  return isMacDesktopPlatform()
}
