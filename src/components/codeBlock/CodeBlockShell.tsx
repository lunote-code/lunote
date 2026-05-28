import { memo, type MouseEvent, type ReactNode } from 'react'

import type { CodeBlockMode, CodeBlockType } from '../../editor/codeBlockRuntime'

function stopPmPointer(e: MouseEvent): void {
  e.stopPropagation()
  e.preventDefault()
}

type Props = {
  blockId: string
  type: CodeBlockType
  mode: CodeBlockMode
  showToolbar?: boolean
  onEdit: () => void
  onPreview: () => void
  children: ReactNode
  className?: string
}

/** CBR unified shell: document flow embedded, no overlay / portal*/
export const CodeBlockShell = memo(function CodeBlockShell({
  blockId,
  type,
  mode,
  showToolbar = true,
  onEdit,
  onPreview,
  children,
  className,
}: Props) {
  const typeLabel = type === 'mermaid' ? 'Mermaid' : type.toUpperCase()

  return (
    <div
      className={[
        'code-block',
        type === 'mermaid' ? 'code-block--mermaid' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-code-block-type={type}
      data-code-block-id={blockId}
      data-code-block-mode={mode}
    >
      {showToolbar ? (
        <div
          className="code-header"
          role="tablist"
          aria-label={`${typeLabel} view`}
          contentEditable={false}
          onMouseDown={stopPmPointer}
        >
          <span className="code-header-type">{typeLabel}</span>
          <span className="code-header-tabs">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'edit'}
              className={mode === 'edit' ? 'is-active' : ''}
              onMouseDown={stopPmPointer}
              onClick={onEdit}
            >
              Source
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'preview'}
              className={mode === 'preview' ? 'is-active' : ''}
              onMouseDown={stopPmPointer}
              onClick={onPreview}
            >
              Preview
            </button>
          </span>
        </div>
      ) : null}
      <div className="code-body" data-native-text-input-host="">
        {children}
      </div>
    </div>
  )
})
