import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo } from 'react'

export const FootnoteDefView = memo(function FootnoteDefView(props: ReactNodeViewProps) {
  const label = String(props.node.attrs.label ?? '')
  return (
    <NodeViewWrapper
      as="div"
      className="pm-footnote-def-wrap"
      data-footnote-def={label}
      id={`fn-${label}`}
    >
      <div className="pm-footnote-def-row">
        <span className="pm-footnote-def-marker" contentEditable={false}>
          [^{label}]:
        </span>
        <div className="pm-footnote-def-body">
          <NodeViewContent as="div" />
        </div>
      </div>
    </NodeViewWrapper>
  )
})
