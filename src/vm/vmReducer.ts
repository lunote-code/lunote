/**
 * VM Reducer — pure function: VMCommand → VMBridgeOp[]
 *
 * This is the VM's decision layer.  It:
 *   - Receives a VMCommand (pure data, all context pre-sampled)
 *   - Produces VMBridgeOp[] (what the bridge must execute)
 *   - Has NO side effects
 *   - Does NOT read editor state (context is in the command)
 *   - Is deterministic: same command → same ops
 *
 * The bridge then executes the ops.  VmTiptapRecorder / VmCmRecorder capture
 * the resulting PM / CM steps for the undo stack — those are the precise,
 * atomic, invertible steps that encode undo data the VM reducer cannot pre-
 * compute without maintaining a full parallel document model.
 *
 * Architecture:
 *   VMCommand → vmReduce() → VMBridgeOp[] → editorMutationBridge.applyVMSteps()
 *                                                     ↓
 *                                            PM/CM transaction dispatched
 *                                                     ↓
 *                              VmTiptapRecorder / VmCmRecorder → VM undo log
 */

import type { VMCommand } from './vmCommands'
import type { VMBridgeOp } from './vmBridgeOps'

export type VMReducerResult = {
  /** Operations the bridge must execute in order */
  ops: VMBridgeOp[]
  /** Debug label (command type) */
  commandKind: string
}

/**
 * Pure VM reducer.
 * Maps a VMCommand to the sequence of bridge operations to execute.
 *
 * PURE FUNCTION — no side effects, no editor reads, deterministic.
 */
export function vmReduce(command: VMCommand): VMReducerResult {
  switch (command.kind) {
    // ─── Inline mark formatting ─────────────────────────────
    case 'formatMark': {
      if (command.selection.empty) {
        // Empty selection: insert placeholder text with the mark
        return {
          ops: [{ kind: 'ephemeralMark', mark: command.mark, placeholder: command.placeholder }],
          commandKind: 'formatMark',
        }
      }
      if (command.markCtx.isActive) {
        // Mark is fully active on selection → unset it (toggle off)
        return {
          ops: [{ kind: 'unsetMark', mark: command.mark, selection: command.selection }],
          commandKind: 'formatMark/unset',
        }
      }
      // Mark is absent or partial → set it (toggle on / extend)
      return {
        ops: [{ kind: 'setMark', mark: command.mark, selection: command.selection }],
        commandKind: 'formatMark/set',
      }
    }

    // ─── Block type changes ──────────────────────────────────
    case 'setBlockType': {
      const { targetNodeType, attrs, selection } = command
      switch (targetNodeType) {
        case 'heading':
          return {
            ops: [{ kind: 'setHeading', level: (attrs?.level as number) ?? 1, selection }],
            commandKind: 'setBlockType/heading',
          }
        case 'paragraph':
          return {
            ops: [{ kind: 'setParagraph', selection }],
            commandKind: 'setBlockType/paragraph',
          }
        case 'bulletList':
          return {
            ops: [{ kind: 'toggleBulletList', selection }],
            commandKind: 'setBlockType/bulletList',
          }
        case 'orderedList':
          return {
            ops: [{ kind: 'toggleOrderedList', selection }],
            commandKind: 'setBlockType/orderedList',
          }
        case 'taskList':
          return {
            ops: [{ kind: 'toggleTaskList', selection }],
            commandKind: 'setBlockType/taskList',
          }
        case 'blockquote':
          return {
            ops: [{ kind: 'toggleBlockquote', selection }],
            commandKind: 'setBlockType/blockquote',
          }
        default:
          return { ops: [], commandKind: `setBlockType/${targetNodeType}/unhandled` }
      }
    }

    // ─── Insert horizontal rule ──────────────────────────────
    case 'insertHr':
      return { ops: [{ kind: 'insertHr' }], commandKind: 'insertHr' }

    // ─── Plain text insertion (paste, drop) ──────────────────
    case 'insertPlainText':
      return {
        ops: [{ kind: 'insertText', text: command.text, selection: command.selection }],
        commandKind: 'insertPlainText',
      }

    // ─── Delete selection ────────────────────────────────────
    case 'deleteSelection':
      return {
        ops: [{ kind: 'deleteSelection', selection: command.selection }],
        commandKind: 'deleteSelection',
      }

    // ─── Cut ────────────────────────────────────────────────
    case 'cut':
      return {
        ops: [{ kind: 'cutSelection', selection: command.selection }],
        commandKind: 'cut',
      }

    // ─── Code fence insertion ────────────────────────────────
    case 'insertCodeFence':
      return {
        ops: [{ kind: 'insertCodeFence', language: command.language, mode: command.mode }],
        commandKind: 'insertCodeFence',
      }

    // ─── Source-mode structured op ───────────────────────────
    case 'sourceOp':
      return {
        ops: [{ kind: 'sourceOp', op: command.op }],
        commandKind: `sourceOp/${command.op.kind}`,
      }

    // ─── Source-mode ephemeral formatting ───────────────────
    case 'sourceEphemeral':
      return {
        ops: [{ kind: 'sourceEphemeral', mark: command.mark }],
        commandKind: `sourceEphemeral/${command.mark}`,
      }

    default: {
      const _exhaustive: never = command
      void _exhaustive
      return { ops: [], commandKind: 'unknown' }
    }
  }
}
