import { bridgeRefocusActiveEditor } from '../editor/editorMutationBridge'
import { dispatchAppMenuAction } from './dispatchAppMenu'
import { COMMAND_MANIFEST } from './commandManifest.entries'
import type { AppMenuContext, AppMenuUiDeps } from './menu.types'
import { resolveCommand } from './commandResolve'
import { hasCommandResolver } from './commandResolution.rules'
import type { ResolvedCommand } from './commandResolution.types'
import { VM_MUTATION_KINDS } from './commandResolution.types'
import { createTransaction, executeOps } from './commandTransaction'

async function waitNextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function reportUnresolvedManifestCommand(commandId: string): void {
  if (COMMAND_MANIFEST[commandId]) {
    console.error(
      `[CommandVM] "${commandId}" exists in COMMAND_MANIFEST but has no resolver. Add an explicit resolver or change the caller to dispatchAppMenuAction().`,
    )
    return
  }
  console.error(
    `[CommandVM] "${commandId}" is not a registered manifest command. Use dispatchAppMenuAction() for raw UI actions instead of executeManifestCommand().`,
  )
}

type MutationResolved = Extract<
  ResolvedCommand,
  { kind: 'tiptap-command' | 'tiptap-ephemeral' | 'source-ephemeral' | 'source-command' }
>

async function runEditorMutation(resolved: MutationResolved, m: AppMenuContext): Promise<boolean> {
  if (import.meta.env.DEV && resolved.commandId === 'fmt-clear-style') {
    console.debug('[command-vm][editor-mutation]', {
      commandId: resolved.commandId,
      kind: resolved.kind,
      editorMode: m.getEditorContext().mode,
    })
  }
  bridgeRefocusActiveEditor()
  let transaction = createTransaction(resolved)
  if (!transaction) {
    await waitNextFrame()
    bridgeRefocusActiveEditor()
    transaction = createTransaction(resolved)
  }
  if (!transaction) {
    console.warn(
      `[CommandVM] createTransaction returned null for "${resolved.commandId}" — editor not ready?`,
    )
    m.setStatus(m.t('app.status.editorCommandNotReady'))
    return false
  }
  executeOps(transaction)
  bridgeRefocusActiveEditor()
  return true
}

// ─────────────────────────────────────────────────────────────
// Core executor — Transaction VM gate
// ─────────────────────────────────────────────────────────────

export async function executeResolvedCommand(
  resolved: ResolvedCommand,
  m: AppMenuContext,
  ui?: AppMenuUiDeps,
): Promise<void> {
  switch (resolved.kind) {
    case 'noop':
      return

    case 'noop-explicit':
      m.setStatus(m.t('app.command.notImplemented'))
      return

    case 'delegate-app':
      if (ui) await dispatchAppMenuAction(resolved.action, m, ui)
      return

    case 'tiptap-command':
    case 'tiptap-ephemeral':
    case 'source-ephemeral':
    case 'source-command': {
      if (!VM_MUTATION_KINDS.has(resolved.kind)) {
        console.error(`[CommandVM] BUG: unknown mutation kind "${resolved.kind}" bypasses VM`)
        return
      }
      await runEditorMutation(resolved, m)
      return
    }

    default: {
      const _exhaustive: never = resolved
      void _exhaustive
      return
    }
  }
}

// ─────────────────────────────────────────────────────────────
// tryExecuteResolvedManifestAction
// ─────────────────────────────────────────────────────────────

/** The manifest command of the registered resolver: resolve → execute, returning true means it has been consumed*/
export async function tryExecuteResolvedManifestAction(
  action: string,
  m: AppMenuContext,
  ui: AppMenuUiDeps,
): Promise<boolean> {
  if (!hasCommandResolver(action)) return false
  const resolved = resolveCommand(action, m.getEditorContext())
  // delegate-app must fall through to tryDispatchExtendedMenuAction (etc.).
  // Calling executeResolvedCommand here would re-enter dispatchAppMenuAction → infinite loop.
  if (resolved.kind === 'delegate-app') return false
  if (resolved.kind === 'noop' || resolved.kind === 'noop-explicit') return false
  await executeResolvedCommand(resolved, m, ui)
  return true
}

// ─────────────────────────────────────────────────────────────
// executeManifestCommand — unified entry point for all command initiators
// ─────────────────────────────────────────────────────────────

/**
 * Unified manifest execution entrance (shortcut keys / command panel / menu / Tauri / CodeMirror keymap).
 * Resolver exists → resolveCommand → Transaction VM → EditorMutationBridge.
 * Unregistered command ids are treated as caller bugs and will no longer fall back to dispatchAppMenuAction().
 */
export async function executeManifestCommand(
  commandId: string,
  m: AppMenuContext,
  ui: AppMenuUiDeps,
): Promise<void> {
  if (hasCommandResolver(commandId)) {
    const resolved = resolveCommand(commandId, m.getEditorContext())
    await executeResolvedCommand(resolved, m, ui)
    return
  }
  void m
  void ui
  reportUnresolvedManifestCommand(commandId)
}
