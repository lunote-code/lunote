import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildHeadingOutlineTree } from '../../editor/outlineHeadingTree'
import { DocumentOutlineTree } from '../../components/DocumentOutlineTree'
import { useI18n } from '../../i18n'

export type TocHeading = { level: number; title: string; id: string }

const collapsedByDocumentRef = new Map<string, Set<string>>()

export function DocumentOutlineBlock({
  documentPath,
  headings,
  activeId,
  onJump,
}: {
  documentPath: string
  headings: TocHeading[]
  activeId: string
  onJump: (id: string) => void
}) {
  const { t } = useI18n()
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set())
  const lastDocumentPathRef = useRef(documentPath)
  const lastStableRef = useRef({ path: documentPath, headings })

  const displayHeadings = useMemo(() => {
    if (headings.length > 0) {
      lastStableRef.current = { path: documentPath, headings }
      return headings
    }
    if (documentPath === lastStableRef.current.path) {
      return lastStableRef.current.headings
    }
    return []
  }, [documentPath, headings])

  const tree = useMemo(() => buildHeadingOutlineTree(displayHeadings), [displayHeadings])

  useEffect(() => {
    if (lastDocumentPathRef.current === documentPath) return
    lastDocumentPathRef.current = documentPath
    setCollapsedPaths(new Set(collapsedByDocumentRef.get(documentPath) ?? []))
  }, [documentPath])

  const onTogglePath = useCallback(
    (path: string) => {
      setCollapsedPaths((prev) => {
        const next = new Set(prev)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        collapsedByDocumentRef.set(documentPath, next)
        return next
      })
    },
    [documentPath],
  )

  if (displayHeadings.length === 0) {
    return <p className="document-outline-empty">{t('outline.empty')}</p>
  }

  return (
    <DocumentOutlineTree
      nodes={tree}
      activeId={activeId}
      onJump={onJump}
      collapsible
      collapsedPaths={collapsedPaths}
      onTogglePath={onTogglePath}
    />
  )
}
