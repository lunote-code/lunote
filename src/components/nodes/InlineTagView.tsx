import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo } from 'react'

export const InlineTagView = memo(function InlineTagView(props: ReactNodeViewProps) {
  const tag = String(props.node.attrs.tag ?? '')
  return (
    <NodeViewWrapper
      as="span"
      className="pm-inline-tag"
      data-inline-tag={tag}
      contentEditable={false}
      title={`#${tag}`}
    >
      #{tag}
    </NodeViewWrapper>
  )
})
