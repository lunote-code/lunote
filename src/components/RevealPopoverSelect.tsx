import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

export type RevealPopoverSelectOption = {
  value: string
  label: string
}

type RevealPopoverSelectProps = {
  value: string
  options: readonly RevealPopoverSelectOption[]
  onValueChange: (value: string) => void
  ariaLabel: string
  testId?: string
  variant?: 'default' | 'compact'
  disabled?: boolean
}

export function RevealPopoverSelect({
  value,
  options,
  onValueChange,
  ariaLabel,
  testId,
  variant = 'default',
  disabled = false,
}: RevealPopoverSelectProps) {
  const reactId = useId()
  const listboxId = `reveal-select-${reactId.replace(/:/g, '')}-listbox`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const selectValue = useCallback(
    (next: string) => {
      onValueChange(next)
      setOpen(false)
    },
    [onValueChange],
  )

  const focusOption = useCallback(
    (optionValue: string) => {
      requestAnimationFrame(() => {
        document.getElementById(`${listboxId}-item-${optionValue}`)?.focus()
      })
    },
    [listboxId],
  )

  const focusAdjacentItem = useCallback(
    (current: string, direction: 1 | -1) => {
      const currentIndex = options.findIndex((option) => option.value === current)
      if (currentIndex < 0 || options.length === 0) return
      const next = options[(currentIndex + direction + options.length) % options.length]
      if (next) focusOption(next.value)
    },
    [focusOption, options],
  )

  return (
    <div
      ref={rootRef}
      className={`luna-reveal-popover-select${variant === 'compact' ? ' luna-reveal-popover-select--compact' : ''}${disabled ? ' is-disabled' : ''}`}
    >
      <button
        type="button"
        className="luna-reveal-popover-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        data-testid={testId}
        data-value={value}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((next) => !next)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
            focusOption(value)
          }
        }}
      >
        <span className="luna-reveal-popover-select__trigger-label">{selected?.label ?? ''}</span>
        <span className="luna-reveal-popover-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={listboxId}
          className="luna-reveal-popover-select__panel luna-reveal-popover-shell"
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={`${listboxId}-item-${value}`}
        >
          {options.map((option) => {
            const isActive = option.value === value
            return (
              <button
                key={option.value}
                id={`${listboxId}-item-${option.value}`}
                type="button"
                className={`luna-reveal-popover-list-item${isActive ? ' is-active' : ''}`}
                role="option"
                aria-selected={isActive}
                onClick={() => selectValue(option.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false)
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
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
