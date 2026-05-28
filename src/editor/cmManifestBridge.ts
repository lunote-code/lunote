/**
 * Bridge for CodeMirror keymaps → executeManifestCommand.
 */
import { keymap, EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { Compartment, Prec } from '@codemirror/state'
import { commitSourceEphemeralSession, getSourceEphemeralSession } from './ephemeralFormattingSource'
import { getEffectiveAccelerator } from '../menu/shortcutCustomization'

type ManifestExecutor = (commandId: string) => void

const executorRef: { current: ManifestExecutor | null } = { current: null }

/** Each EditorView has an independent Compartment to avoid module-level singletons from leaking configuration when rebuilding the editor.*/
const compartmentByView = new WeakMap<EditorView, Compartment>()

export function setCmManifestCommandExecutor(executor: ManifestExecutor | null): void {
  executorRef.current = executor
}

function dispatchManifest(commandId: string) {
  return (): boolean => {
    const exec = executorRef.current
    if (!exec) return false
    exec(commandId)
    return true
  }
}

function accelToCmKey(acc: string): string {
  return acc.replace(/\+/g, '-')
}

/** Source code mode: driven by manifest default and user-overridden shortcut keys*/
const CM_COMMAND_IDS = [
  'fmt-bold',
  'fmt-italic',
  'fmt-strike',
  'fmt-inline-code',
  'fmt-link',
  'fmt-image',
  'para-h1',
  'para-h2',
  'para-h3',
  'para-h4',
  'para-h5',
  'para-h6',
  'para-ul',
  'para-ol',
  'para-task',
  'para-quote',
  'para-insert-code-block',
] as const

function buildCmBindings(): { key: string; run: () => boolean }[] {
  const bindings: { key: string; run: () => boolean }[] = []
  const seen = new Set<string>()
  for (const id of CM_COMMAND_IDS) {
    const acc = getEffectiveAccelerator(id)
    if (!acc) continue
    const cmKey = accelToCmKey(acc)
    if (seen.has(cmKey)) continue
    seen.add(cmKey)
    bindings.push({ key: cmKey, run: dispatchManifest(id) })
    const lower = cmKey.toLowerCase()
    if (lower !== cmKey && !seen.has(lower)) {
      seen.add(lower)
      bindings.push({ key: lower, run: dispatchManifest(id) })
    }
  }
  return bindings
}

/** Mounted to EditorView; call reconfigureCmManifestKeymap after the user modifies the shortcut key*/
export function createCmManifestKeymapExtension(): Extension {
  const compartment = new Compartment()
  return [
    compartment.of(keymap.of(buildCmBindings())),
    EditorView.updateListener.of((update) => {
      compartmentByView.set(update.view, compartment)
    }),
  ]
}

/** @deprecated Use createCmManifestKeymapExtension; retain compatibility with old assemblies*/
export const cmManifestKeymap: Extension = createCmManifestKeymapExtension()

/** Update open source code editor keybinds after preference changes*/
export function reconfigureCmManifestKeymap(view: EditorView): void {
  const compartment = compartmentByView.get(view)
  if (!compartment) return
  view.dispatch({
    effects: compartment.reconfigure(keymap.of(buildCmBindings())),
  })
}

/** Source code ephemeral: Enter ends the session, retaining Markdown wrapping syntax*/
export const cmEphemeralEnterCommit: Extension = Prec.high(
  keymap.of([
    {
      key: 'Enter',
      run: (view) => {
        if (getSourceEphemeralSession(view)) {
          commitSourceEphemeralSession(view)
        }
        return false
      },
    },
  ]),
)
