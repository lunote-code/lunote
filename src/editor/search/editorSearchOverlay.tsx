import { useEffect, useRef } from 'react'
import { EDITOR_SEARCH_CLASS } from './editorSearchTheme'

export type EditorSearchOverlayMode = 'find' | 'replace'

export type EditorSearchOverlayLabels = {
  previous: string
  next: string
  replace: string
  replaceAll: string
  close: string
}

type EditorSearchOverlayProps = {
  mode: EditorSearchOverlayMode
  query: string
  replaceText: string
  activeIndex: number
  matchCount: number
  findPlaceholder?: string
  replacePlaceholder?: string
  labels?: EditorSearchOverlayLabels
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
  labels = {
    previous: 'Previous match',
    next: 'Next match',
    replace: 'Replace',
    replaceAll: 'Replace all',
    close: 'Close search',
  },
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

  const focusFindInput = () => {
    inputRef.current?.focus()
  }

  const goNext = () => {
    onNext()
    focusFindInput()
  }

  const goPrevious = () => {
    onPrevious()
    focusFindInput()
  }

  const handleFindEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (event.shiftKey) goPrevious()
    else goNext()
  }

  return (
    <div
      className={`${EDITOR_SEARCH_CLASS.overlay} editor-search-overlay--strip${showReplace ? ' editor-search-overlay--replace' : ''}`}
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
        onKeyDown={handleFindEnter}
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
              replaceRef.current?.focus()
            }
          }}
        />
      ) : null}
      <span className={EDITOR_SEARCH_CLASS.count} aria-live="polite">
        {current}/{matchCount}
      </span>
      <button className={EDITOR_SEARCH_CLASS.button} type="button" aria-label={labels.previous} onClick={goPrevious}>
        ↑
      </button>
      <button className={EDITOR_SEARCH_CLASS.button} type="button" aria-label={labels.next} onClick={goNext}>
        ↓
      </button>
      {showReplace ? (
        <>
          <button
            className="editor-search-button editor-search-button--text"
            type="button"
            aria-label={labels.replace}
            onClick={() => onReplaceOne?.()}
          >
            {labels.replace}
          </button>
          <button
            className="editor-search-button editor-search-button--text"
            type="button"
            aria-label={labels.replaceAll}
            onClick={() => onReplaceAll?.()}
          >
            {labels.replaceAll}
          </button>
        </>
      ) : null}
      <button className={EDITOR_SEARCH_CLASS.button} type="button" aria-label={labels.close} onClick={onClose}>
        ×
      </button>
    </div>
  )
}
