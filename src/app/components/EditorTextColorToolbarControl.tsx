import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import {
  LUNA_TEXT_COLOR_DEFAULT,
  LUNA_TEXT_COLOR_PRESETS,
  normalizeTextColor,
  toNativeColorInputValue,
} from '../../editor/lunaTextColor'
import { readRecentTextColors, rememberTextColor } from '../../lib/editorTextColorRecent'
import { Icon } from '../../design-system/icons'
import { clampMenuElementPosition } from '../../lib/contextMenuPosition'
import type { TranslateFn } from '../../i18n'
import { EditorHsvColorPicker } from './EditorHsvColorPicker'

type Props = {
  t: TranslateFn
  disabled: boolean
  onColorPick: (color: string | null) => void
  onOpenChange?: (open: boolean) => void
}

export function EditorTextColorToolbarControl({ t, disabled, onColorPick, onOpenChange }: Props) {
  const menuId = useId()
  const hexInputId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const committedColorRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({
    visibility: 'hidden',
    left: -9999,
    top: 0,
  })
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [draftHex, setDraftHex] = useState<string>(LUNA_TEXT_COLOR_DEFAULT)
  const [hexDraft, setHexDraft] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [previewColor, setPreviewColor] = useState<string | null>(null)

  const normalizedHexDraft = normalizeTextColor(hexDraft)
  const hexDraftInvalid = hexDraft.trim().length > 0 && normalizedHexDraft == null

  const closePanel = useCallback(
    (revert: boolean) => {
      if (revert) onColorPick(committedColorRef.current)
      setOpen(false)
      setShowAdvanced(false)
    },
    [onColorPick],
  )

  const previewDraft = useCallback(
    (hex: string) => {
      const normalized = normalizeTextColor(hex)
      if (!normalized) return
      setDraftHex(toNativeColorInputValue(normalized))
      setHexDraft(normalized.startsWith('#') ? normalized : '')
      setPreviewColor(normalized)
      onColorPick(normalized)
    },
    [onColorPick],
  )

  useEffect(() => {
    if (!open) return
    setRecentColors(readRecentTextColors())
    committedColorRef.current = previewColor
    const seed = previewColor ?? LUNA_TEXT_COLOR_DEFAULT
    const native = toNativeColorInputValue(seed)
    setDraftHex(native)
    setHexDraft(native)
  }, [open, previewColor])

  useEffect(() => {
    onOpenChange?.(open)
  }, [onOpenChange, open])

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle({ visibility: 'hidden', left: -9999, top: 0 })
      return
    }

    let frame = 0
    const position = () => {
      const anchor = triggerRef.current
      const panel = panelRef.current
      if (!anchor || !panel) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const anchorRect = anchor.getBoundingClientRect()
      const preferredLeft = anchorRect.left
      const preferredTop = anchorRect.bottom + 4
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const { x: left, y: top } = clampMenuElementPosition(panel, preferredLeft, preferredTop)

      setPanelStyle({
        left,
        top,
        visibility: 'visible',
        minWidth: Math.max(220, anchorRect.width),
      })
    }

    position()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [open, recentColors.length, showAdvanced, draftHex])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      closePanel(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel(true)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, closePanel])

  const pickImmediate = useCallback(
    (color: string | null) => {
      if (color) {
        rememberTextColor(color)
        setPreviewColor(color)
        setRecentColors(readRecentTextColors())
      } else {
        setPreviewColor(null)
      }
      committedColorRef.current = color
      setOpen(false)
      setShowAdvanced(false)
      onColorPick(color)
    },
    [onColorPick],
  )

  const confirmDraft = useCallback(() => {
    const normalized = normalizeTextColor(draftHex)
    if (!normalized) return
    rememberTextColor(normalized)
    setPreviewColor(normalized)
    setRecentColors(readRecentTextColors())
    committedColorRef.current = normalized
    setOpen(false)
    setShowAdvanced(false)
    onColorPick(normalized)
  }, [draftHex, onColorPick])

  const markColor = open ? draftHex : previewColor
  const markStyle = markColor ? ({ color: markColor } as CSSProperties) : undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="editor-format-btn editor-format-btn--text-color"
        disabled={disabled}
        title={t('ctx.editor.textColor')}
        aria-label={t('ctx.editor.textColor')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
        }}
      >
        <span className="editor-format-text-color-mark" style={markStyle} aria-hidden>
          <Icon name="text-color" size="sm" stroke="strong" />
        </span>
        <Icon name="chevron-down" className="editor-format-text-color-chevron" size="sm" stroke="strong" />
      </button>
      {typeof document !== 'undefined' &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="dialog"
            className="editor-format-text-color-menu"
            aria-label={t('ctx.editor.textColorSubmenu')}
            style={panelStyle}
          >
            <div className="editor-format-color-grid" role="presentation">
              {LUNA_TEXT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="editor-format-color-swatch"
                  title={t(preset.labelKey)}
                  aria-label={t(preset.labelKey)}
                  style={{ '--swatch-color': preset.value } as CSSProperties}
                  onClick={() => pickImmediate(preset.value)}
                />
              ))}
            </div>

            {recentColors.length > 0 ? (
              <>
                <p className="editor-format-color-section-label">{t('editor.format.textColor.recent')}</p>
                <div className="editor-format-color-grid editor-format-color-grid--recent" role="presentation">
                  {recentColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="editor-format-color-swatch"
                      title={color}
                      aria-label={color}
                      style={{ '--swatch-color': color } as CSSProperties}
                      onClick={() => pickImmediate(color)}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <div className="editor-format-color-sep" role="separator" />
            <p className="editor-format-color-section-label">{t('editor.format.textColor.custom')}</p>

            <EditorHsvColorPicker
              color={draftHex}
              ariaLabel={t('editor.format.textColor.pickColor')}
              onChange={previewDraft}
            />

            <div
              className="editor-format-color-preview-row"
              role="status"
              aria-label={t('editor.format.textColor.preview')}
            >
              <span
                className="editor-format-color-preview-swatch"
                style={{ '--swatch-color': draftHex } as CSSProperties}
                aria-hidden
              />
              <span className="editor-format-color-preview-value">{draftHex}</span>
            </div>

            <div className="editor-format-color-actions">
              <button type="button" className="editor-format-color-action editor-format-color-action--primary" onClick={confirmDraft}>
                {t('editor.format.textColor.confirm')}
              </button>
              <button
                type="button"
                className="editor-format-color-action"
                onClick={() => closePanel(true)}
              >
                {t('editor.format.textColor.cancel')}
              </button>
            </div>

            <button
              type="button"
              className="editor-format-color-advanced-toggle"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {t('editor.format.textColor.advanced')}
              <Icon
                name="chevron-down"
                className={`editor-format-color-advanced-chevron${showAdvanced ? ' editor-format-color-advanced-chevron--open' : ''}`}
                size="sm"
                stroke="strong"
              />
            </button>

            {showAdvanced ? (
              <div className="editor-format-color-advanced" role="group" aria-label={t('editor.format.textColor.advanced')}>
                <label className="editor-format-color-native-label">
                  <span className="sr-only">{t('editor.format.textColor.nativePicker')}</span>
                  <input
                    type="color"
                    className="editor-format-color-native-input editor-format-color-native-input--large"
                    value={draftHex}
                    aria-label={t('editor.format.textColor.nativePicker')}
                    onChange={(e) => previewDraft(e.target.value)}
                  />
                </label>
                <input
                  id={hexInputId}
                  type="text"
                  className={`editor-format-color-hex-input${hexDraftInvalid ? ' editor-format-color-hex-input--invalid' : ''}`}
                  value={hexDraft}
                  placeholder={t('editor.format.textColor.hexPlaceholder')}
                  aria-label={t('editor.format.textColor.hexPlaceholder')}
                  aria-invalid={hexDraftInvalid}
                  spellCheck={false}
                  onChange={(e) => setHexDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    if (!normalizedHexDraft) return
                    previewDraft(normalizedHexDraft)
                  }}
                />
                {hexDraftInvalid ? (
                  <p className="editor-format-color-hint editor-format-color-hint--error" role="alert">
                    {t('editor.format.textColor.hexInvalid')}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="editor-format-color-sep" role="separator" />
            <button type="button" className="editor-format-color-reset" onClick={() => pickImmediate(null)}>
              {t('ctx.editor.textColorDefault')}
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
