import { useEffect, useState } from 'react'
import {
  getKnowledgeOSSnapshot,
  subscribeKnowledgeOSSnapshot,
} from '../knowledgeUIBridge'
import type { KnowledgeOSSnapshot } from '../types'

/**
 * Unique UI subscription flow: all panels share the same OS revision and snapshot references.
 */
export function useKnowledgeOSSnapshot(): Readonly<KnowledgeOSSnapshot> {
  const [snap, setSnap] = useState(() => getKnowledgeOSSnapshot())

  useEffect(() => {
    return subscribeKnowledgeOSSnapshot(() => {
      setSnap(getKnowledgeOSSnapshot())
    })
  }, [])

  return snap
}
