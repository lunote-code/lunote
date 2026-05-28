import { EditorState, EditorSelection, type Extension } from '@codemirror/state'

/**
 * Single `EditorState.create`: doc + selection + extensions are completed in the same batch.
 * It is used for source code mode mounting to avoid the loss of the selection caused by "mounting the empty document first and then replacing the full controlled value".
 */
export function createModeSwitchEditorState(args: {
  doc: string
  extensions: Extension[]
  /** Only Visual→Source is passed in when restoring; cold open must be omitted and the CM default selection (document starting point) is used.*/
  selection?: ReturnType<typeof EditorSelection.single>
}): EditorState {
  if (args.selection !== undefined) {
    return EditorState.create({
      doc: args.doc,
      selection: args.selection,
      extensions: args.extensions,
    })
  }
  return EditorState.create({
    doc: args.doc,
    extensions: args.extensions,
  })
}
