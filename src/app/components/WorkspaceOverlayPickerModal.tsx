import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'

import { EmptyState } from '../../design-system/EmptyState'
import { Icon } from '../../design-system/icons'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { bindOverlayScrollbarReveal } from '../overlayScrollbarReveal'

export type WorkspaceOverlayPickerRow = {
  key: string
  label: string
  hint?: ReactNode
}

export type WorkspaceOverlayPickerListState = 'results' | 'loading' | 'empty'

export type WorkspaceOverlayPickerModalProps = {
  open: boolean
  query: string
  onQueryChange: (query: string) => void
  onClose: () => void
  onActivate: (key: string) => void
  rows: readonly WorkspaceOverlayPickerRow[]
  listState: WorkspaceOverlayPickerListState
  inputRef?: RefObject<HTMLInputElement | null>
  ariaLabel: string
  scopeHint: ReactNode
  footerHint?: ReactNode
  placeholder: string
  testId: string
  modalClassName?: string
  loadingLabel: string
  emptyTitle: string
}

function isComposingKeyEvent(e: React.KeyboardEvent<HTMLInputElement>): boolean {
  return e.nativeEvent.isComposing || e.key === 'Process'
}

export function WorkspaceOverlayPickerModal(props: WorkspaceOverlayPickerModalProps) {
  const {
    open,
    query,
    onQueryChange,
    onClose,
    onActivate,
    rows,
    listState,
    inputRef: inputRefProp,
    ariaLabel,
    scopeHint,
    footerHint,
    placeholder,
    testId,
    modalClassName,
    loadingLabel,
    emptyTitle,
  } = props

  const hintId = useId()
  const footerId = useId()
  const fallbackInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = inputRefProp ?? fallbackInputRef
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoverIndex, setHoverIndex] = useState(-1)
  const listboxId = useId()

  useFocusTrap(open, dialogEl, {
    initialFocusRef: inputRef,
    onEscape: onClose,
  })

  const highlightedIndex = hoverIndex >= 0 ? hoverIndex : activeIndex
  const activeOptionId = rows.length > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    setHoverIndex(-1)
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, inputRef])

  useEffect(() => {
    if (!open || rows.length === 0) return
    const active = document.getElementById(`${listboxId}-option-${highlightedIndex}`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, listboxId, open, rows.length])

  useEffect(() => {
    if (rows.length === 0) return
    setActiveIndex((i) => Math.min(i, rows.length - 1))
  }, [rows.length])

  useEffect(() => {
    if (!open || !listRef.current) return
    return bindOverlayScrollbarReveal(listRef.current)
  }, [open])

  const activateRow = useCallback(
    (key: string) => {
      onActivate(key)
      onClose()
    },
    [onActivate, onClose],
  )

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingKeyEvent(e)) return
    if (rows.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoverIndex(-1)
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoverIndex(-1)
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const hit = rows[highlightedIndex]
      if (hit) activateRow(hit.key)
    }
  }

  if (!open) return null

  const describedBy = footerHint ? `${hintId} ${footerId}` : hintId

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={setDialogEl}
        className={['command-palette', 'workspace-overlay-picker', modalClassName].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="global-search-header">
          <p id={hintId} className="global-search-scope-hint">
            {scopeHint}
          </p>
          <input
            ref={inputRef}
            className="command-palette-input global-search-input"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-describedby={describedBy}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value)
              setActiveIndex(0)
              setHoverIndex(-1)
            }}
            onKeyDown={onInputKeyDown}
            aria-label={ariaLabel}
            data-testid={`${testId.replace(/-modal$/, '')}-input`}
          />
          {footerHint ? (
            <p id={footerId} className="workspace-overlay-picker-footer-hint">
              {footerHint}
            </p>
          ) : null}
        </div>
        <ul
          ref={listRef}
          id={listboxId}
          className="command-palette-list luna-overlay-scroll"
          role="listbox"
          onMouseLeave={() => setHoverIndex(-1)}
        >
          {listState === 'loading' ? (
            <li className="command-palette-empty command-palette-loading" key="loading" role="status" aria-live="polite">
              <Icon name="refresh" size="sm" className="command-palette-loading-icon" tone="muted" />
              <span>{loadingLabel}</span>
            </li>
          ) : listState === 'empty' ? (
            <li className="command-palette-empty-item" key="empty">
              <EmptyState variant="compact" icon="search" title={emptyTitle} />
            </li>
          ) : (
            rows.map((row, idx) => (
              <li key={row.key} role="presentation">
                <button
                  type="button"
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={idx === highlightedIndex}
                  className="command-palette-item"
                  data-active={idx === highlightedIndex ? 'true' : undefined}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onClick={() => activateRow(row.key)}
                >
                  <span className="command-palette-item-row">
                    <span className="command-palette-item-label">{row.label}</span>
                  </span>
                  {row.hint ? <span className="command-palette-item-hint">{row.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
