import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'

import { LunaCodeToolbarButton } from '../../LunaCodeToolbarButton'
import { IconCheck, IconChevronDown, IconChevronUp, IconCodeLang, IconCopy } from './CodeBlockToolbarIcons'

type Props = {
  chipRef: RefObject<HTMLButtonElement | null>
  displayLang: string
  folded: boolean
  paletteOpen: boolean
  copySuccess: boolean
  toolbarAria: string
  languageAria: string
  expandLabel: string
  collapseLabel: string
  copyLabel: string
  onTogglePalette: () => void
  onChipKeyDown: (event: KeyboardEvent) => void
  onToggleFolded: () => void
  onToggleFoldedPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onCopyClick: (event: MouseEvent) => void
}

export function CodeBlockToolbar({
  chipRef,
  displayLang,
  folded,
  paletteOpen,
  copySuccess,
  toolbarAria,
  languageAria,
  expandLabel,
  collapseLabel,
  copyLabel,
  onTogglePalette,
  onChipKeyDown,
  onToggleFolded,
  onToggleFoldedPointerDown,
  onCopyClick,
}: Props) {
  return (
    <div className="luna-code-toolbar" role="toolbar" aria-label={toolbarAria}>
      <LunaCodeToolbarButton
        ref={chipRef}
        variant="chip"
        className="pm-code-lang-chip"
        aria-haspopup="listbox"
        aria-expanded={paletteOpen}
        aria-label={languageAria}
        title={displayLang}
        onClick={onTogglePalette}
        onKeyDown={onChipKeyDown}
      >
        <span className="pm-code-lang-chip__glyph" aria-hidden>
          <IconCodeLang />
        </span>
        <span className="pm-code-lang-chip__label">{displayLang}</span>
        <span className="pm-code-lang-chip__chev" aria-hidden>
          <IconChevronDown className="pm-code-lang-chip__chev-svg" />
        </span>
      </LunaCodeToolbarButton>
      <div className="luna-code-toolbar__actions" data-testid="code-toolbar-secondary-actions">
        <LunaCodeToolbarButton
          variant="icon"
          pressed={folded}
          title={folded ? expandLabel : collapseLabel}
          aria-label={folded ? expandLabel : collapseLabel}
          onPointerDown={onToggleFoldedPointerDown}
          onClick={onToggleFolded}
        >
          {folded ? <IconChevronDown /> : <IconChevronUp />}
        </LunaCodeToolbarButton>
        <LunaCodeToolbarButton
          variant="icon"
          preventMouseDownDefault
          className={`luna-btn--copy${copySuccess ? ' luna-btn--copy-success' : ''}`}
          title={copyLabel}
          aria-label={copyLabel}
          onClick={onCopyClick}
        >
          <span className="luna-btn__copy-icons" aria-hidden>
            <span className="luna-btn__copy-icon luna-btn__copy-icon--idle">
              <IconCopy />
            </span>
            <span className="luna-btn__copy-icon luna-btn__copy-icon--done">
              <IconCheck />
            </span>
          </span>
        </LunaCodeToolbarButton>
      </div>
    </div>
  )
}
