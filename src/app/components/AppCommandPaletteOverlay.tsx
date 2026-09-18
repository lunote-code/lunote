import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import type { TranslateFn } from '../../i18n'
import type { PaletteCommandDef } from '../../menu'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { bindOverlayScrollbarReveal } from '../overlayScrollbarReveal'

type Props = {
  t: TranslateFn
  open: boolean
  query: string
  index: number
  inputRef: RefObject<HTMLInputElement | null>
  paletteFiltered: PaletteCommandDef[]
  onClose: () => void
  onQueryChange: (q: string) => void
  onIndexChange: (index: number) => void
  onRunCommand: (id: string) => void
}

export function AppCommandPaletteOverlay({
  t,
  open,
  query,
  index,
  inputRef,
  paletteFiltered,
  onClose,
  onQueryChange,
  onIndexChange,
  onRunCommand,
}: Props) {
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null)
  const commandPaletteListRef = useRef<HTMLUListElement | null>(null)
  const listboxId = useId()

  useFocusTrap(open, dialogEl, {
    initialFocusRef: inputRef,
    onEscape: onClose,
  })

  useEffect(() => {
    if (!open) return
    const active = commandPaletteListRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [index, open, paletteFiltered.length])

  useEffect(() => {
    if (!open || !commandPaletteListRef.current) return
    return bindOverlayScrollbarReveal(commandPaletteListRef.current)
  }, [open])

  const activeOptionId =
    paletteFiltered.length > 0 ? `${listboxId}-option-${index}` : undefined

  if (!open) return null

  const overlay = (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={setDialogEl}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('app.commandPalette.aria')}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          role="combobox"
          aria-expanded={paletteFiltered.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-label={t('app.commandPalette.inputLabel')}
          placeholder={t('app.commandPalette.placeholder')}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
            onIndexChange(0)
          }}
        />
        <ul
          ref={commandPaletteListRef}
          id={listboxId}
          className="command-palette-list luna-overlay-scroll"
          role="listbox"
          aria-label={t('app.commandPalette.listAria')}
        >
          {paletteFiltered.length === 0 ? (
            <li className="command-palette-empty" key="empty" role="status" aria-live="polite">
              {t('commandPalette.empty')}
            </li>
          ) : (
            paletteFiltered.map((command, idx) => (
              <li key={command.id} role="presentation">
                <button
                  type="button"
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={idx === index}
                  className="command-palette-item"
                  data-active={idx === index ? 'true' : undefined}
                  onClick={() => void onRunCommand(command.id)}
                  onMouseEnter={() => onIndexChange(idx)}
                >
                  <span className="command-palette-item-row">
                    <span className="command-palette-item-label">{command.label}</span>
                    {command.shortcut ? (
                      <kbd className="command-palette-item-shortcut">{command.shortcut}</kbd>
                    ) : null}
                  </span>
                  {command.hint ? <span className="command-palette-item-hint">{command.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay
}
