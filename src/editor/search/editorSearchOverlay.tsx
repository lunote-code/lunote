import { useEffect, useRef } from 'react'
import { EDITOR_SEARCH_CLASS } from './editorSearchTheme'

export type EditorSearchOverlayMode = 'find' | 'replace'

type EditorSearchOverlayProps = {
  mode: EditorSearchOverlayMode
  query: string
  replaceText: string
  activeIndex: number
  matchCount: number
  findPlaceholder?: string
  replacePlaceholder?: string
  onQueryChange: (query: string) => void
  onReplaceTextChange: (text: string) => void
  onNext: () => void
  onPrevious: () => void
  onReplaceOne?: () => void
  onReplaceAll?: () => void
  onClose: () => void
}

export function EditorSearchOverlay({
  mode,
  query,
  replaceText,
  activeIndex,
  matchCount,
  findPlaceholder = 'Find in document',
  replacePlaceholder = 'Replace with',
  onQueryChange,
  onReplaceTextChange,
  onNext,
  onPrevious,
  onReplaceOne,
  onReplaceAll,
  onClose,
}: EditorSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const replaceRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (mode === 'replace') {
      replaceRef.current?.focus()
      replaceRef.current?.select()
      return
    }
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [mode])

  const current = matchCount > 0 ? activeIndex + 1 : 0
  const showReplace = mode === 'replace'

  return (
    <div
      className={`${EDITOR_SEARCH_CLASS.overlay}${showReplace ? ' editor-search-overlay--replace' : ''}`}
      contentEditable={false}
      role="search"
    >
      <input
        ref={inputRef}
        className={EDITOR_SEARCH_CLASS.input}
        value={query}
        placeholder={findPlaceholder}
        aria-label={findPlaceholder}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
            return
          }
          if (event.key === 'Enter' && !showReplace) {
            event.preventDefault()
            if (event.shiftKey) onPrevious()
            else onNext()
          }
        }}
      />
      {showReplace ? (
        <input
          ref={replaceRef}
          className={EDITOR_SEARCH_CLASS.replaceInput}
          value={replaceText}
          placeholder={replacePlaceholder}
          aria-label={replacePlaceholder}
          onChange={(event) => onReplaceTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              if (event.metaKey || event.ctrlKey) {
                onReplaceAll?.()
              } else {
                onReplaceOne?.()
              }
            }
          }}
        />
      ) : null}
      <span className={EDITOR_SEARCH_CLASS.count} aria-live="polite">
        {current}/{matchCount}
      </span>
      <button className={EDITOR_SEARCH_CLASS.button} type="button" aria-label="Previous match" onClick={onPrevious}>
        ↑
      </button>
      <button className={EDITOR_SEARCH_CLASS.button} type="button" aria-label="Next match" onClick={onNext}>
        ↓
      </button>
      {showReplace ? (
        <>
          <button
            className="editor-search-button editor-search-button--text"
            type="button"
            aria-label="Replace"
            onClick={() => onReplaceOne?.()}
          >
            Replace
          </button>
          <button
            className="editor-search-button editor-search-button--text"
            type="button"
            aria-label="Replace all"
            onClick={() => onReplaceAll?.()}
          >
            All
          </button>
        </>
      ) : null}
      <button className={EDITOR_SEARCH_CLASS.button} type="button" aria-label="Close search" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
