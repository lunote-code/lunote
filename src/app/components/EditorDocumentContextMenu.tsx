import { useState, type CSSProperties, type RefObject } from 'react'
import type { AppExportFormat } from '../../markdownExport'
import { LUNA_TEXT_COLOR_PRESETS } from '../../editor/lunaTextColor'
import { Icon } from '../../design-system/icons'
import { useI18n } from '../../i18n'
import type { EditorDocMenuPick, EditorDocMenuState } from '../workspace/contextMenuTypes'

export function EditorDocumentContextMenu({
  state,
  menuRef,
  diskFileReady,
  canRevealInOs,
  onPick,
  onExportPick,
  onColorPick,
}: {
  state: EditorDocMenuState
  menuRef: RefObject<HTMLDivElement | null>
  diskFileReady: boolean
  canRevealInOs: boolean
  onPick: (action: EditorDocMenuPick) => void
  onExportPick: (format: AppExportFormat) => void
  onColorPick: (color: string | null) => void
}) {
  const { t } = useI18n()
  const { x, y, hasTextSelection } = state
  const [exportOpen, setExportOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  return (
    <div
      ref={menuRef}
      role="menu"
      className="file-ctx-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('cut')}>
        {t('ctx.editor.cut')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('copy')}>
        {t('ctx.editor.copy')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('paste')}>
        {t('ctx.editor.paste')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('selectAll')}>
        {t('ctx.editor.selectAll')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <div
        className="file-ctx-submenu-wrap"
        onMouseEnter={() => setColorOpen(true)}
        onMouseLeave={() => setColorOpen(false)}
      >
        <button
          type="button"
          role="menuitem"
          className="file-ctx-item file-ctx-submenu-trigger"
          disabled={!hasTextSelection}
          aria-expanded={colorOpen}
          aria-haspopup="menu"
        >
          {t('ctx.editor.textColor')}
          <Icon name="chevron-right" className="file-ctx-submenu-chevron" size="sm" stroke="strong" />
        </button>
        {colorOpen && hasTextSelection ? (
          <div className="file-ctx-submenu file-ctx-submenu--text-color" role="menu" aria-label={t('ctx.editor.textColorSubmenu')}>
            <div className="file-ctx-color-grid" role="presentation">
              {LUNA_TEXT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="menuitem"
                  className="file-ctx-color-swatch"
                  title={t(preset.labelKey)}
                  aria-label={t(preset.labelKey)}
                  style={{ '--swatch-color': preset.value } as CSSProperties}
                  onClick={() => onColorPick(preset.value)}
                />
              ))}
            </div>
            <div className="file-ctx-sep" role="separator" />
            <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onColorPick(null)}>
              {t('ctx.editor.textColorDefault')}
            </button>
          </div>
        ) : null}
      </div>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('openTab')}>
        {t('ctx.editor.openTab')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('save')}>
        {t('ctx.editor.save')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('rename')}>
        {t('ctx.editor.rename')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('revert')}>
        {t('ctx.editor.revert')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!diskFileReady} onClick={() => onPick('copyPath')}>
        {t('ctx.editor.copyPath')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!canRevealInOs} onClick={() => onPick('reveal')}>
        {t('ctx.editor.reveal')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <div
        className="file-ctx-submenu-wrap"
        onMouseEnter={() => setExportOpen(true)}
        onMouseLeave={() => setExportOpen(false)}
      >
        <button
          type="button"
          role="menuitem"
          className="file-ctx-item file-ctx-submenu-trigger"
          disabled={!diskFileReady}
          aria-expanded={exportOpen}
          aria-haspopup="menu"
        >
          {t('ctx.editor.export')}
          <Icon name="chevron-right" className="file-ctx-submenu-chevron" size="sm" stroke="strong" />
        </button>
        {exportOpen && diskFileReady ? (
          <div className="file-ctx-submenu" role="menu" aria-label={t('ctx.editor.exportSubmenu')}>
            <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onExportPick('pdf')}>
              {t('ctx.editor.exportPdf')}
            </button>
            <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onExportPick('html')}>
              {t('ctx.editor.exportHtml')}
            </button>
            <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onExportPick('htmlPlain')}>
              {t('ctx.editor.exportHtmlPlain')}
            </button>
            <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onExportPick('image')}>
              {t('ctx.editor.exportImage')}
            </button>
            <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onExportPick('word')}>
              {t('ctx.editor.exportWord')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
