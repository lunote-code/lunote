import {
  ACTIVE_AI_MODULES,
  ACTIVE_KNOWLEDGE_OS_MODULES,
  DEFERRED_AI_MODULES,
  DEFERRED_KNOWLEDGE_OS_MODULES,
  isDeferredAiModule,
  isDeferredKnowledgeModule,
} from '../../editor/knowledgeOS/activeRuntimeScope'

type Case = {
  name: string
  run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'deferred knowledge modules do not overlap active boot modules',
    run: () => {
      const active = new Set<string>(ACTIVE_KNOWLEDGE_OS_MODULES)
      for (const moduleId of DEFERRED_KNOWLEDGE_OS_MODULES) {
        assert(!active.has(moduleId), `${moduleId} must not be in ACTIVE_KNOWLEDGE_OS_MODULES`)
        assert(isDeferredKnowledgeModule(moduleId), `${moduleId} must be classified as deferred`)
      }
    },
  },
  {
    name: 'knowledgeCollaborationRuntime stays deferred',
    run: () => {
      assert(
        isDeferredKnowledgeModule('knowledgeCollaborationRuntime'),
        'knowledgeCollaborationRuntime must remain deferred per ADR 0001',
      )
      assert(
        !(ACTIVE_KNOWLEDGE_OS_MODULES as readonly string[]).includes('knowledgeCollaborationRuntime'),
        'knowledgeCollaborationRuntime must not boot with production Knowledge OS',
      )
    },
  },
  {
    name: 'deferred AI modules do not overlap active AI modules',
    run: () => {
      const active = new Set<string>(ACTIVE_AI_MODULES)
      for (const moduleId of DEFERRED_AI_MODULES) {
        assert(!active.has(moduleId), `${moduleId} must not be in ACTIVE_AI_MODULES`)
        assert(isDeferredAiModule(moduleId), `${moduleId} must be classified as deferred AI`)
      }
    },
  },
]

export async function assertActiveRuntimeScopeSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}:`, error)
    }
  }
  return { passed, failed }
}
