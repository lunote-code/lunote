import { isMacDesktopPlatform } from '../platform/desktopPlatform'

/** Convert the Mod in the schema into shortcut key copy for current platform display*/
export function formatAcceleratorForDisplay(acc: string | undefined): string {
  if (!acc) return ''
  const isMac = isMacDesktopPlatform()
  let out = acc
    .replace(/Mod\+/gi, isMac ? '⌘' : 'Ctrl+')
    .replace(/Ctrl\+/gi, isMac ? '⌃' : 'Ctrl+')
    .replace(/Shift\+/gi, isMac ? '⇧' : 'Shift+')
    .replace(/Alt\+/gi, isMac ? '⌥' : 'Alt+')
  if (/^[⌘⇧⌥⌃]|^Ctrl\+|^Shift\+|^Alt\+/u.test(out) || isMac) {
    out = out.replace(/([⌘⇧⌥⌃]|\+)([a-z])(?=$|\+)/gi, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
  }
  return out
}

/** Tauri/Electron menu accelerator: schema saves Mod, Rust uses CmdOrCtrl (consistent with existing lib.rs)*/
export function toTauriAccelerator(acc: string | undefined): string | undefined {
  if (!acc) return undefined
  let out = acc.replace(/Mod\+/gi, 'CmdOrCtrl+').replace(/Alt\+/gi, 'Alt+')
  if (/^Ctrl\+/i.test(acc)) {
    out = acc.replace(/Ctrl\+/gi, 'Ctrl+')
  }
  out = out
    .replace(/\+b$/i, '+KeyB')
    .replace(/\+i$/i, '+KeyI')
    .replace(/\+z$/i, '+KeyZ')
    .replace(/\+y$/i, '+KeyY')
    .replace(/\+x$/i, '+KeyX')
    .replace(/\+c$/i, '+KeyC')
    .replace(/\+v$/i, '+KeyV')
    .replace(/\+a$/i, '+KeyA')
    .replace(/\+f$/i, '+KeyF')
    .replace(/\+g$/i, '+KeyG')
    .replace(/\+h$/i, '+KeyH')
    .replace(/\+k$/i, '+KeyK')
    .replace(/\+p$/i, '+KeyP')
    .replace(/\+s$/i, '+KeyS')
    .replace(/\+w$/i, '+KeyW')
    .replace(/\+e$/i, '+KeyE')
    .replace(/\+n$/i, '+KeyN')
    .replace(/\+o$/i, '+KeyO')
    .replace(/\+t$/i, '+KeyT')
    .replace(/\+u$/i, '+KeyU')
    .replace(/\+m$/i, '+KeyM')
    .replace(/\+q$/i, '+KeyQ')
    .replace(/\+1$/i, '+Digit1')
    .replace(/\+2$/i, '+Digit2')
    .replace(/\+3$/i, '+Digit3')
    .replace(/\+4$/i, '+Digit4')
    .replace(/\+5$/i, '+Digit5')
    .replace(/\+6$/i, '+Digit6')
    .replace(/\+0$/i, '+Digit0')
    .replace(/\+`$/i, '+Backquote')
    .replace(/\+,$/i, '+Comma')
    .replace(/\+\/$/i, '+Slash')
    .replace(/\\$/i, 'Backslash')
    .replace(/\+Shift\+x$/i, '+Shift+KeyX')
    .replace(/\+Shift\+f$/i, '+Shift+KeyF')
    .replace(/\+Alt\+f$/i, '+Alt+KeyF')
    .replace(/\+Shift\+z$/i, '+Shift+KeyZ')
    .replace(/\+Shift\+k$/i, '+Shift+KeyK')
    .replace(/\+Shift\+i$/i, '+Shift+KeyI')
    .replace(/\+Shift\+p$/i, '+Shift+KeyP')
    .replace(/\+Shift\+g$/i, '+Shift+KeyG')
    .replace(/\+Shift\+q$/i, '+Shift+KeyQ')
    .replace(/\+Shift\+\]$/i, '+Shift+BracketRight')
    .replace(/\+Shift\+\[$/i, '+Shift+BracketLeft')
    .replace(/\+Shift\+m$/i, '+Shift+KeyM')
    .replace(/\+Shift\+5$/i, '+Shift+Digit5')
    .replace(/\+Alt\+c$/i, '+Alt+KeyC')
    .replace(/\+Alt\+k$/i, '+Alt+KeyK')
    .replace(/\+Alt\+t$/i, '+Alt+KeyT')
    .replace(/\+Alt\+u$/i, '+Alt+KeyU')
    .replace(/\+Alt\+o$/i, '+Alt+KeyO')
    .replace(/\+Alt\+b$/i, '+Alt+KeyB')
    .replace(/\+Alt\+x$/i, '+Alt+KeyX')
    .replace(/\+Ctrl\+i$/i, '+Ctrl+KeyI')
    .replace(/\+Ctrl\+f$/i, '+Ctrl+KeyF')
    .replace(/^F(\d+)$/i, 'F$1')
    .replace(/^Shift\+F(\d+)$/i, 'Shift+F$1')
    .replace(/^Alt\+F(\d+)$/i, 'Alt+F$1')
  return out
}

/** Global shortcut plugin: CommandOrControl+Shift+D style (from manifest Mod+Shift+d). */
export function toGlobalShortcutAccelerator(acc: string | undefined): string | undefined {
  const tauri = toTauriAccelerator(acc)
  if (!tauri) return undefined
  return tauri
    .replace(/CmdOrCtrl\+/gi, 'CommandOrControl+')
    .replace(/\+Key([A-Z])/gi, '+$1')
    .replace(/\+Digit(\d)/gi, '+$1')
    .replace(/\+([a-z])$/i, (_, letter: string) => `+${letter.toUpperCase()}`)
}

export type ParsedAccelerator = {
  /** CmdOrCtrl: ⌘ for macOS, Ctrl for Win/Linux*/
  mod: boolean
  /** Explicit Control (macOS strikethrough ⌃⇧`)*/
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

/** Parse Mod+Shift+b, Ctrl+Shift+`, F3, Alt+F4, etc.*/
export function parseAccelerator(acc: string): ParsedAccelerator {
  const trimmed = acc.trim()
  if (!trimmed) throw new Error('empty accelerator')
  const parts = trimmed.split('+').map((p) => p.trim())
  if (parts.length === 0) throw new Error(`invalid accelerator: ${acc}`)

  let mod = false
  let ctrl = false
  let shift = false
  let alt = false
  let key = ''

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'mod') {
      mod = true
      continue
    }
    if (lower === 'ctrl') {
      ctrl = true
      continue
    }
    if (lower === 'shift') {
      shift = true
      continue
    }
    if (lower === 'alt') {
      alt = true
      continue
    }
    if (key) throw new Error(`invalid accelerator (multiple keys): ${acc}`)
    key = part
  }

  if (!key) throw new Error(`invalid accelerator (missing key): ${acc}`)
  return { mod, ctrl, shift, alt, key: normalizeAccelKey(key) }
}

function normalizeAccelKey(key: string): string {
  const k = key.toLowerCase()
  if (k === 'comma') return ','
  if (k === 'slash') return '/'
  if (k === 'backslash' || k === '\\') return '\\'
  if (k === 'backquote' || k === '`') return '`'
  if (k === 'bracketleft' || k === '[') return '['
  if (k === 'bracketright' || k === ']') return ']'
  if (k === 'equal' || k === '=') return '='
  if (k === 'minus' || k === '-') return '-'
  if (k === 'plus' || k === '+') return '+'
  if (/^f\d{1,2}$/i.test(key)) return key.toUpperCase()
  if (k.length === 1) return k
  return key
}

function modPressed(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function explicitCtrlPressed(event: KeyboardEvent): boolean {
  return event.ctrlKey
}

/** Whether the keyboard event matches the accelerator in registry/schema*/
export function eventMatchesAccelerator(event: KeyboardEvent, acc: string): boolean {
  const parsed = parseAccelerator(acc)
  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false

  if (parsed.mod && parsed.ctrl) {
    if (!modPressed(event) || !explicitCtrlPressed(event)) return false
  } else if (parsed.mod) {
    if (!modPressed(event)) return false
  } else if (parsed.ctrl) {
    if (!explicitCtrlPressed(event)) return false
  } else if (modPressed(event) && !parsed.alt && !/^F\d{1,2}$/i.test(parsed.key)) {
    return false
  }

  const key = parsed.key
  if (key === '\\') {
    return event.key === '\\' || event.code === 'Backslash'
  }
  if (key === '[') {
    return event.key === '[' || event.code === 'BracketLeft'
  }
  if (key === ']') {
    return event.key === ']' || event.code === 'BracketRight'
  }
  if (key === '=' || key === '+') {
    return event.key === '=' || event.key === '+' || event.code === 'Equal'
  }
  if (key === '-') {
    return event.key === '-' || event.code === 'Minus'
  }
  if (key === '/') {
    const slash =
      event.code === 'NumpadDivide' ||
      event.code === 'Slash' ||
      event.key === '/' ||
      event.key === '?'
    return slash
  }
  if (key === ',') {
    return event.key === ',' || event.code === 'Comma'
  }
  if (key === '`') {
    return event.key === '`' || event.code === 'Backquote'
  }
  if (/^F\d{1,2}$/i.test(key)) {
    return event.key.toUpperCase() === key.toUpperCase() || event.code === `F${key.slice(1)}`
  }
  if (/^[0-9]$/.test(key)) {
    return event.key === key || event.code === `Digit${key}` || event.code === `Numpad${key}`
  }
  return event.key.toLowerCase() === key.toLowerCase()
}
