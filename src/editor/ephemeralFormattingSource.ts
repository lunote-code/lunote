import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { EphemeralCommandType } from './ephemeralFormatting'

export type SourceEphemeralSession = {
  commandType: EphemeralCommandType
  range: { from: number; to: number }
  snapshot: string
  state: 'active'
  left: string
  right: string
}

const sourceSessions = new WeakMap<EditorView, SourceEphemeralSession>()

const WRAPPERS: Record<EphemeralCommandType, { left: string; right: string }> = {
  bold: { left: '**', right: '**' },
  italic: { left: '*', right: '*' },
  strike: { left: '~~', right: '~~' },
  code: { left: '`', right: '`' },
  underline: { left: '<u>', right: '</u>' },
}

export function getSourceEphemeralSession(view: EditorView): SourceEphemeralSession | null {
  return sourceSessions.get(view) ?? null
}

export function destroySourceEphemeralSession(view: EditorView): void {
  sourceSessions.delete(view)
}

/** Enter confirms the source code ephemeral: retain `*…*` / `` `…` `` package, end session*/
export function commitSourceEphemeralSession(view: EditorView): boolean {
  if (!sourceSessions.has(view)) return false
  destroySourceEphemeralSession(view)
  return true
}

/**
 * Source code mode ephemeral: Wrap the selection for the first time, and use the same command again to restore the snapshot plain text.
 */
export function runEphemeralSurround(
  view: EditorView,
  commandType: EphemeralCommandType,
): boolean {
  const wrap = WRAPPERS[commandType]
  const { from, to } = view.state.selection.main
  const existing = sourceSessions.get(view)

  if (existing) {
    if (existing.commandType === commandType) {
      const { range, snapshot } = existing
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: snapshot },
        selection: EditorSelection.range(
          range.from,
          range.from + snapshot.length,
        ),
      })
      sourceSessions.delete(view)
      return true
    }
    destroySourceEphemeralSession(view)
  }

  const selected = view.state.doc.sliceString(from, to)
  const insert = `${wrap.left}${selected}${wrap.right}`
  const rangeFrom = from
  const rangeTo = from + insert.length

  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.range(
      from + wrap.left.length,
      from + wrap.left.length + selected.length,
    ),
  })

  sourceSessions.set(view, {
    commandType,
    range: { from: rangeFrom, to: rangeTo },
    snapshot: selected,
    state: 'active',
    left: wrap.left,
    right: wrap.right,
  })
  return true
}
