import type { AbsoluteDocPath } from '../../editor/knowledgeRuntime/types'

export const QA_KNOWLEDGE_ROOT = '/qa-vault'

export const QA_KNOWLEDGE_FIXTURES: Record<string, string> = {
  'note-a.md':
    '---\ntitle: Note A Title\naliases: [Alpha]\ntags: [project, research]\nstatus: draft\n---\n# Note A\n\nSee [[note-b]] and [[missing-note]] for details.\n\n## Deep Dive\n\nJump to [[note-a#Deep Dive]].\n',
  'note-b.md': '# Note B\n\nForward to [[note-c]]. #project\n',
  'note-c.md': '# Note C\n\nTerminal note.\n',
  'embed-host.md': '---\ntitle: Embed Host\n---\n# Embed Host\n\n![[note-b]]\n\n![[missing-embed]]\n',
  'title-match.md': '---\ntitle: Deep Atlas\n---\n# Atlas\n\nSurface note.\n',
  'content-note.md': '---\ntitle: Content Note\n---\n# Content Note\n\nThis note explores deep work patterns.\n',
  'tag-note.md': '---\ntitle: Tag Note\ntags: [deep]\n---\n# Tag Note\n\nCatalog note.\n',
}

export type QaKnowledgeNoteId = 'note-a' | 'note-b' | 'embed-host'

export function qaKnowledgeNotePath(note: QaKnowledgeNoteId): AbsoluteDocPath {
  return `${QA_KNOWLEDGE_ROOT}/${note}.md`
}

export function qaKnowledgeFixtureRelPath(absolutePath: string): string {
  return absolutePath.replace(`${QA_KNOWLEDGE_ROOT}/`, '')
}

export function cloneQaKnowledgeFixtures(): Record<string, string> {
  return { ...QA_KNOWLEDGE_FIXTURES }
}
