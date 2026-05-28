import type { TiptapEditorCommand } from '../editor/TiptapMarkdownEditor'
import type { EphemeralCommandType } from '../editor/ephemeralFormatting'
import type { CommandRuntimeKind } from './commandManifest.types'
import type { SourceEditorOp } from './commandOps.types'

/**
 * The output of resolveCommand - the only command form allowed to enter the Transaction VM.
 *
 * noop : this command is prohibited by context (code-guard/readonly), silently skipped
 * noop-explicit: The command with explicit runtime:'noop' in the manifest, the function is not implemented/not applicable to the platform
 * delegate-app: non-editor change command (file/view/window/system), go directly to dispatchAppMenuAction
 * tiptap-command : go VM → EditorMutationBridge → runTiptapCommand
 * tiptap-ephemeral: go VM → EditorMutationBridge → runEphemeralCommand (inline format)
 * source-ephemeral: go VM → EditorMutationBridge → runEphemeralSurround (source code inline format)
 * source-command: go VM → EditorMutationBridge → executeBridgeSourceOp
 *
 * Deleted: 'tiptap' (legacy alias for tiptap-command), 'app' (never produced)
 */
export type ResolvedCommand =
  | { kind: 'noop'; reason: string; commandId: string }
  | { kind: 'noop-explicit'; commandId: string; reason: string }
  | { kind: 'delegate-app'; commandId: string; action: string }
  | { kind: 'tiptap-command'; commandId: string; command: TiptapEditorCommand }
  | {
      kind: 'tiptap-ephemeral'
      commandId: string
      mark: EphemeralCommandType
      placeholder?: string
    }
  | { kind: 'source-ephemeral'; commandId: string; mark: EphemeralCommandType }
  | { kind: 'source-command'; commandId: string; op: SourceEditorOp }

// Narrow union of kinds that mutate editor state (must pass through Transaction VM)
export const VM_MUTATION_KINDS = new Set<ResolvedCommand['kind']>([
  'tiptap-command',
  'tiptap-ephemeral',
  'source-ephemeral',
  'source-command',
])

export type CommandResolver = (ctx: import('./commandContext').EditorContext) => ResolvedCommand

// CommandRuntimeKind is re-exported for consumers who imported it through here
export type { CommandRuntimeKind }
