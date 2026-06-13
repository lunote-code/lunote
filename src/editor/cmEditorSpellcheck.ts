import { EditorView } from '@codemirror/view'

import { editorSpellcheckDomAttribute } from '../settings-runtime/editorSpellcheck'

/** Native spellcheck on source-mode CM content (system dictionaries). */
export function createCmSpellcheckExtension(enabled: boolean) {
  return EditorView.contentAttributes.of({
    spellcheck: editorSpellcheckDomAttribute(enabled),
  })
}
