import { writeDocument } from '../../io/documentIO'
import {
  attachDocumentFrontmatter,
  getDocumentFrontmatterFields,
  getDocumentFrontmatterHadLeadingBlock,
  hasDocumentFrontmatterCache,
  setDocumentFrontmatterFields,
  syncDocumentFrontmatterFromMarkdown,
} from '../../editor/documentFrontmatterStore'
import { docKeyToAbsolutePath } from '../../editor/knowledgeOS'
import { parseFrontmatter } from '../../editor/knowledgeRuntime/wikiLinkParser'
import { notifyKnowledgeDocumentSave } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { commitLatestDocumentBodyToMemory } from '../../lib/editorContentSync'
import { pathsEqual } from '../../lib/workspacePathUtils'

export async function applyDocumentFrontmatterUpdate(args: {
  rootDir: string
  docKey: string
  activePath: string | null
  contentRef: { current: string }
  setTabBody?: (path: string, body: string) => void
  readDocument?: (root: string, path: string) => Promise<string>
  updater: (current: Record<string, unknown>) => Record<string, unknown>
}): Promise<boolean> {
  const { rootDir, docKey, activePath, contentRef, setTabBody, readDocument, updater } = args
  const root = rootDir.replace(/[/\\]+$/u, '')
  const absolutePath = docKeyToAbsolutePath(docKey, rootDir)
  if (!absolutePath) return false

  if (!hasDocumentFrontmatterCache(absolutePath)) {
    if (pathsEqual(activePath ?? '', absolutePath)) {
      syncDocumentFrontmatterFromMarkdown(absolutePath, contentRef.current)
    } else if (readDocument) {
      try {
        const disk = await readDocument(root, absolutePath)
        syncDocumentFrontmatterFromMarkdown(absolutePath, disk)
      } catch {
        return false
      }
    }
  }

  const baseFields = { ...(getDocumentFrontmatterFields(absolutePath) ?? {}) }
  const nextFields = updater(baseFields)
  setDocumentFrontmatterFields(absolutePath, nextFields, {
    hadLeadingBlock:
      getDocumentFrontmatterHadLeadingBlock(absolutePath) || Object.keys(nextFields).length > 0,
  })

  let body: string
  if (pathsEqual(activePath ?? '', absolutePath)) {
    body = parseFrontmatter(contentRef.current).body
  } else if (readDocument) {
    try {
      const disk = await readDocument(root, absolutePath)
      body = parseFrontmatter(disk).body
    } catch {
      return false
    }
  } else {
    return false
  }

  const full = attachDocumentFrontmatter(absolutePath, body)
  try {
    await writeDocument(root, absolutePath, full)
  } catch {
    return false
  }

  syncDocumentFrontmatterFromMarkdown(absolutePath, full)
  notifyKnowledgeDocumentSave(absolutePath, full)

  if (pathsEqual(activePath ?? '', absolutePath)) {
    const { body: editBody } = parseFrontmatter(full)
    commitLatestDocumentBodyToMemory({
      path: absolutePath,
      body: editBody,
      sourceIdentity: full,
      contentRef,
      persistBody: setTabBody,
    })
  }

  return true
}
