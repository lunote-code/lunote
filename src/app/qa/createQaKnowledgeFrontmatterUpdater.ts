import type { MutableRefObject } from 'react'

import {
  attachDocumentFrontmatter,
  getDocumentFrontmatterFields,
  getDocumentFrontmatterHadLeadingBlock,
  hasDocumentFrontmatterCache,
  setDocumentFrontmatterFields,
  syncDocumentFrontmatterFromMarkdown,
} from '../../editor/documentFrontmatterStore'
import { docKeyToAbsolutePath } from '../../editor/knowledgeOS'
import { notifyKnowledgeDocumentSave } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { parseFrontmatter } from '../../editor/knowledgeRuntime/wikiLinkParser'

import { qaKnowledgeFixtureRelPath } from './qaKnowledgeFixtures'

export function createQaKnowledgeFrontmatterUpdater(
  rootDir: string,
  fixturesRef: MutableRefObject<Record<string, string>>,
  options?: {
    onPersist?: (root: string, absolutePath: string, full: string) => void | Promise<void>
  },
): (
  docKey: string,
  updater: (current: Record<string, unknown>) => Record<string, unknown>,
) => Promise<boolean> {
  return async (docKey, updater) => {
    const absolutePath = docKeyToAbsolutePath(docKey, rootDir)
    if (!absolutePath) return false

    const rel = qaKnowledgeFixtureRelPath(absolutePath)
    const disk = fixturesRef.current[rel]
    if (!disk) return false

    if (!hasDocumentFrontmatterCache(absolutePath)) {
      syncDocumentFrontmatterFromMarkdown(absolutePath, disk)
    }

    const baseFields = { ...(getDocumentFrontmatterFields(absolutePath) ?? {}) }
    const nextFields = updater(baseFields)
    setDocumentFrontmatterFields(absolutePath, nextFields, {
      hadLeadingBlock:
        getDocumentFrontmatterHadLeadingBlock(absolutePath) || Object.keys(nextFields).length > 0,
    })

    const body = parseFrontmatter(disk).body
    const full = attachDocumentFrontmatter(absolutePath, body)
    fixturesRef.current[rel] = full
    syncDocumentFrontmatterFromMarkdown(absolutePath, full)
    notifyKnowledgeDocumentSave(absolutePath, full)
    await options?.onPersist?.(rootDir, absolutePath, full)
    return true
  }
}
