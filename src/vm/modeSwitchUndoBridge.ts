import { diskMarkdownForDocumentSave } from '../lib/editorContentSync'
import { parseFrontmatter } from '../editor/knowledgeRuntime/wikiLinkParser'
import type { EditorPaneMode } from '../menu/commandContext'

export function projectStepLogMarkdownForPane(input: {
  markdown: string
  surface: 'visual' | 'source'
  pane: EditorPaneMode
  docId: string
}): string {
  if (input.pane === 'source') {
    return input.surface === 'source'
      ? input.markdown
      : diskMarkdownForDocumentSave(input.docId, input.markdown)
  }
  return parseFrontmatter(input.markdown).body
}
