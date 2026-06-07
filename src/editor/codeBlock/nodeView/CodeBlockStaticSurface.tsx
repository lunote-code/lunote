import { memo, useEffect, useRef } from 'react'

type Props = {
  text: string
  displayLineCount: number
  languageClassName?: string
  /** Folded preview: one gutter row + first line only. */
  foldedPreview?: boolean
  onActivate: (event: MouseEvent) => void
}

export const CodeBlockStaticSurface = memo(function CodeBlockStaticSurface({
  text,
  displayLineCount,
  languageClassName,
  foldedPreview = false,
  onActivate,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const handleMouseDown = (event: MouseEvent) => {
      onActivate(event)
    }
    const suppress = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    el.addEventListener('mousedown', handleMouseDown)
    el.addEventListener('mouseup', suppress)
    el.addEventListener('click', suppress)
    return () => {
      el.removeEventListener('mousedown', handleMouseDown)
      el.removeEventListener('mouseup', suppress)
      el.removeEventListener('click', suppress)
    }
  }, [onActivate])

  const previewLine = foldedPreview ? (text.split('\n')[0] ?? '') : text
  const lineCount = foldedPreview ? 1 : Math.max(1, displayLineCount)

  return (
    <div
      ref={rootRef}
      className={[
        'pm-code-block-content-scroll',
        'pm-code-block-static',
        foldedPreview ? 'pm-code-block-static--folded-preview' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--code-block-line-count' as string]: String(lineCount) }}
    >
      {foldedPreview ? (
        <div className="pm-code-linenos" aria-hidden="true">
          <span className="pm-code-lineno">1</span>
          {'\n'}
        </div>
      ) : null}
      <div className="pm-code-body-col">
        <div className={['pm-code-block-content', 'hljs', languageClassName].filter(Boolean).join(' ')}>
          {previewLine}
        </div>
      </div>
    </div>
  )
})
