import katex from 'katex'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo, useMemo } from 'react'

const cacheInline = new Map<string, string>()
const CACHE_INLINE_MAX = 128

function cacheInlineSet(key: string, html: string): void {
  if (cacheInline.has(key)) {
    cacheInline.delete(key)
  }
  cacheInline.set(key, html)
  while (cacheInline.size > CACHE_INLINE_MAX) {
    const first = cacheInline.keys().next().value
    if (first == null) break
    cacheInline.delete(first)
  }
}

export const MathInlineView = memo(function MathInlineView(props: ReactNodeViewProps) {
  const latex = String(props.node.attrs.latex ?? '').trim()
  const html = useMemo(() => {
    if (!latex) return ''
    const key = `i:${latex}`
    const hit = cacheInline.get(key)
    if (hit) return hit
    try {
      const h = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
        trust: false,
      })
      cacheInlineSet(key, h)
      return h
    } catch {
      return ''
    }
  }, [latex])

  return (
    <NodeViewWrapper
      as="span"
      className="pm-math-inline"
      data-type="inline-math"
      data-latex={latex}
      spellCheck={false}
    >
      {html ? (
        <span className="pm-math-inline-inner" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="pm-math-fallback">
          {'$'}
          {latex}
          {'$'}
        </span>
      )}
    </NodeViewWrapper>
  )
})
