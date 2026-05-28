import { useMemo } from 'react'

import type { TranslateFn } from '../../i18n'
import { buildThreeWayMergeRows } from '../../lib/threeWayMerge'
import { SettingsButton } from '../../components/settings'

type Props = {
  t: TranslateFn
  open: boolean
  path: string
  basePreview: string
  localPreview: string
  diskPreview: string
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
  onKeepLocal,
  onUseDisk,
  onCancel,
}: Props) {
  const rows = useMemo(
    () => buildThreeWayMergeRows(basePreview, localPreview, diskPreview).slice(0, MAX_ROWS),
    [basePreview, localPreview, diskPreview],
  )
  const truncated = useMemo(() => {
    const total = buildThreeWayMergeRows(basePreview, localPreview, diskPreview).length
    return total > MAX_ROWS
  }, [basePreview, localPreview, diskPreview])

  if (!open) return null

  return (
    <div className="app-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="app-dialog save-conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-conflict-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="save-conflict-title" className="app-dialog-title">
          {t('app.saveConflict.title')}
        </h2>
        <p className="app-dialog-message">{t('app.saveConflict.message', { path })}</p>
        <div className="save-conflict-merge" role="grid" aria-label={t('app.saveConflict.mergeAria')}>
          <div className="save-conflict-merge-header" role="row">
            <span role="columnheader" className="save-conflict-merge-line">
              #
            </span>
            <span role="columnheader">{t('app.saveConflict.base')}</span>
            <span role="columnheader">{t('app.saveConflict.local')}</span>
            <span role="columnheader">{t('app.saveConflict.disk')}</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.lineNo}
              className={`save-conflict-merge-row save-conflict-merge-row--${row.kind}`}
              role="row"
            >
              <span className="save-conflict-merge-line" role="cell">
                {row.lineNo}
              </span>
              <code className="save-conflict-merge-cell" role="cell">
                {row.base || ' '}
              </code>
              <code className="save-conflict-merge-cell" role="cell">
                {row.local || ' '}
              </code>
              <code className="save-conflict-merge-cell" role="cell">
                {row.disk || ' '}
              </code>
            </div>
          ))}
        </div>
        {truncated && (
          <p className="app-dialog-message save-conflict-truncated">{t('app.saveConflict.truncated')}</p>
        )}
        <div className="app-dialog-actions">
          <SettingsButton type="button" variant="secondary" onClick={onCancel}>
            {t('app.saveConflict.cancel')}
          </SettingsButton>
          <SettingsButton type="button" variant="secondary" onClick={onUseDisk}>
            {t('app.saveConflict.useDisk')}
          </SettingsButton>
          <SettingsButton type="button" variant="primary" onClick={onKeepLocal}>
            {t('app.saveConflict.keepLocal')}
          </SettingsButton>
        </div>
      </div>
    </div>
  )
}
