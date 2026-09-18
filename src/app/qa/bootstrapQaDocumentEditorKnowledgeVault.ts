import {
  bootstrapWorkspaceLinkGraphIndex,
  openVault,
  resetKnowledgeRuntime,
  waitForLinkIndexReady,
} from '../../editor/knowledgeRuntime'
import type { AbsoluteDocPath } from '../../editor/knowledgeRuntime/types'
import { initKnowledgeOS, onKnowledgeOSWorkspaceOpened } from '../../editor/knowledgeOS'
import { onKnowledgeDocumentSaved } from '../../editor/knowledgeRuntime/knowledgeBridge'
import {
  QA_KNOWLEDGE_FIXTURES,
  QA_KNOWLEDGE_ROOT,
  qaKnowledgeFixtureRelPath,
} from './qaKnowledgeFixtures'

export type QaDocumentEditorKnowledgeVault = {
  fixtures: Record<string, string>
  patchFixture: (relPath: string, markdown: string) => void
  dispose: () => void
}

/** In-memory vault for document-editor QA so wiki embeds can resolve and refresh. */
export async function bootstrapQaDocumentEditorKnowledgeVault(): Promise<QaDocumentEditorKnowledgeVault> {
  const fixtures = { ...QA_KNOWLEDGE_FIXTURES }

  resetKnowledgeRuntime()
  openVault(QA_KNOWLEDGE_ROOT)
  initKnowledgeOS({
    fileAdapter: {
      read: async (path) => fixtures[qaKnowledgeFixtureRelPath(path)] ?? '',
      write: async (path, content) => {
        fixtures[qaKnowledgeFixtureRelPath(path)] = content
      },
      create: async () => {},
      delete: async (path) => {
        delete fixtures[qaKnowledgeFixtureRelPath(path)]
      },
      rename: async () => {},
    },
  })
  onKnowledgeOSWorkspaceOpened(QA_KNOWLEDGE_ROOT)

  const paths = Object.keys(fixtures).map((file) => `${QA_KNOWLEDGE_ROOT}/${file}` as AbsoluteDocPath)
  await bootstrapWorkspaceLinkGraphIndex(QA_KNOWLEDGE_ROOT, paths, async (path) => {
    return fixtures[qaKnowledgeFixtureRelPath(path)] ?? ''
  })
  await waitForLinkIndexReady(15_000)

  return {
    fixtures,
    patchFixture(relPath, markdown) {
      fixtures[relPath] = markdown
      const absolutePath = `${QA_KNOWLEDGE_ROOT}/${relPath}` as AbsoluteDocPath
      onKnowledgeDocumentSaved(absolutePath, markdown)
    },
    dispose() {
      resetKnowledgeRuntime()
    },
  }
}
