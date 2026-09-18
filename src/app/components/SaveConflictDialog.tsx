import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { TranslateFn } from '../../i18n'
import { buildThreeWayMergeRows } from '../../lib/threeWayMerge'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { SettingsButton } from '../../components/settings'
import { bindOverlayScrollbarReveal } from '../overlayScrollbarReveal'

type Props = {
  t: TranslateFn
  open: boolean
  path: string
  basePreview: string
  localPreview: string
  diskPreview: string
  diskReadable: boolean
  sourceMode: 'manual' | 'autosave' | 'external'
  resolving?: boolean
  onKeepLocal: () => void
  onUseDisk: () => void
  onCancel: () => void
}

const MAX_ROWS = 200

export function SaveConflictDialog({
  t,
  open,
  path,
  basePreview,
  localPreview,
  diskPreview,
  diskReadable,
  sourceMode,
  resolving = false,
  onKeepLocal,
  onUseDisk,
  onCancel,
}: Props) {
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null)
  const compareRef = useRef<HTMLDivElement | null>(null)
  const rows = useMemo(
    () => buildThreeWayMergeRows(basePreview, localPreview, diskPreview).slice(0, MAX_ROWS),
    [basePreview, localPreview, diskPreview],
  )
  const truncated = useMemo(() => {
    const total = buildThreeWayMergeRows(basePreview, localPreview, diskPreview).length
    return total > MAX_ROWS
  }, [basePreview, localPreview, diskPreview])

  useFocusTrap(open, dialogEl, {
    onEscape: onCancel,
  })

  useEffect(() => {
    if (!open || !dialogEl) return
    return bindOverlayScrollbarReveal(dialogEl)
  }, [dialogEl, open])

  useEffect(() => {
    if (!open || !compareRef.current) return
    return bindOverlayScrollbarReveal(compareRef.current)
  }, [open, rows.length])

  if (!open) return null

  const dialog = (
    <div
      className="app-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target !== e.currentTarget || resolving) return
        onCancel()
      }}
    >
      <div
        ref={setDialogEl}
        className="app-dialog save-conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-conflict-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {sourceMode === 'autosave' ? (
          <div className="save-conflict-source-badge">
            {t('settings.editor.autosaveEnabled.label')}
          </div>
        ) : null}
        {sourceMode === 'external' ? (
          <div className="save-conflict-source-badge save-conflict-source-badge--external">
            {t('app.saveConflict.externalBadge')}
          </div>
        ) : null}
        <h2 id="save-conflict-title" className="app-dialog-title">
          {sourceMode === 'external' ? t('app.saveConflict.externalTitle') : t('app.saveConflict.title')}
        </h2>
        <p className="app-dialog-message">
          {sourceMode === 'external'
            ? t('app.saveConflict.externalMessage', { path })
            : t('app.saveConflict.message', { path })}
        </p>
        <p className="app-dialog-message save-conflict-readonly-hint">
          {sourceMode === 'external'
            ? t('app.saveConflict.externalReadOnlyHint')
            : t('app.saveConflict.readOnlyHint')}
        </p>
        <div ref={compareRef} className="save-conflict-compare" role="grid" aria-label={t('app.saveConflict.compareAria')}>
          <div className="save-conflict-compare-header" role="row">
            <span role="columnheader" className="save-conflict-compare-line">
              #
            </span>
            <span role="columnheader">{t('app.saveConflict.base')}</span>
            <span role="columnheader">{t('app.saveConflict.local')}</span>
            <span role="columnheader">{t('app.saveConflict.disk')}</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.lineNo}
              className={`save-conflict-compare-row save-conflict-compare-row--${row.kind}`}
              role="row"
            >
              <span className="save-conflict-compare-line" role="cell">
                {row.lineNo}
              </span>
              <code className="save-conflict-compare-cell" role="cell">
                {row.base || ' '}
              </code>
              <code className="save-conflict-compare-cell" role="cell">
                {row.local || ' '}
              </code>
              <code className="save-conflict-compare-cell" role="cell">
                {diskReadable ? (row.disk || ' ') : '—'}
              </code>
            </div>
          ))}
        </div>
        {!diskReadable ? (
          <p className="app-dialog-message save-conflict-unavailable">
            {t('app.saveConflict.diskUnreadable')}
          </p>
        ) : null}
        {truncated && (
          <p className="app-dialog-message save-conflict-truncated">{t('app.saveConflict.truncated')}</p>
        )}
        <div className="app-dialog-actions">
          <SettingsButton type="button" variant="secondary" onClick={onCancel} disabled={resolving}>
            {t('app.saveConflict.cancel')}
          </SettingsButton>
          <SettingsButton
            type="button"
            variant="secondary"
            onClick={onUseDisk}
            disabled={resolving}
            title={!diskReadable ? t('app.saveConflict.useDiskHint') : undefined}
          >
            {t('app.saveConflict.useDisk')}
          </SettingsButton>
          <SettingsButton type="button" variant="primary" onClick={onKeepLocal} disabled={resolving}>
            {resolving
              ? t('app.saveConflict.resolving')
              : sourceMode === 'external'
                ? t('app.saveConflict.keepLocalEdits')
                : t('app.saveConflict.keepLocal')}
          </SettingsButton>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog
}
