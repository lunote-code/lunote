import { clearTabBodies, getTabBody, setTabBody } from '../document/tabBodiesStore'
import {
  clearAllDocumentFrontmatter,
  getDocumentFrontmatterFields,
  setDocumentFrontmatterFields,
} from '../../editor/documentFrontmatterStore'
import {
  clearAllWorkspaceImageObjectUrls,
  resetWorkspaceImageObjectUrlCacheForTests,
} from '../../export/workspaceMediaBlob'
import { getHistoryRestoreState, suspendAutosaveForPath } from '../../documentHistory/historyRestoreState'
import { setAiConversation, getAiConversation, clearAllAiConversationMemory } from '../../editor/ai/persistence/aiConversationStore'
import { writeAiChatDraft, readAiChatDraft, clearAllAiChatDrafts } from '../../editor/ai/hooks/aiChatDraftStore'
import { recordModeSwitchGoodAnchor, getModeSwitchGoodAnchor, clearAllModeSwitchAnchors } from '../../editor/modeSwitchLastGoodAnchor'
import { clearWorkspaceClientMemory } from './clearWorkspaceClientMemory'
import {
  clearTabEditorSessions,
  getTabEditorSession,
  setTabEditorSession,
} from '../document/tabEditorSessionStore'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'clearWorkspaceClientMemory clears tab bodies and frontmatter',
    run: () => {
      setTabBody('/vault/a.md', 'secret body')
      setDocumentFrontmatterFields('/vault/a.md', { title: 'Secret' })
      clearWorkspaceClientMemory({ previousRoot: '/vault' })
      assert(getTabBody('/vault/a.md') === undefined, 'tab body must be cleared')
      assert(getDocumentFrontmatterFields('/vault/a.md') === undefined, 'frontmatter must be cleared')
    },
  },
  {
    name: 'clearWorkspaceClientMemory clears buffer tab bodies via tabBodiesStore',
    run: () => {
      const bufferId = 'luna:buf:test-clear'
      setTabBody(bufferId, 'draft')
      const fileStatRef = { current: { '/vault/a.md': { modifiedSecs: 1, size: 2 } } }
      let labels: Record<string, string> = { [bufferId]: 'Draft' }
      clearWorkspaceClientMemory({
        previousRoot: '/vault',
        fileStatRef,
        setBufferTabLabels: (next) => {
          labels = typeof next === 'function' ? next(labels) : next
        },
      })
      assert(getTabBody(bufferId) === undefined, 'buffer tab body must be cleared via tabBodiesStore')
      assert(Object.keys(fileStatRef.current).length === 0, 'file stats must be cleared')
      assert(Object.keys(labels).length === 0, 'buffer labels must be cleared')
    },
  },
  {
    name: 'clearWorkspaceClientMemory bumps file stat generation before clearing cache',
    run: () => {
      const fileStatRef = { current: { '/vault/a.md': { modifiedSecs: 1, size: 2 } } }
      const fileStatGenerationRef = { current: 0 }
      clearWorkspaceClientMemory({
        previousRoot: '/vault',
        fileStatRef,
        fileStatGenerationRef,
      })
      assert(fileStatGenerationRef.current === 1, 'file stat generation must bump on clear')
      assert(Object.keys(fileStatRef.current).length === 0, 'file stats must be cleared')
    },
  },
  {
    name: 'clearWorkspaceClientMemory clears history restore, AI memory, drafts, and mode-switch anchors',
    run: () => {
      suspendAutosaveForPath('/vault/a.md', 'snap-1')
      setAiConversation('vault::notes/a', [{ id: '1', role: 'user', content: 'hi', createdAt: 1 }])
      writeAiChatDraft('vault::notes/a', 'draft')
      recordModeSwitchGoodAnchor('/vault/a.md', 10, 20)
      clearWorkspaceClientMemory({ previousRoot: '/vault' })
      assert(getHistoryRestoreState('/vault/a.md') === null, 'history restore state must clear')
      assert(getAiConversation('vault::notes/a').length === 0, 'AI conversation memory must clear')
      assert(readAiChatDraft('vault::notes/a') === '', 'AI chat drafts must clear')
      assert(getModeSwitchGoodAnchor('/vault/a.md') === null, 'mode-switch anchors must clear')
    },
  },
  {
    name: 'clearWorkspaceClientMemory drops caret sessions when leaving a workspace',
    run: () => {
      setTabEditorSession('/vault/a.md', { visual: { pmAnchor: 8, pmHead: 8, scrollRatio: 0.4 } })
      clearWorkspaceClientMemory({ previousRoot: '/vault' })
      assert(getTabEditorSession('/vault/a.md') === undefined, 'leave-workspace must drop caret sessions')
    },
  },
  {
    name: 'clearWorkspaceClientMemory can keep caret sessions that are not plaintext',
    run: () => {
      setTabEditorSession('/vault/a.md', { visual: { pmAnchor: 12, pmHead: 14, scrollRatio: 0.6 } })
      clearWorkspaceClientMemory({ previousRoot: '/vault', preserveTabEditorSessions: true })
      const session = getTabEditorSession('/vault/a.md')
      assert(session?.visual?.pmAnchor === 12, 'idle lock must keep caret sessions')
      assert(session?.visual?.scrollRatio === 0.6, 'idle lock must keep scroll sessions')
    },
  },
]

export async function assertClearWorkspaceClientMemorySuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    try {
      clearTabBodies()
      clearAllDocumentFrontmatter()
      resetWorkspaceImageObjectUrlCacheForTests()
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}:`, error)
    } finally {
      clearTabBodies()
      clearAllDocumentFrontmatter()
      clearAllWorkspaceImageObjectUrls()
      clearAllAiConversationMemory()
      clearAllAiChatDrafts()
      clearAllModeSwitchAnchors()
      clearTabEditorSessions()
    }
  }
  return { passed, failed }
}
