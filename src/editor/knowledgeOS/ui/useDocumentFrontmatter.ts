import { useEffect, useMemo, useState } from 'react'

import {
  getDocumentFrontmatterFields,
  getDocumentFrontmatterRevision,
  hasDocumentFrontmatterCache,
  subscribeDocumentFrontmatter,
} from '../../documentFrontmatterStore'
import { getDocumentMeta } from '../../knowledgeRuntime'
import { docKeyToAbsolutePath } from '../vaultRuntime'
import { getKnowledgeInteractionHost } from './knowledgeInteractionHost'
import { useOsRevision } from './useKnowledgeOSSlice'

/** Live frontmatter for the properties panel: store first, index fallback. */
export function useDocumentFrontmatter(docKey: string | null): {
  absolutePath: string | null
  fields: Record<string, unknown>
} {
  const osRevision = useOsRevision()
  const [fmRevision, setFmRevision] = useState(() => getDocumentFrontmatterRevision())

  useEffect(() => {
    return subscribeDocumentFrontmatter(() => {
      setFmRevision(getDocumentFrontmatterRevision())
    })
  }, [])

  const rootDir = getKnowledgeInteractionHost()?.getRootDir() ?? ''
  const absolutePath =
    docKey && rootDir ? docKeyToAbsolutePath(docKey, rootDir) : null

  const fields = useMemo(() => {
    void osRevision
    void fmRevision
    if (absolutePath && hasDocumentFrontmatterCache(absolutePath)) {
      return { ...(getDocumentFrontmatterFields(absolutePath) ?? {}) }
    }
    if (docKey) {
      return { ...(getDocumentMeta(docKey)?.frontmatter ?? {}) }
    }
    return {}
  }, [absolutePath, docKey, fmRevision, osRevision])

  return { absolutePath, fields }
}
