import { Extension } from '@tiptap/core'
import { isCodeEditGuardActive, isInlineCodeMarkActive, isPosInsideCodeSpecBlock } from './lunaCodeContext'
import { commitEphemeralSession, getEphemeralSession } from './ephemeralFormatting'

/**
 * Intercept the inline format shortcut key inside Tiptap and route it to executeManifestCommand.
 * All formatting operations are performed through the Transaction VM and runEphemeralCommand is no longer called directly.
 *
 * Note: Mod-b / Mod-i / Mod-` / Mod-Shift-x already have accelerator in the manifest.
 * window-capture (shortcutRuntime) will capture before Tiptap.
 * This Extension serves as a backstop inside Tiptap, ensuring that it can be triggered even when the focus is on Tiptap.
 * Mod-e (code) / Mod-Shift-s (strike) no accelerator in manifest,
 * Only injected by this Extension.
 */
export const LunaEphemeralFormattingShortcuts = Extension.create({
  name: 'lunaEphemeralFormattingShortcuts',

  priority: 3100,

  addKeyboardShortcuts() {
    const dispatch = (commandId: string) => () => {
      if (this.editor.view.composing) return false
      if (isCodeEditGuardActive(this.editor.state)) return false

      const executor = lunaManifestCommandExecutorRef.current
      if (!executor) return false
      executor(commandId)
      return true
    }

    return {
      'Mod-b': dispatch('fmt-bold'),
      'Mod-B': dispatch('fmt-bold'),
      'Mod-i': dispatch('fmt-italic'),
      'Mod-I': dispatch('fmt-italic'),
      'Mod-e': dispatch('fmt-inline-code'),
      'Mod-E': dispatch('fmt-inline-code'),
      'Mod-`': dispatch('fmt-inline-code'),
      'Mod-Shift-s': dispatch('fmt-strike'),
      'Mod-Shift-S': dispatch('fmt-strike'),
    }
  },
})

/** Ephemeral inline format: Enter submits the current format and breaks the line. The new line no longer inherits code/bold and other marks.*/
export const LunaEphemeralCommitOnEnter = Extension.create({
  name: 'lunaEphemeralCommitOnEnter',

  priority: 3200,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (editor.view.composing) return false
        if (isPosInsideCodeSpecBlock(editor.state.selection.$from)) return false

        const hasSession = Boolean(getEphemeralSession(editor))
        const inInlineCode = isInlineCodeMarkActive(editor.state)
        if (!hasSession && !inInlineCode) return false

        if (hasSession) {
          commitEphemeralSession(editor)
        } else {
          const codeMark = editor.state.schema.marks.code
          if (codeMark) {
            editor.view.dispatch(editor.state.tr.removeStoredMark(codeMark).setStoredMarks([]))
          }
        }
        return editor.commands.splitBlock({ keepMarks: false })
      },
    }
  },
})

// ─────────────────────────────────────────────────────────────
// Module-level executor bridge
// App.tsx calls setLunaManifestCommandExecutor() on mount.
// ─────────────────────────────────────────────────────────────

type CommandExecutor = (commandId: string) => void | Promise<void>

const lunaManifestCommandExecutorRef: { current: CommandExecutor | null } = { current: null }

export function setLunaManifestCommandExecutor(executor: CommandExecutor | null): void {
  lunaManifestCommandExecutorRef.current = executor
}

export function getLunaManifestCommandExecutor(): CommandExecutor | null {
  return lunaManifestCommandExecutorRef.current
}
