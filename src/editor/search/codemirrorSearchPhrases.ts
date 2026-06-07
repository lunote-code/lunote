import { EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import type { TranslateFn } from '../../i18n'

/** CodeMirror @codemirror/search built-in UI strings (see codemirror.net/examples/translate).*/
export function createCodeMirrorSearchPhraseExtension(t: TranslateFn): Extension {
  return EditorState.phrases.of({
    Find: t('editor.search.find'),
    Replace: t('editor.search.replace'),
    next: t('editor.search.next'),
    previous: t('editor.search.previous'),
    all: t('editor.search.replaceAll'),
    'match case': t('editor.search.matchCase'),
    'by word': t('editor.search.byWord'),
    replace: t('editor.search.replace'),
    'replace all': t('editor.search.replaceAll'),
    close: t('editor.search.close'),
  })
}
