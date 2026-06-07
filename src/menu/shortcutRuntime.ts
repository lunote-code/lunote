import type { CommandManifestEntry } from './commandManifest.types'
import {
  listBoundShortcutCommands,
  registryCommandMatchesEventWithOverrides,
} from './shortcutCustomization'
import { eventMatchesAccelerator } from './menu.shortcuts'
import { isCodeBlockCmFocused } from '../editor/codeBlock/cm/codeBlockCmFocus'
import { isEditorPasteFocusTarget, isNonEditorTextInputTarget } from '../editor/webviewPasteFocus'

/** Mod+V: native paste (clipboardData) in the webview. */
const NATIVE_CLIPBOARD_ALWAYS_COMMAND_IDS = new Set<string>(['edit-paste'])
/** Mod+C / Mod+X in ProseMirror/CodeMirror: native copy/cut so images & rich nodes serialize correctly. */
const NATIVE_CLIPBOARD_IN_EDITOR_COMMAND_IDS = new Set<string>(['edit-copy', 'edit-cut'])
/** Mod+A in embedded code-block CM: let CodeMirror selectAll run (registry capture would PM-select a stale paragraph). */
const NATIVE_SELECT_ALL_IN_CODE_CM_COMMAND_IDS = new Set<string>(['edit-select-all'])
/** Mod+Z / Mod+Shift+Z in embedded code-block CM: route through CM keymap → VM undo (PM native history is off). */
const NATIVE_UNDO_IN_CODE_CM_COMMAND_IDS = new Set<string>(['edit-undo', 'edit-redo'])
const INPUT_SAFE_RUNTIMES = new Set<CommandManifestEntry['runtime']>(['app-mode-toggle'])

export type RegistryShortcutHandlers = {
  /** manifest commandId → resolveCommand → executeManifestCommand */
  executeManifestCommand: (commandId: string) => void | Promise<void>
  dispatchMenuAction: (action: string) => void | Promise<void>
  onSave: () => void | Promise<void>
  onSaveAs?: () => void | Promise<void>
  onCloseTab?: () => void | Promise<void>
  onQuit?: () => void | Promise<void>
  onCloseWindow: () => void | Promise<void>
  onPreferences: () => void
  onFocusMode: () => void
  onModeToggle: () => void
  /** There is no paste event scenario such as "Paste" in the menu bar; Mod+V does not go through this callback*/
  onEditorPaste?: (plainOnly?: boolean) => void | Promise<void>
  /** Return true to indicate that it has been processed and prevent subsequent binding.*/
  isBlocked?: () => boolean
}

function runCommand(def: CommandManifestEntry, handlers: RegistryShortcutHandlers): void {
  switch (def.runtime) {
    case 'menu':
      void handlers.executeManifestCommand(def.id)
      return
    case 'app-save':
      void handlers.onSave()
      return
    case 'app-save-as':
      void handlers.onSaveAs?.()
      return
    case 'app-close-tab':
      void handlers.onCloseTab?.()
      return
    case 'app-quit':
      void handlers.onQuit?.()
      return
    case 'app-close-window':
      void handlers.onCloseWindow()
      return
    case 'app-preferences':
      handlers.onPreferences()
      return
    case 'app-focus-mode':
      handlers.onFocusMode()
      return
    case 'app-mode-toggle':
      handlers.onModeToggle()
      return
    default:
      return
  }
}

/**
 * Unified shortcut runtime: Match keyboard events from the command registry and distribute them.
 * Use capture phase, consistent with Typora style global shortcuts.
 */
export function createRegistryShortcutHandler(
  handlers: RegistryShortcutHandlers,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented) return

    const bound = listBoundShortcutCommands().filter((c) => !NATIVE_CLIPBOARD_ALWAYS_COMMAND_IDS.has(c.id))
    for (const def of bound) {
      if (!def.accelerator) continue
      if (!eventMatchesAccelerator(event, def.accelerator)) continue
      if (handlers.isBlocked?.() && def.runtime !== 'app-mode-toggle') continue
      if (NATIVE_CLIPBOARD_IN_EDITOR_COMMAND_IDS.has(def.id) && isEditorPasteFocusTarget()) continue
      if (NATIVE_SELECT_ALL_IN_CODE_CM_COMMAND_IDS.has(def.id) && isCodeBlockCmFocused()) continue
      if (NATIVE_UNDO_IN_CODE_CM_COMMAND_IDS.has(def.id) && isCodeBlockCmFocused()) continue
      //Find/replace box, sidebar search, etc.: Prioritize keeping native input shortcut keys and not triggering global commands
      if (isNonEditorTextInputTarget() && !INPUT_SAFE_RUNTIMES.has(def.runtime)) continue
      event.preventDefault()
      event.stopPropagation()
      runCommand(def, handlers)
      return
    }
  }
}

/** For testing: given the registry id, determine whether it matches keyboard events (including user overrides)*/
export function registryCommandMatchesEvent(commandId: string, event: KeyboardEvent): boolean {
  return registryCommandMatchesEventWithOverrides(commandId, event)
}
