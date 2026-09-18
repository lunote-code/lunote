import { getKnowledgeInteractionHost } from '../../knowledgeOS/ui/knowledgeInteractionHost'
import { parseAssistantFrontmatter } from './parseAssistantFrontmatter'

export async function applyAssistantFrontmatter(
  text: string,
  docKey: string | null,
): Promise<boolean> {
  const fields = parseAssistantFrontmatter(text)
  if (!fields || !docKey) return false
  const host = getKnowledgeInteractionHost()
  if (!host?.updateDocumentFrontmatter) return false
  return host.updateDocumentFrontmatter(docKey, (current) => ({
    ...current,
    ...fields,
  }))
}
