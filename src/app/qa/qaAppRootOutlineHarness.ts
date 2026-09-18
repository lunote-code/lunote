import type { DocumentRuntimeCapabilities } from '../../documentRuntime/documentTypes'
import type { FsTreeNode } from '../workspace/types'
import {
  QA_KNOWLEDGE_FIXTURES,
  QA_KNOWLEDGE_ROOT,
  cloneQaKnowledgeFixtures,
  qaKnowledgeFixtureRelPath,
  qaKnowledgeNotePath,
} from './qaKnowledgeFixtures'
import { projectTabBodyFromKernel } from '../document/tabBodiesStore'

export const QA_APP_ROOT_OUTLINE_WINDOW_FLAG = '__LUNA_QA_APP_ROOT_OUTLINE__'

export const QA_APP_ROOT_OUTLINE_NOTE_B = qaKnowledgeNotePath('note-b')

export const QA_APP_ROOT_OUTLINE_KNOWLEDGE_TEST = `${QA_KNOWLEDGE_ROOT}/知识库测试.md`

export function isQaAppRootOutlineMode(): boolean {
  if (!import.meta.env.DEV) return false
  return Boolean((globalThis as { [QA_APP_ROOT_OUTLINE_WINDOW_FLAG]?: boolean })[QA_APP_ROOT_OUTLINE_WINDOW_FLAG])
}

export function buildQaKnowledgeFileTree(): FsTreeNode[] {
  return Object.keys(QA_KNOWLEDGE_FIXTURES).map((name) => ({
    name,
    path: `${QA_KNOWLEDGE_ROOT}/${name}`,
    kind: 'file' as const,
    children: [],
  }))
}

export function createQaAppRootOutlineDocumentCapabilities(): DocumentRuntimeCapabilities {
  const fixtures = cloneQaKnowledgeFixtures()
  return {
    readDocument: async (_root, path) => fixtures[qaKnowledgeFixtureRelPath(path)] ?? '',
    readDocumentForVerify: async (_root, path) => fixtures[qaKnowledgeFixtureRelPath(path)] ?? '',
    writeDocument: async (_root, path, content) => {
      fixtures[qaKnowledgeFixtureRelPath(path)] = content
    },
    projectOpenDocumentBody: projectTabBodyFromKernel,
    setActiveDocument: () => undefined,
    renderContent: () => undefined,
    setTabs: () => undefined,
    onDocumentOpened: () => undefined,
    onDocumentSaved: () => undefined,
    onOpenTabLimitReached: () => undefined,
  }
}
