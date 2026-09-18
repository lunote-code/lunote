import { dispatchDocumentCommand } from '../../../documentRuntime/documentKernel'
import { newBufferTabId } from '../../../app/workspace/constants'
import { createNote } from '../../../platform/tauri/documentService'
import { navigateToDocKey } from '../../knowledgeOS/noteNavigationRuntime'
import { absolutePathToDocKeyOs, getKnowledgeVaultRoot } from '../../knowledgeOS/vaultRuntime'
import { normalizeAssistantInsertMarkdown } from './normalizeAssistantInsertMarkdown'

function uniqueNoteStem(stem: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  return `${stem} ${stamp}`
}

export async function saveAssistantToNewNote(text: string, titleStem: string): Promise<boolean> {
  const content = normalizeAssistantInsertMarkdown(text)
  if (!content) return false

  const root = getKnowledgeVaultRoot()
  if (root?.trim()) {
    try {
      const path = await createNote({
        root,
        parentPath: root,
        stem: uniqueNoteStem(titleStem),
        content,
      })
      const docKey = absolutePathToDocKeyOs(path, root)
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT_IN_TAB',
        root,
        path,
        source: 'ai-save-assistant',
      })
      navigateToDocKey(docKey, { source: 'wiki' })
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[ai-save-assistant] failed to save assistant reply', error)
      }
      return false
    }
  }

  try {
    const id = newBufferTabId()
    await dispatchDocumentCommand({
      type: 'OPEN_SCRATCH_TAB',
      id,
      content,
      source: 'ai-save-assistant',
    })
    return true
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[ai-save-assistant] failed to open scratch tab', error)
    }
    return false
  }
}
