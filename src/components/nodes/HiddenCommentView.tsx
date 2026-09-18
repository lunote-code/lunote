import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo } from 'react'
import { useI18n } from '../../i18n'

export const HiddenCommentView = memo(function HiddenCommentView(props: ReactNodeViewProps) {
  const { t } = useI18n()
  const body = String(props.node.attrs.body ?? '')
  const isBlock = props.node.type.name === 'hiddenCommentBlock'
  const label = body || t('editor.hiddenComment.placeholder')

  if (isBlock) {
    return (
      <NodeViewWrapper
        as="div"
        className="pm-hidden-comment-block"
        data-hidden-comment-block="1"
        title={t('editor.hiddenComment.title', { label })}
        contentEditable={false}
      >
        <span className="pm-hidden-comment-badge" aria-hidden="true">
          %% … %%
        </span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      as="span"
      className="pm-hidden-comment"
      data-hidden-comment="1"
      title={t('editor.hiddenComment.title', { label })}
      contentEditable={false}
    >
      <span className="pm-hidden-comment-badge" aria-hidden="true">
        %% … %%
      </span>
    </NodeViewWrapper>
  )
})
