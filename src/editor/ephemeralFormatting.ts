import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

/** Inline ephemeral format (not structured formats such as link/math/footnote)*/
export type EphemeralCommandType = 'bold' | 'italic' | 'underline' | 'strike' | 'code'

export type EphemeralSessionState = 'active'

export type EphemeralSession = {
  commandType: EphemeralCommandType
  range: { from: number; to: number }
  snapshot: string
  state: EphemeralSessionState
}

export type RunEphemeralOptions = {
  /** Placeholder text inserted when the selection is empty (slash command)*/
  placeholder?: string
  focusNoScroll?: boolean
}

const sessions = new WeakMap<Editor, EphemeralSession>()

const FOCUS_NO_SCROLL = { scrollIntoView: false as const }

export function getEphemeralSession(editor: Editor): EphemeralSession | null {
  return sessions.get(editor) ?? null
}

export function destroyEphemeralSession(editor: Editor): void {
  sessions.delete(editor)
}

/**
 * Confirm ephemeral input (Enter): retain the entered formatted text, end the session, new lines/subsequent input will no longer inherit the inline mark.
 * Different from "press the same command again to restore the snapshot", Enter means that the user accepts the current format and continues writing the text.
 */
export function commitEphemeralSession(editor: Editor): boolean {
  const session = sessions.get(editor)
  if (!session) return false
  destroyEphemeralSession(editor)

  const markType = editor.state.schema.marks[session.commandType]
  const tr = editor.state.tr
  if (markType) tr.removeStoredMark(markType)
  tr.setStoredMarks([])
  editor.view.dispatch(tr)
  return true
}

function unsetEphemeralMark(
  chain: ReturnType<Editor['chain']>,
  commandType: EphemeralCommandType,
): ReturnType<Editor['chain']> {
  switch (commandType) {
    case 'bold':
      return chain.unsetBold()
    case 'italic':
      return chain.unsetItalic()
    case 'underline':
      return chain.unsetUnderline()
    case 'strike':
      return chain.unsetStrike()
    case 'code':
      return chain.unsetCode()
    default:
      return chain
  }
}

function setEphemeralMark(
  chain: ReturnType<Editor['chain']>,
  commandType: EphemeralCommandType,
): ReturnType<Editor['chain']> {
  switch (commandType) {
    case 'bold':
      return chain.setBold()
    case 'italic':
      return chain.setItalic()
    case 'underline':
      return chain.setUnderline()
    case 'strike':
      return chain.setStrike()
    case 'code':
      return chain.setCode()
    default:
      return chain
  }
}

function extendEphemeralMarkRange(
  chain: ReturnType<Editor['chain']>,
  commandType: EphemeralCommandType,
): ReturnType<Editor['chain']> {
  return chain.extendMarkRange(commandType)
}

function sessionContentRange(session: EphemeralSession): { from: number; to: number } {
  const from = session.range.from
  const to = session.snapshot.length > 0 ? from + session.snapshot.length : session.range.to
  return { from, to }
}

function restoreSession(editor: Editor, session: EphemeralSession, focusNoScroll: boolean): boolean {
  const focusOpts = focusNoScroll ? FOCUS_NO_SCROLL : undefined
  const { snapshot, commandType } = session
  const { from, to } = sessionContentRange(session)
  const docSize = editor.state.doc.content.size
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false
  const safeFrom = Math.max(0, Math.min(from, docSize))
  const safeTo = Math.max(safeFrom, Math.min(to, docSize))
  const markType = editor.state.schema.marks[commandType]
  if (!markType) return false

  if (snapshot === '') {
    if (safeFrom === safeTo) {
      const chain = editor.chain().focus(null, focusOpts)
      unsetEphemeralMark(chain, commandType).run()
      const tr = editor.state.tr.setStoredMarks([])
      editor.view.dispatch(tr)
      return true
    }
    const tr = editor.state.tr.delete(safeFrom, safeTo).setStoredMarks([])
    tr.setSelection(TextSelection.create(tr.doc, safeFrom))
    if (!focusNoScroll) tr.scrollIntoView()
    editor.view.dispatch(tr)
    return true
  }

  const chain = editor.chain().focus(null, focusOpts)
  chain
    .setTextSelection({ from: safeFrom, to: safeTo })
    .extendMarkRange(commandType)
  unsetEphemeralMark(chain, commandType).run()
  return true
}

function applyEphemeralFormat(
  editor: Editor,
  commandType: EphemeralCommandType,
  placeholder: string | undefined,
  focusNoScroll: boolean,
): { from: number; to: number; snapshot: string } | null {
  const focusOpts = focusNoScroll ? FOCUS_NO_SCROLL : undefined
  const { from, to, empty } = editor.state.selection

  if (empty && placeholder) {
    const markNode = { type: commandType } as const
    const ok = editor
      .chain()
      .focus(null, focusOpts)
      .insertContent([{ type: 'text', text: placeholder, marks: [markNode] }])
      .run()
    if (!ok) return null
    const range = { from, to: from + placeholder.length }
    return { ...range, snapshot: '' }
  }

  const chain = editor.chain().focus(null, focusOpts)
  const snapshot = empty ? '' : editor.state.doc.textBetween(from, to, '\n', '\n')
  const markType = editor.state.schema.marks[commandType]
  const alreadyMarked =
    !empty && markType != null && editor.state.doc.rangeHasMark(from, to, markType)

  if (!empty) {
    if (!alreadyMarked) {
      extendEphemeralMarkRange(chain, commandType)
      if (!setEphemeralMark(chain, commandType).run()) return null
    }
    return { from, to: from + snapshot.length, snapshot }
  }

  if (!setEphemeralMark(chain, commandType).run()) return null
  return { from, to: from, snapshot: '' }
}

/**
 * Ephemeral format unified entrance: applied for the first time, restore the snapshot with the same command again.
 * Disable toggle semantics; always setMark / insert placeholder, insertText or unsetMark when restoring.
 */
export function runEphemeralCommand(
  editor: Editor,
  commandType: EphemeralCommandType,
  options?: RunEphemeralOptions,
): boolean {
  const focusNoScroll = options?.focusNoScroll ?? true
  const existing = sessions.get(editor)

  if (existing) {
    if (existing.commandType === commandType) {
      restoreSession(editor, existing, focusNoScroll)
      destroyEphemeralSession(editor)
      return true
    }
    commitEphemeralSession(editor)
  }

  const applied = applyEphemeralFormat(editor, commandType, options?.placeholder, focusNoScroll)
  if (!applied) return false

  const contentTo = applied.snapshot.length > 0 ? applied.from + applied.snapshot.length : applied.to
  sessions.set(editor, {
    commandType,
    range: { from: applied.from, to: contentTo },
    snapshot: applied.snapshot,
    state: 'active',
  })
  return true
}
