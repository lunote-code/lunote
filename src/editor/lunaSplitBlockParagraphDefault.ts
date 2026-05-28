import { Extension, defaultBlockAt, getSplittedAttributes } from '@tiptap/core'
import type { NodeType } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { canSplit } from '@tiptap/pm/transform'

import { isInlineCodeMarkActive, isPosInsideCodeSpecBlock } from './lunaCodeContext'
import { commitEphemeralSession, getEphemeralSession } from './ephemeralFormatting'

function ensureMarks(state: EditorState, splittableMarks?: string[]) {
  const marks = state.storedMarks || (state.selection.$to.parentOffset && state.selection.$from.marks())
  if (marks) {
    const filteredMarks = marks.filter((mark) => splittableMarks?.includes(mark.type.name))
    state.tr.ensureMarks(filteredMarks)
  }
}

/**
 * `defaultBlockAt` often hits heading first in the `block` grouping order, and Enter will create an empty title by mistake (like `#` in Markdown).
 * Typora behavior: Line breaks should default to normal paragraphs; headings are generated only by user input in ATX syntax or explicit commands.
 */
function preferParagraphOverHeadingDefault(
  schema: EditorState['schema'],
  raw: NodeType | null | undefined,
): NodeType | null | undefined {
  if (!raw) return raw
  const para = schema.nodes.paragraph
  if (raw.name === 'heading' && para) return para
  return raw
}

/**
 * Override core `splitBlock`, consistent with @tiptap/core/commands/splitBlock, only fixing the default block type selection.
 * Must come last in the extension list so that `addCommands` overrides a command of the same name in the built-in Commands.
 */
export const LunaSplitBlockParagraphDefault = Extension.create({
  name: 'lunaSplitBlockParagraphDefault',

  /** Lower than @tiptap/core Commands(100), ensuring that `splitBlock` of this extension overrides the built-in implementation when `addCommands` is merged*/
  priority: 50,

  addCommands() {
    return {
      splitBlock:
        ({ keepMarks = true } = {}) =>
        ({ tr, state, dispatch, editor }) => {
          if (editor.view.composing) return false
          if (getEphemeralSession(editor)) {
            commitEphemeralSession(editor)
            keepMarks = false
          } else if (isInlineCodeMarkActive(state)) {
            keepMarks = false
            const codeMark = state.schema.marks.code
            if (codeMark) {
              tr.removeStoredMark(codeMark)
              tr.setStoredMarks([])
            }
          }
          const { selection, doc } = tr
          const { $from, $to } = selection
          if (isPosInsideCodeSpecBlock($from)) {
            return false
          }
          const extensionAttributes = editor.extensionManager.attributes
          const newAttributes = getSplittedAttributes(extensionAttributes, $from.node().type.name, $from.node().attrs)

          if (selection instanceof NodeSelection && selection.node.isBlock) {
            if (!$from.parentOffset || !canSplit(doc, $from.pos)) {
              return false
            }

            if (dispatch) {
              if (keepMarks) {
                ensureMarks(state, editor.extensionManager.splittableMarks)
              }

              tr.split($from.pos).scrollIntoView()
            }

            return true
          }

          if (!$from.parent.isBlock) {
            return false
          }

          const atEnd = $to.parentOffset === $to.parent.content.size

          const rawDefault =
            $from.depth === 0 ? undefined : defaultBlockAt($from.node(-1).contentMatchAt($from.indexAfter(-1)))
          const deflt = preferParagraphOverHeadingDefault(state.schema, rawDefault)

          let types =
            atEnd && deflt
              ? [
                  {
                    type: deflt,
                    attrs: newAttributes,
                  },
                ]
              : undefined

          let can = canSplit(tr.doc, tr.mapping.map($from.pos), 1, types)

          if (!types && !can && canSplit(tr.doc, tr.mapping.map($from.pos), 1, deflt ? [{ type: deflt }] : undefined)) {
            can = true
            types = deflt
              ? [
                  {
                    type: deflt,
                    attrs: newAttributes,
                  },
                ]
              : undefined
          }

          if (dispatch) {
            if (can) {
              if (selection instanceof TextSelection) {
                tr.deleteSelection()
              }

              tr.split(tr.mapping.map($from.pos), 1, types)

              if (deflt && !atEnd && !$from.parentOffset && $from.parent.type !== deflt) {
                const first = tr.mapping.map($from.before())
                const $first = tr.doc.resolve(first)

                if ($from.node(-1).canReplaceWith($first.index(), $first.index() + 1, deflt)) {
                  tr.setNodeMarkup(tr.mapping.map($from.before()), deflt)
                }
              }
            }

            if (keepMarks) {
              ensureMarks(state, editor.extensionManager.splittableMarks)
            }

            tr.scrollIntoView()
          }

          return can
        },
    }
  },
})
