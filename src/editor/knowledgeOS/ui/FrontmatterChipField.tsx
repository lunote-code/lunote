import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { listAllTags, listVaultAliasLabels } from '../../knowledgeRuntime'
import { useOsRevision } from './useKnowledgeOSSlice'
import { useI18n } from '../../../i18n'

export type FrontmatterChipKind = 'tag' | 'alias'

type Props = {
  kind: FrontmatterChipKind
  chips: string[]
  disabled: boolean
  docKey: string | null
  onAdd: (value: string) => void
  onRemove: (value: string) => void
}

function normalizeChipInput(kind: FrontmatterChipKind, raw: string): string {
  const trimmed = raw.trim()
  if (kind === 'tag') return trimmed.replace(/^#+/u, '')
  return trimmed
}

function filterSuggestions(
  kind: FrontmatterChipKind,
  query: string,
  chips: string[],
  docKey: string | null,
  revision: number,
): string[] {
  void revision
  const q = query.trim().toLowerCase()
  if (!q) return []
  const selected = new Set(chips.map((c) => c.toLowerCase()))
  const pool =
    kind === 'tag'
      ? listAllTags()
      : listVaultAliasLabels(docKey ? { excludeDocKey: docKey } : undefined)
  return pool
    .filter((item) => !selected.has(item.toLowerCase()) && item.toLowerCase().includes(q))
    .slice(0, 8)
}

export function FrontmatterChipField({ kind, chips, disabled, docKey, onAdd, onRemove }: Props) {
  const { t } = useI18n()
  const revision = useOsRevision()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  const suggestions = useMemo(
    () => filterSuggestions(kind, draft, chips, docKey, revision),
    [kind, draft, chips, docKey, revision],
  )

  useEffect(() => {
    setHighlight(0)
  }, [draft, suggestions.length])

  const labels =
    kind === 'tag'
      ? {
          empty: t('knowledge.frontmatter.tagsEmpty'),
          placeholder: t('knowledge.frontmatter.addTagPlaceholder'),
          add: t('knowledge.frontmatter.addTag'),
          remove: (value: string) => t('knowledge.frontmatter.removeTag', { tag: value }),
          suggestionsAria: t('knowledge.frontmatter.tagSuggestions'),
        }
      : {
          empty: t('knowledge.frontmatter.aliasesEmpty'),
          placeholder: t('knowledge.frontmatter.addAliasPlaceholder'),
          add: t('knowledge.frontmatter.addAlias'),
          remove: (value: string) => t('knowledge.frontmatter.removeAlias', { alias: value }),
          suggestionsAria: t('knowledge.frontmatter.aliasSuggestions'),
        }

  const commitValue = useCallback(
    (raw: string) => {
      const value = normalizeChipInput(kind, raw)
      if (!value || chips.includes(value)) {
        setDraft('')
        setSuggestionsOpen(false)
        return
      }
      onAdd(value)
      setDraft('')
      setSuggestionsOpen(false)
    },
    [chips, kind, onAdd],
  )

  const submit = useCallback(() => {
    if (suggestionsOpen && suggestions.length > 0) {
      commitValue(suggestions[highlight] ?? suggestions[0]!)
      return
    }
    commitValue(draft)
  }, [commitValue, draft, highlight, suggestions, suggestionsOpen])

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      submit()
    },
    [submit],
  )

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        event.preventDefault()
        setSuggestionsOpen(true)
        setHighlight((prev) => (prev + 1) % suggestions.length)
        return
      }
      if (event.key === 'ArrowUp' && suggestions.length > 0) {
        event.preventDefault()
        setSuggestionsOpen(true)
        setHighlight((prev) => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (event.key === 'Escape') {
        setSuggestionsOpen(false)
        return
      }
      if (event.key === ',' || event.key === 'Enter') {
        event.preventDefault()
        submit()
      }
    },
    [highlight, submit, suggestions.length],
  )

  const showSuggestions = suggestionsOpen && suggestions.length > 0 && normalizeChipInput(kind, draft).length > 0

  return (
    <div className="kos-frontmatter-editable">
      <div className="kos-frontmatter-chips kos-frontmatter-chips--editable">
        {chips.length === 0 ? (
          <span className="kos-panel-muted">{labels.empty}</span>
        ) : (
          chips.map((chip) => (
            <span key={chip} className="kos-tag-chip kos-tag-chip--editable">
              {chip}
              <button
                type="button"
                className="kos-tag-chip-remove"
                disabled={disabled}
                aria-label={labels.remove(chip)}
                onClick={() => onRemove(chip)}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <form className="kos-frontmatter-tag-form" onSubmit={onSubmit}>
        <div className="kos-frontmatter-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="kos-frontmatter-tag-input"
            value={draft}
            disabled={disabled}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            aria-autocomplete="list"
            aria-controls={showSuggestions ? listId : undefined}
            aria-expanded={showSuggestions}
            onChange={(event) => {
              setDraft(event.target.value)
              setSuggestionsOpen(true)
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSuggestionsOpen(false), 120)
            }}
            onKeyDown={onInputKeyDown}
          />
          {showSuggestions ? (
            <ul id={listId} className="kos-frontmatter-suggestions" role="listbox" aria-label={labels.suggestionsAria}>
              {suggestions.map((item, index) => (
                <li key={item} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    className={`kos-frontmatter-suggestion${index === highlight ? ' kos-frontmatter-suggestion--active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commitValue(item)}
                  >
                    {kind === 'tag' ? `#${item}` : item}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="submit"
          className="kos-frontmatter-tag-add"
          disabled={disabled || !normalizeChipInput(kind, draft)}
        >
          {labels.add}
        </button>
      </form>
    </div>
  )
}
