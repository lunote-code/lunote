import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { SettingsButton, SettingsDescription, SettingsInput } from '../components/settings'
import {
  createWorkspaceTemplate,
  listWorkspaceTemplates,
  loadWorkspaceTemplatePreview,
  rememberRecentWorkspaceTemplate,
  type WorkspaceTemplateEntry,
} from './templateCatalog'
import { openTemplateDocumentByPath, revealWorkspaceTemplateFile } from './templateService'
import '../preferences/workspace/templatePickerDialog.css'

type Props = {
  open: boolean
  rootDir: string
  title: string
  description: string
  currentValue: string
  onClose: () => void
  onConfirm: (relativePath: string) => Promise<void> | void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function TemplatePickerDialog({
  open,
  rootDir,
  title,
  description,
  currentValue,
  onClose,
  onConfirm,
  t,
}: Props) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [templates, setTemplates] = useState<WorkspaceTemplateEntry[]>([])
  const [selected, setSelected] = useState(currentValue)
  const [searchQuery, setSearchQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const refreshTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const entries = await listWorkspaceTemplates(rootDir)
      setTemplates(entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [rootDir])

  useEffect(() => {
    if (!open) return
    setSelected(currentValue)
    setSearchQuery('')
    setError(null)
    setNewName('')
    void refreshTemplates()
  }, [open, rootDir, currentValue, refreshTemplates])

  const selectedEntry = useMemo(
    () => templates.find((entry) => entry.relativePath === selected) ?? null,
    [selected, templates],
  )

  const currentEntry = useMemo(
    () => templates.find((entry) => entry.relativePath === currentValue) ?? null,
    [currentValue, templates],
  )

  const recentEntries = useMemo(
    () =>
      [...templates]
        .filter((entry) => entry.isRecent && entry.relativePath !== currentValue)
        .sort((a, b) => (a.recentRank ?? Number.MAX_SAFE_INTEGER) - (b.recentRank ?? Number.MAX_SAFE_INTEGER)),
    [currentValue, templates],
  )

  const featuredTemplates = useMemo(() => {
    const out: WorkspaceTemplateEntry[] = []
    if (currentEntry) out.push(currentEntry)
    out.push(...recentEntries)
    return out
  }, [currentEntry, recentEntries])

  const allTemplates = useMemo(
    () => [...templates].sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    [templates],
  )

  const remainingTemplates = useMemo(() => {
    const featured = new Set(featuredTemplates.map((entry) => entry.relativePath))
    return allTemplates.filter((entry) => !featured.has(entry.relativePath))
  }, [allTemplates, featuredTemplates])

  const filteredFeaturedTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return featuredTemplates
    return featuredTemplates.filter((entry) => {
      const haystacks = [
        entry.displayName,
        entry.fileName,
        entry.relativePath,
        entry.folderLabel ?? '',
      ]
      return haystacks.some((value) => value.toLowerCase().includes(query))
    })
  }, [featuredTemplates, searchQuery])

  const filteredRemainingTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return remainingTemplates
    return remainingTemplates.filter((entry) => {
      const haystacks = [
        entry.displayName,
        entry.fileName,
        entry.relativePath,
        entry.folderLabel ?? '',
      ]
      return haystacks.some((value) => value.toLowerCase().includes(query))
    })
  }, [remainingTemplates, searchQuery])

  const hasFilteredResults = filteredFeaturedTemplates.length > 0 || filteredRemainingTemplates.length > 0
  const visibleTemplates = useMemo(
    () => [...filteredFeaturedTemplates, ...filteredRemainingTemplates],
    [filteredFeaturedTemplates, filteredRemainingTemplates],
  )
  const totalVisibleCount = visibleTemplates.length

  const refreshPreview = useCallback(async () => {
    if (!open || !selected) {
      setPreviewText('')
      setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    setPreviewText('')
    try {
      const preview = await loadWorkspaceTemplatePreview(rootDir, selected)
      setPreviewText(preview)
    } catch {
      setPreviewText('')
    } finally {
      setPreviewLoading(false)
    }
  }, [open, rootDir, selected])

  useEffect(() => {
    if (!open) return
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [open])

  useEffect(() => {
    if (!open) return
    if (visibleTemplates.length === 0) {
      setSelected('')
      return
    }
    if (!visibleTemplates.some((entry) => entry.relativePath === selected)) {
      setSelected(visibleTemplates[0]?.relativePath ?? '')
    }
  }, [open, selected, visibleTemplates])

  useEffect(() => {
    if (!selected) return
    itemRefs.current[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useEffect(() => {
    let cancelled = false
    if (!open || !selected) {
      setPreviewText('')
      setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    setPreviewText('')
    void (async () => {
      try {
        const preview = await loadWorkspaceTemplatePreview(rootDir, selected)
        if (!cancelled) setPreviewText(preview)
      } catch {
        if (!cancelled) setPreviewText('')
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, rootDir, selected])

  const handleCreate = async () => {
    setSaving(true)
    setError(null)
    try {
      const created = await createWorkspaceTemplate(rootDir, newName)
      const entries = await listWorkspaceTemplates(rootDir)
      setTemplates(entries)
      setSelected(created)
      setSearchQuery('')
      setNewName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = useCallback(async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await rememberRecentWorkspaceTemplate(rootDir, selected)
      await onConfirm(selected)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [onClose, onConfirm, rootDir, selected])

  const handleEditTemplate = async () => {
    if (!selectedEntry) return
    setActionLoading(true)
    setError(null)
    try {
      await openTemplateDocumentByPath(rootDir, selectedEntry.relativePath, true)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const handleRevealTemplate = async () => {
    if (!selectedEntry) return
    setActionLoading(true)
    setError(null)
    try {
      await revealWorkspaceTemplateFile(rootDir, selectedEntry.relativePath)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const handleReload = async () => {
    setActionLoading(true)
    setError(null)
    try {
      await refreshTemplates()
      await refreshPreview()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      if (visibleTemplates.length === 0) return
      const currentIndex = visibleTemplates.findIndex((entry) => entry.relativePath === selected)
      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : visibleTemplates.length - 1
          : (currentIndex + direction + visibleTemplates.length) % visibleTemplates.length
      setSelected(visibleTemplates[nextIndex]?.relativePath ?? '')
    },
    [selected, visibleTemplates],
  )

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelection(1)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelection(-1)
        return
      }
      if (event.key === 'Enter' && selected && !saving) {
        event.preventDefault()
        void handleConfirm()
      }
    },
    [handleConfirm, moveSelection, saving, selected],
  )

  if (!open) return null

  return createPortal(
    <div className="about-modal-backdrop confirm-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="about-modal confirm-modal template-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
        aria-describedby="template-picker-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="template-picker-title" className="about-modal-title confirm-modal-title">
          {title}
        </h2>
        <p id="template-picker-desc" className="about-modal-desc confirm-modal-desc">
          {description}
        </p>

        {error ? <p className="template-picker-error">{error}</p> : null}

        <div className="template-picker-create">
          <SettingsInput
            value={newName}
            disabled={saving}
            placeholder={t('settings.workspaceNotes.templatePicker.newPlaceholder')}
            onChange={(event) => setNewName(event.target.value)}
          />
          <SettingsButton type="button" variant="secondary" disabled={saving || !newName.trim()} onClick={() => void handleCreate()}>
            {t('settings.workspaceNotes.templatePicker.create')}
          </SettingsButton>
        </div>

        <div className="template-picker-search">
          <SettingsInput
            ref={searchInputRef}
            value={searchQuery}
            disabled={saving || loading}
            placeholder={t('settings.workspaceNotes.templatePicker.searchPlaceholder')}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <div className="template-picker-toolbar-meta">
          <span>{t('settings.workspaceNotes.templatePicker.keyboardHint')}</span>
          <span>{t('settings.workspaceNotes.templatePicker.resultsCount', { visible: totalVisibleCount, total: allTemplates.length })}</span>
        </div>

        {loading ? (
          <p className="template-picker-empty">{t('settings.workspaceNotes.loading')}</p>
        ) : allTemplates.length === 0 ? (
          <p className="template-picker-empty">{t('settings.workspaceNotes.templatePicker.empty')}</p>
        ) : !hasFilteredResults ? (
          <p className="template-picker-empty">
            {t('settings.workspaceNotes.templatePicker.noSearchResults', { query: searchQuery.trim() })}
          </p>
        ) : (
          <>
            {filteredFeaturedTemplates.length > 0 ? (
              <section className="template-picker-section">
                <div className="template-picker-section-title-row">
                  <div className="template-picker-section-title">
                    {t('settings.workspaceNotes.templatePicker.recommendedTitle')}
                  </div>
                  <span className="template-picker-section-count">
                    {t('settings.workspaceNotes.templatePicker.sectionCount', { count: filteredFeaturedTemplates.length })}
                  </span>
                </div>
                <div className="template-picker-list luna-overlay-scroll" role="listbox" aria-label={title}>
                  {filteredFeaturedTemplates.map((entry) => {
                    const active = entry.relativePath === selected
                    return (
                      <button
                        key={entry.relativePath}
                        ref={(node) => {
                          itemRefs.current[entry.relativePath] = node
                        }}
                        type="button"
                        className={`template-picker-item ${active ? 'active' : ''}`}
                        onClick={() => setSelected(entry.relativePath)}
                      >
                        <span className="template-picker-item-main">
                          <strong>{entry.displayName}</strong>
                          {entry.relativePath === currentValue ? (
                            <span className="template-picker-current">{t('settings.workspaceNotes.templatePicker.current')}</span>
                          ) : null}
                          {entry.isRecent ? (
                            <span className="template-picker-recent">{t('settings.workspaceNotes.templatePicker.recent')}</span>
                          ) : null}
                        </span>
                        <span className="template-picker-item-path">{entry.relativePath}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {filteredRemainingTemplates.length > 0 ? (
              <section className="template-picker-section">
                <div className="template-picker-section-title-row">
                  <div className="template-picker-section-title">
                    {t('settings.workspaceNotes.templatePicker.allTemplatesTitle')}
                  </div>
                  <span className="template-picker-section-count">
                    {t('settings.workspaceNotes.templatePicker.sectionCount', { count: filteredRemainingTemplates.length })}
                  </span>
                </div>
                <div className="template-picker-list luna-overlay-scroll" role="listbox" aria-label={title}>
                  {filteredRemainingTemplates.map((entry) => {
                    const active = entry.relativePath === selected
                    return (
                      <button
                        key={entry.relativePath}
                        ref={(node) => {
                          itemRefs.current[entry.relativePath] = node
                        }}
                        type="button"
                        className={`template-picker-item ${active ? 'active' : ''}`}
                        onClick={() => setSelected(entry.relativePath)}
                      >
                        <span className="template-picker-item-main">
                          <strong>{entry.displayName}</strong>
                        </span>
                        <span className="template-picker-item-path">{entry.relativePath}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}

        {selectedEntry ? (
          <div className="template-picker-preview" aria-live="polite">
            <div className="template-picker-preview-title">
              {t('settings.workspaceNotes.templatePicker.previewTitle')}
            </div>
            {previewLoading ? (
              <p className="template-picker-empty">{t('settings.workspaceNotes.loading')}</p>
            ) : (
              <pre className="template-picker-preview-body">
                {previewText || t('settings.workspaceNotes.templatePicker.previewEmpty')}
              </pre>
            )}
            <div className="template-picker-preview-actions">
              <SettingsButton
                type="button"
                variant="ghost"
                disabled={actionLoading || saving || loading}
                onClick={() => void handleReload()}
              >
                {t('settings.workspaceNotes.reload')}
              </SettingsButton>
              <SettingsButton
                type="button"
                variant="ghost"
                disabled={actionLoading || saving}
                onClick={() => void handleEditTemplate()}
              >
                {t('settings.workspaceNotes.templatePicker.editTemplate')}
              </SettingsButton>
              <SettingsButton
                type="button"
                variant="ghost"
                disabled={actionLoading || saving}
                onClick={() => void handleRevealTemplate()}
              >
                {t('settings.workspaceNotes.templatePicker.revealTemplate')}
              </SettingsButton>
            </div>
          </div>
        ) : null}

        <SettingsDescription>
          {selectedEntry
            ? t('settings.workspaceNotes.templatePicker.selected', { path: selectedEntry.relativePath })
            : t('settings.workspaceNotes.templatePicker.noneSelected')}
        </SettingsDescription>

        <div className="rename-modal-actions confirm-modal-actions">
          <SettingsButton variant="secondary" onClick={onClose}>
            {t('settings.workspaceNotes.templatePicker.cancel')}
          </SettingsButton>
          <SettingsButton variant="primary" disabled={!selected || saving} onClick={() => void handleConfirm()}>
            {t('settings.workspaceNotes.templatePicker.use')}
          </SettingsButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
