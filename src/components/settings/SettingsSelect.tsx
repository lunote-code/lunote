import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'

export type SettingsSelectOption<T extends string> = {
  value: T
  label: string
  group?: string
  description?: string
}

type SettingsSelectProps<T extends string> = {
  value: T
  activeValue?: T
  options: readonly SettingsSelectOption<T>[]
  onValueChange: (value: T) => void
  onPreviewValue?: (value: T) => void
  onClearPreview?: () => void
  ariaLabel?: string
}

export function SettingsSelect<T extends string>({
  value,
  activeValue,
  options,
  onValueChange,
  onPreviewValue,
  onClearPreview,
  ariaLabel,
}: SettingsSelectProps<T>) {
  const reactId = useId()
  const id = `settings-select-${reactId.replace(/:/g, '')}`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  )
  const effectiveActiveValue = activeValue ?? value
  const renderedOptions = useMemo(() => {
    let previousGroup: string | undefined
    return options.flatMap((option) => {
      const rows: Array<
        | { type: 'group'; key: string; label: string }
        | { type: 'option'; option: SettingsSelectOption<T> }
      > = []
      if (option.group && option.group !== previousGroup) {
        rows.push({ type: 'group', key: option.group, label: option.group })
        previousGroup = option.group
      }
      rows.push({ type: 'option', option })
      return rows
    })
  }, [options])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) onClearPreview?.()
  }, [onClearPreview, open])

  useEffect(() => () => onClearPreview?.(), [onClearPreview])

  const selectValue = useCallback(
    (next: T) => {
      onClearPreview?.()
      onValueChange(next)
      setOpen(false)
    },
    [onClearPreview, onValueChange],
  )

  const focusOption = useCallback((optionValue: T) => {
    requestAnimationFrame(() => {
      document.getElementById(`${id}-item-${optionValue}`)?.focus()
    })
  }, [id])

  const focusSelectedItem = useCallback(() => {
    focusOption(effectiveActiveValue)
  }, [effectiveActiveValue, focusOption])

  const focusAdjacentItem = useCallback((current: T, direction: 1 | -1) => {
    const currentIndex = options.findIndex((option) => option.value === current)
    if (currentIndex < 0 || options.length === 0) return
    const next = options[(currentIndex + direction + options.length) % options.length]
    if (next) focusOption(next.value)
  }, [focusOption, options])

  return (
    <div ref={rootRef} className="settings-select">
      <button
        type="button"
        className="settings-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
            focusSelectedItem()
          }
        }}
      >
        <span className="settings-select-trigger-copy">
          <strong>{selected?.label}</strong>
          {selected?.description ? <small>{selected.description}</small> : null}
        </span>
        <span className="settings-select-chevron" aria-hidden="true">v</span>
      </button>
      {open ? (
        <div
          id={`${id}-listbox`}
          className="settings-select-content"
          role="listbox"
          aria-activedescendant={`${id}-item-${value}`}
          onMouseLeave={onClearPreview}
        >
          {renderedOptions.map((row) => {
            if (row.type === 'group') {
              return (
                <div key={`group-${row.key}`} className="settings-select-group" role="presentation">
                  {row.label}
                </div>
              )
            }
            const { option } = row
            const isActive = option.value === effectiveActiveValue
            return (
              <button
                key={option.value}
                id={`${id}-item-${option.value}`}
                type="button"
                className={`settings-select-option${isActive ? ' active' : ''}`}
                role="option"
                aria-selected={isActive}
                title={option.description}
                onMouseEnter={() => onPreviewValue?.(option.value)}
                onFocus={() => onPreviewValue?.(option.value)}
                onBlur={onClearPreview}
                onClick={() => selectValue(option.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setOpen(false)
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    focusAdjacentItem(option.value, 1)
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    focusAdjacentItem(option.value, -1)
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectValue(option.value)
                  }
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
                {isActive ? <Check size={14} className="settings-select-check" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
