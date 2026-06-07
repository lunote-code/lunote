import { memo, type MouseEvent, type ReactNode } from 'react'

import type { CodeBlockMode, CodeBlockType } from '../../editor/codeBlockRuntime'
import { useI18n } from '../../i18n'

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
  onEditPointerDown?: () => void
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
  onEditPointerDown,
  onPreview,
  children,
  className,
}: Props) {
  const { t } = useI18n()
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
          aria-label={t('editor.codeBlock.viewAria', { type: typeLabel })}
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
              onMouseDown={(e) => {
                stopPmPointer(e)
                onEditPointerDown?.()
              }}
              onClick={onEdit}
            >
              {t('editor.codeBlock.source')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'preview'}
              className={mode === 'preview' ? 'is-active' : ''}
              onMouseDown={stopPmPointer}
              onClick={onPreview}
            >
              {t('editor.codeBlock.preview')}
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
