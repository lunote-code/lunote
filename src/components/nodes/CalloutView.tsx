import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import { CALLOUT_KINDS, type CalloutKind } from '../../editor/lunaCallout'
import { calloutHeaderVariants, calloutRootVariants } from './calloutCva'
import { Icon, type SemanticIconName } from '../../design-system/icons'
import './lunaCalloutCard.css'

const CALLOUT_SET = new Set<string>(CALLOUT_KINDS)

const CALLOUT_LABEL: Record<CalloutKind, string> = {
  note: 'Note',
  tip: 'Tip',
  success: 'Success',
  important: 'Important',
  caution: 'Caution',
  warning: 'Warning',
  info: 'Info',
  danger: 'Danger',
}

const CALLOUT_ICON: Record<CalloutKind, SemanticIconName> = {
  note: 'callout-note',
  info: 'callout-info',
  tip: 'callout-tip',
  success: 'callout-success',
  important: 'callout-important',
  warning: 'callout-warning',
  caution: 'callout-caution',
  danger: 'callout-danger',
}

function CalloutGlyph({ kind }: { kind: CalloutKind }) {
  return <Icon name={CALLOUT_ICON[kind] ?? 'callout-note'} className="luna-callout-card__icon" size="lg" stroke="strong" />
}

export const CalloutView = memo(function CalloutView(props: ReactNodeViewProps) {
  const { node, updateAttributes, editor } = props
  const raw = String(node.attrs.kind || 'note').toLowerCase()
  const kind: CalloutKind = CALLOUT_SET.has(raw) ? (raw as CalloutKind) : 'note'
  const collapsed = Boolean(node.attrs.collapsed)
  const editable = editor.isEditable

  const toggleCollapsed = useCallback(() => {
    updateAttributes({ collapsed: !collapsed })
  }, [collapsed, updateAttributes])

  const onHeaderKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleCollapsed()
      }
    },
    [toggleCollapsed],
  )

  const rootClass = useMemo(
    () =>
      clsx(
        calloutRootVariants({ collapsed }),
        `pm-callout--${kind}`,
      ),
    [collapsed, kind],
  )

  return (
    <NodeViewWrapper
      as="aside"
      className={rootClass}
      data-luna-callout={kind}
      spellCheck={editable}
    >
      <div
        className={calloutHeaderVariants({ interactive: editable })}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        aria-expanded={!collapsed}
        aria-label={editable ? `${CALLOUT_LABEL[kind]}, ${collapsed ? 'expand' : 'collapse'}` : undefined}
        onClick={editable ? toggleCollapsed : undefined}
        onKeyDown={editable ? onHeaderKeyDown : undefined}
      >
        <CalloutGlyph kind={kind} />
        <span className="luna-callout-card__title">{CALLOUT_LABEL[kind]}</span>
        {editable ? (
          <span className="luna-callout-card__chevron" aria-hidden>
            <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size="xs" stroke="strong" />
          </span>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="luna-callout-card__body">
          <NodeViewContent className="luna-callout-card__content" />
        </div>
      ) : null}
    </NodeViewWrapper>
  )
})
