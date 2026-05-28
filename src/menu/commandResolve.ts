import type { EditorContext } from './commandContext'
import { COMMAND_RESOLUTION_REGISTRY } from './commandResolution.rules'
import type { ResolvedCommand } from './commandResolution.types'

/**
 * Parse manifest commandId + editor snapshot into executable instructions.
 *
 * All commandIds must be registered in COMMAND_RESOLUTION_REGISTRY,
 * Or mark runtime:'noop' in the manifest.
 * Unregistered commands are protected by delegate-app and a warning is issued.
 */
export function resolveCommand(commandId: string, editorContext: EditorContext): ResolvedCommand {
  const resolver = COMMAND_RESOLUTION_REGISTRY[commandId]
  if (resolver) return resolver(editorContext)
  //Bottom line: non-registered commands are considered app-level operations, so go directly to dispatchAppMenuAction
  //(Still maintains bypass path to facilitate incremental migration; should all be registered eventually)
  return { kind: 'delegate-app', commandId, action: commandId }
}
