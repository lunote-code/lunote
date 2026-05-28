import { Extension } from '@tiptap/core'

import { createPmSelectionBridgePlugin } from './pmSelectionBridge'
import { ensureDocumentNode, setDocumentPhase } from './lifecycleGraph'
import { publishCanonicalSnapshot, resetCanonicalCoordinator, resetConvergenceLayer } from './sourceOfTruth'

/**
 * Document Runtime OS: PM selection bridge + document lifecycle initialization
 */
export const LunaDocumentRuntime = Extension.create({
  name: 'lunaDocumentRuntime',
  priority: 1200,

  onCreate() {
    ensureDocumentNode()
    setDocumentPhase('hydrate')
    publishCanonicalSnapshot()
  },

  onDestroy() {
    setDocumentPhase('destroyed')
    resetConvergenceLayer()
    resetCanonicalCoordinator()
  },

  addProseMirrorPlugins() {
    return [createPmSelectionBridgePlugin()]
  },
})
