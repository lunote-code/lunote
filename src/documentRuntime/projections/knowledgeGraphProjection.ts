import { notifyKnowledgeDocumentSave } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { isBufferTabId } from '../runtimePath'
import { subscribeDocumentEvents } from '../documentEventStream'
import { installRevealProjection } from './revealProjection'

export function installKnowledgeGraphProjection(rootDir: string): () => void {
  const uninstallRevealProjection = installRevealProjection()
  const unsubscribeKnowledgeGraph = subscribeDocumentEvents((event) => {
    if (!rootDir) return
    if (event.type !== 'DocumentSaved') return
    if (isBufferTabId(event.path)) return
    notifyKnowledgeDocumentSave(event.path, event.content)
  })
  return () => {
    unsubscribeKnowledgeGraph()
    uninstallRevealProjection()
  }
}
