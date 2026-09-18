import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { SettingsSelectOption } from './SettingsSelect'
import { SettingsInput } from './SettingsInput'

type SettingsComboboxProps = {
  value: string
  options: readonly SettingsSelectOption<string>[]
  onValueChange: (value: string) => void | Promise<void>
  placeholder?: string
  ariaLabel?: string
  presetsAriaLabel?: string
}

export function SettingsCombobox({
  value,
  options,
  onValueChange,
  placeholder,
  ariaLabel,
  presetsAriaLabel,
}: SettingsComboboxProps) {
  const reactId = useId()
  const id = `settings-combobox-${reactId.replace(/:/g, '')}`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const hasPresets = options.length > 0

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const selectPreset = useCallback(
    async (next: string) => {
      await Promise.resolve(onValueChange(next))
      setOpen(false)
    },
    [onValueChange],
  )

  return (
    <div
      ref={rootRef}
      className={`settings-combobox${hasPresets ? '' : ' settings-combobox--input-only'}${open ? ' settings-combobox--open' : ''}`}
    >
      <div className="settings-combobox-row">
        <SettingsInput
          className="settings-combobox-input"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(event) => void onValueChange(event.target.value)}
        />
        {hasPresets ? (
          <button
            type="button"
            className="settings-combobox-trigger"
            aria-label={presetsAriaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            onClick={() => setOpen((next) => !next)}
          >
            <span className="settings-select-chevron" aria-hidden="true">
              v
            </span>
          </button>
        ) : null}
      </div>
      {open && hasPresets ? (
        <div id={`${id}-listbox`} className="settings-combobox-list" role="listbox">
          {options.map((option) => {
            const isActive = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                className={`settings-combobox-option${isActive ? ' active' : ''}`}
                role="option"
                aria-selected={isActive}
                title={option.value}
                onClick={() => void selectPreset(option.value)}
              >
                <span className="settings-combobox-option-label">{option.label}</span>
                {option.description ? (
                  <span className="settings-combobox-option-desc">{option.description}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
