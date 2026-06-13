import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'

import { ConfirmDialog } from '../../components/ConfirmDialog'
import { SettingsButton, SettingsInput } from '../../components/settings'
import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { fetchPluginCatalogDetail, fetchPluginCatalogIndex } from '../../plugins/pluginCatalogRuntime'
import {
  installPluginFromCatalogDetail,
  isPluginInstalled,
  refreshInstalledPluginsFromDisk,
  uninstallPlugin,
} from '../../plugins/pluginInstallRuntime'
import { pickLocalizedText } from '../../plugins/pluginLocalizedText'
import { listInstalledPluginsFromStore } from '../../plugins/pluginStore'
import { isPluginUpdateAvailable } from '../../plugins/pluginVersion'
import type {
  InstalledPluginRecord,
  LocalizedString,
  PluginCatalogDetail,
  PluginCatalogIndexEntry,
} from '../../plugins/pluginTypes'
import { PreferencesNotice } from '../PreferencesNotice'
import { PluginCatalogCard } from './PluginCatalogCard'
import { PluginCatalogDetailPanel } from './PluginCatalogDetailPanel'
import { PluginCatalogFeaturedSection } from './PluginCatalogFeaturedSection'
import { PluginCategoryFilter } from './PluginCategoryFilter'
import { PluginInstallConfirmDialog } from './PluginInstallConfirmDialog'
import { listPluginPermissionLabels, pluginHasExplicitIcon } from './pluginCatalogUiHelpers'
import { sortPluginCatalogRows, type PluginSortMode } from './pluginCatalogSort'
import {
  persistPluginSortMode,
  PluginSortSelect,
  readInitialPluginSortMode,
} from './PluginSortSelect'
import { usePluginDetailOverlay } from './usePluginDetailOverlay'

export type PluginListTab = 'browse' | 'installed'

type Props = {
  t: TranslateFn
  effectiveLocale: UiLocaleId
  searchQuery?: string
  activeTab: PluginListTab
  onUpdatesAvailableCountChange?: (count: number) => void
}

type CatalogRow = PluginCatalogIndexEntry & {
  detail?: PluginCatalogDetail
}

type InstallConfirmState = {
  row: CatalogRow
  detail: PluginCatalogDetail
  isUpdate: boolean
}

type UninstallConfirmState = {
  row: CatalogRow
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

function buildInstalledFallbackRow(record: InstalledPluginRecord, t: TranslateFn): CatalogRow {
  return {
    id: record.id,
    name: record.name,
    author: t('settings.plugins.unknownAuthor'),
    tagline: { en: record.id },
    category: 'installed',
    latestVersion: record.version,
    detailUrl: '',
  }
}

function rowMatchesQuery(row: CatalogRow, query: string, effectiveLocale: UiLocaleId): boolean {
  const tagline = pickLocalizedText(row.tagline, effectiveLocale)
  const tags = (row.tags ?? []).join(' ').toLowerCase()
  return (
    row.name.toLowerCase().includes(query) ||
    row.id.toLowerCase().includes(query) ||
    row.author.toLowerCase().includes(query) ||
    tagline.toLowerCase().includes(query) ||
    row.category.toLowerCase().includes(query) ||
    tags.includes(query)
  )
}

export function PluginCatalogList({
  t,
  effectiveLocale,
  searchQuery: globalSearchQuery = '',
  activeTab,
  onUpdatesAvailableCountChange,
}: Props) {
  const [rows, setRows] = useState<CatalogRow[]>([])
  const [categories, setCategories] = useState<Record<string, LocalizedString>>({})
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<PluginSortMode>(() => readInitialPluginSortMode())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<PluginCatalogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)
  const [installConfirm, setInstallConfirm] = useState<InstallConfirmState | null>(null)
  const [uninstallConfirm, setUninstallConfirm] = useState<UninstallConfirmState | null>(null)
  const [updateAllConfirmOpen, setUpdateAllConfirmOpen] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [installedRevision, setInstalledRevision] = useState(0)
  const [brokenIconIds, setBrokenIconIds] = useState<Set<string>>(() => new Set())
  const detailOverlay = usePluginDetailOverlay()
  const detailPanelRef = useRef<HTMLElement | null>(null)

  const isGlobalSearching = globalSearchQuery.trim().length > 0
  const effectiveSearchQuery = isGlobalSearching ? globalSearchQuery : localSearchQuery

  const refreshInstalled = useCallback(async () => {
    await refreshInstalledPluginsFromDisk()
    setInstalledRevision((value) => value + 1)
  }, [])

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setCatalogError(null)
    try {
      const index = await fetchPluginCatalogIndex()
      setRows(index.plugins)
      setCategories(
        Object.fromEntries((index.categories ?? []).map((entry) => [entry.id, entry.label])),
      )
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setCatalogError(message)
      setRows([])
      setCategories({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
    void refreshInstalled()
  }, [loadCatalog, refreshInstalled])

  const installedRecords = useMemo(() => {
    void installedRevision
    return listInstalledPluginsFromStore()
  }, [installedRevision])

  const installedVersionById = useMemo(
    () => new Map(installedRecords.map((entry) => [entry.id, entry.version])),
    [installedRecords],
  )

  const installedIds = useMemo(() => new Set(installedRecords.map((entry) => entry.id)), [installedRecords])

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])

  const isUpdateAvailableForRow = useCallback(
    (row: CatalogRow): boolean => {
      const installedVersion = installedVersionById.get(row.id)
      if (!installedVersion) return false
      return isPluginUpdateAvailable(installedVersion, row.latestVersion)
    },
    [installedVersionById],
  )

  const updatesAvailableCount = useMemo(
    () =>
      installedRecords.filter((record) => {
        const catalogRow = rowById.get(record.id)
        if (!catalogRow) return false
        return isUpdateAvailableForRow(catalogRow)
      }).length,
    [installedRecords, isUpdateAvailableForRow, rowById],
  )

  useEffect(() => {
    onUpdatesAvailableCountChange?.(updatesAvailableCount)
  }, [onUpdatesAvailableCountChange, updatesAvailableCount])

  const installedRows = useMemo(() => {
    return installedRecords.map((record) => rowById.get(record.id) ?? buildInstalledFallbackRow(record, t))
  }, [installedRecords, rowById, t])

  const mergedSearchRows = useMemo(() => {
    const byId = new Map<string, CatalogRow>()
    for (const row of rows) byId.set(row.id, row)
    for (const record of installedRecords) {
      if (!byId.has(record.id)) {
        byId.set(record.id, buildInstalledFallbackRow(record, t))
      }
    }
    return [...byId.values()]
  }, [installedRecords, rows, t])

  const sourceRows = isGlobalSearching
    ? mergedSearchRows
    : activeTab === 'installed'
      ? installedRows
      : rows

  const categoryFilteredRows = useMemo(() => {
    if (!selectedCategoryId || isGlobalSearching || activeTab !== 'browse') return sourceRows
    return sourceRows.filter((row) => row.category === selectedCategoryId)
  }, [activeTab, isGlobalSearching, selectedCategoryId, sourceRows])

  const updatableRows = useMemo(() => {
    return installedRecords
      .map((record) => rowById.get(record.id))
      .filter((row): row is CatalogRow => row != null && isUpdateAvailableForRow(row))
  }, [installedRecords, isUpdateAvailableForRow, rowById])

  const sortedRows = useMemo(() => {
    if (activeTab !== 'browse' || isGlobalSearching) return categoryFilteredRows
    return sortPluginCatalogRows(categoryFilteredRows, sortMode)
  }, [activeTab, categoryFilteredRows, isGlobalSearching, sortMode])

  const filteredRows = useMemo(() => {
    const query = normalizeSearchQuery(effectiveSearchQuery)
    if (!query) return sortedRows
    return sortedRows.filter((row) => rowMatchesQuery(row, query, effectiveLocale))
  }, [effectiveLocale, effectiveSearchQuery, sortedRows])

  const showFeaturedSection =
    activeTab === 'browse' && !isGlobalSearching && !loading && !catalogError
  const featuredRows = useMemo(
    () => (showFeaturedSection ? filteredRows.filter((row) => row.featured) : []),
    [filteredRows, showFeaturedSection],
  )
  const gridRows = useMemo(() => {
    if (!showFeaturedSection || featuredRows.length === 0) return filteredRows
    const featuredIds = new Set(featuredRows.map((row) => row.id))
    return filteredRows.filter((row) => !featuredIds.has(row.id))
  }, [featuredRows, filteredRows, showFeaturedSection])

  const selectedRow = useMemo(() => {
    if (!selectedId) return null
    return sourceRows.find((row) => row.id === selectedId) ?? rowById.get(selectedId) ?? null
  }, [rowById, selectedId, sourceRows])

  const loadDetail = useCallback(async (row: CatalogRow) => {
    if (row.detail) {
      setSelectedDetail(row.detail)
      setDetailError(null)
      return
    }
    if (!row.detailUrl) {
      setSelectedDetail(null)
      setDetailError(null)
      return
    }
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await fetchPluginCatalogDetail(row.detailUrl)
      setSelectedDetail(detail)
      setRows((current) =>
        current.map((entry) => (entry.id === row.id ? { ...entry, detail } : entry)),
      )
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setDetailError(message)
      setSelectedDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openDetail = useCallback(
    (row: CatalogRow) => {
      setSelectedId(row.id)
      setSelectedDetail(row.detail ?? null)
      setDetailError(null)
      void loadDetail(row)
    },
    [loadDetail],
  )

  useEffect(() => {
    if (!selectedRow) return
    const scrollDetailIntoView = () => {
      detailPanelRef.current?.scrollIntoView({
        block: detailOverlay ? 'nearest' : 'start',
        behavior: 'smooth',
      })
    }
    const frame = requestAnimationFrame(scrollDetailIntoView)
    return () => cancelAnimationFrame(frame)
  }, [detailOverlay, detailLoading, selectedRow])

  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setSelectedDetail(null)
    setDetailLoading(false)
    setDetailError(null)
  }, [])

  useEffect(() => {
    closeDetail()
  }, [activeTab, closeDetail])

  useEffect(() => {
    setSelectedCategoryId(null)
  }, [activeTab, isGlobalSearching])

  const resolveDetailForRow = useCallback(
    async (row: CatalogRow): Promise<PluginCatalogDetail> => {
      if (row.detail) return row.detail
      if (selectedDetail && selectedId === row.id) return selectedDetail
      if (!row.detailUrl) {
        throw new Error(t('settings.plugins.detailUnavailable'))
      }
      const detail = await fetchPluginCatalogDetail(row.detailUrl)
      setSelectedDetail(detail)
      setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, detail } : entry)))
      return detail
    },
    [selectedDetail, selectedId, t],
  )

  const runInstall = useCallback(
    async (row: CatalogRow, detail: PluginCatalogDetail) => {
      setInstallingId(row.id)
      setOperationError(null)
      try {
        await installPluginFromCatalogDetail(detail)
        await refreshInstalled()
        setSelectedDetail(detail)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        setOperationError(message)
      } finally {
        setInstallingId(null)
      }
    },
    [refreshInstalled],
  )

  const requestInstall = useCallback(
    async (row: CatalogRow, isUpdate: boolean) => {
      setOperationError(null)
      try {
        const detail = await resolveDetailForRow(row)
        setInstallConfirm({ row, detail, isUpdate })
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        setOperationError(message)
      }
    },
    [resolveDetailForRow],
  )

  const confirmInstall = useCallback(async () => {
    if (!installConfirm) return
    const pending = installConfirm
    setInstallConfirm(null)
    await runInstall(pending.row, pending.detail)
  }, [installConfirm, runInstall])

  const runUninstall = useCallback(
    async (row: CatalogRow) => {
      setUninstallingId(row.id)
      setOperationError(null)
      try {
        await uninstallPlugin(row.id)
        await refreshInstalled()
        if (selectedId === row.id) closeDetail()
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        setOperationError(message)
      } finally {
        setUninstallingId(null)
      }
    },
    [closeDetail, refreshInstalled, selectedId],
  )

  const requestUninstall = useCallback((row: CatalogRow) => {
    setUninstallConfirm({ row })
  }, [])

  const confirmUninstall = useCallback(async () => {
    if (!uninstallConfirm) return
    const pending = uninstallConfirm
    setUninstallConfirm(null)
    await runUninstall(pending.row)
  }, [runUninstall, uninstallConfirm])

  const runUpdateAll = useCallback(async () => {
    if (updatableRows.length === 0) return
    setUpdateAllConfirmOpen(false)
    setBulkUpdating(true)
    setOperationError(null)
    try {
      for (const row of updatableRows) {
        const detail = await resolveDetailForRow(row)
        await installPluginFromCatalogDetail(detail)
      }
      await refreshInstalled()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setOperationError(message)
    } finally {
      setBulkUpdating(false)
    }
  }, [refreshInstalled, resolveDetailForRow, updatableRows])

  const markIconBroken = useCallback((pluginId: string, row: CatalogRow) => {
    if (!pluginHasExplicitIcon(row)) return
    setBrokenIconIds((current) => {
      if (current.has(pluginId)) return current
      const next = new Set(current)
      next.add(pluginId)
      return next
    })
  }, [])

  const handleSortModeChange = useCallback((mode: PluginSortMode) => {
    persistPluginSortMode(mode)
    setSortMode(mode)
  }, [])

  const cardPropsForRow = useCallback(
    (row: CatalogRow) => {
      const installed = installedIds.has(row.id) || isPluginInstalled(row.id)
      const updateAvailable = isUpdateAvailableForRow(row)
      const installing = installingId === row.id
      const uninstalling = uninstallingId === row.id
      return {
        installed,
        installedVersion: installedVersionById.get(row.id),
        updateAvailable,
        installing,
        uninstalling,
        selected: selectedId === row.id,
        iconBroken: brokenIconIds.has(row.id),
        onOpenDetail: () => openDetail(row),
        onRequestInstall: () => void requestInstall(row, false),
        onRequestUpdate: () => void requestInstall(row, true),
        onUninstall: () => requestUninstall(row),
        onIconError: () => markIconBroken(row.id, row),
      }
    },
    [
      brokenIconIds,
      installedIds,
      installedVersionById,
      installingId,
      isUpdateAvailableForRow,
      markIconBroken,
      openDetail,
      requestInstall,
      requestUninstall,
      selectedId,
      uninstallingId,
    ],
  )

  const emptyMessage = useMemo(() => {
    const query = normalizeSearchQuery(effectiveSearchQuery)
    if (query) return t('settings.plugins.emptySearch')
    if (selectedCategoryId && activeTab === 'browse' && !isGlobalSearching) {
      return t('settings.plugins.emptyCategory')
    }
    if (activeTab === 'installed') return t('settings.plugins.installedEmpty')
    return t('settings.plugins.emptyCatalog')
  }, [activeTab, effectiveSearchQuery, isGlobalSearching, selectedCategoryId, t])

  const confirmPermissionLabels = installConfirm
    ? listPluginPermissionLabels(installConfirm.detail.permissions, t)
    : []

  const panelId = `prefs-plugins-panel-${isGlobalSearching ? 'search' : activeTab}`
  const showEmptyState = !loading && !catalogError && filteredRows.length === 0
  const showDetailBackdrop = selectedRow != null && detailOverlay

  return (
    <div
      className={`prefs-plugin-catalog${selectedRow ? ' prefs-plugin-catalog--detail-open' : ''}${detailOverlay ? ' prefs-plugin-catalog--detail-overlay' : ''}`}
    >
      {showDetailBackdrop ? (
        <button
          type="button"
          className="prefs-plugin-detail-backdrop"
          aria-label={t('settings.plugins.closeDetail')}
          onClick={closeDetail}
        />
      ) : null}

      <div
        id={panelId}
        role="region"
        aria-labelledby={isGlobalSearching ? undefined : `prefs-plugins-tab-${activeTab}`}
        className="prefs-plugin-panel"
      >
        <div className="prefs-plugin-toolbar">
          <SettingsInput
            type="search"
            className="prefs-plugin-search"
            value={isGlobalSearching ? globalSearchQuery : localSearchQuery}
            placeholder={t('settings.plugins.searchPlaceholder')}
            aria-label={t('settings.plugins.searchPlaceholder')}
            readOnly={isGlobalSearching}
            onChange={(event) => setLocalSearchQuery(event.target.value)}
          />
          {activeTab === 'browse' && !isGlobalSearching ? (
            <>
              <PluginSortSelect t={t} value={sortMode} onChange={handleSortModeChange} />
              <SettingsButton
                variant="ghost"
                className="prefs-plugin-action-btn"
                onClick={() => void loadCatalog()}
                disabled={loading}
              >
                <Icon name="refresh" size="sm" className={loading ? 'luna-spin' : undefined} />
                {t('settings.plugins.refresh')}
              </SettingsButton>
            </>
          ) : null}
          {activeTab === 'installed' && !isGlobalSearching ? (
            <SettingsButton
              variant="ghost"
              className="prefs-plugin-action-btn"
              onClick={() => void refreshInstalled()}
            >
              <Icon name="refresh" size="sm" />
              {t('settings.plugins.refreshInstalled')}
            </SettingsButton>
          ) : null}
        </div>

        {activeTab === 'browse' && !isGlobalSearching && Object.keys(categories).length > 0 ? (
          <PluginCategoryFilter
            t={t}
            effectiveLocale={effectiveLocale}
            categories={categories}
            activeCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
          />
        ) : null}

        {!isGlobalSearching && updatesAvailableCount > 0 ? (
          <div className="prefs-plugin-inline-notice">
            <PreferencesNotice tone="status" role="status">
              {t('settings.plugins.updatesAvailable', { count: updatesAvailableCount })}
            </PreferencesNotice>
            <SettingsButton
              variant="ghost"
              className="prefs-plugin-action-btn prefs-plugin-action-btn--install"
              disabled={bulkUpdating}
              onClick={() => setUpdateAllConfirmOpen(true)}
            >
              <Icon name="refresh" size="sm" tone="accent" className={bulkUpdating ? 'luna-spin' : undefined} />
              {bulkUpdating ? t('settings.plugins.updatingAll') : t('settings.plugins.updateAll')}
            </SettingsButton>
          </div>
        ) : null}

        {loading && activeTab === 'browse' && !isGlobalSearching ? (
          <PreferencesNotice tone="status" role="status" ariaLive="polite">
            {t('settings.plugins.loading')}
          </PreferencesNotice>
        ) : null}

        {catalogError ? (
          <div className="prefs-plugin-inline-notice">
            <PreferencesNotice tone="error" role="alert">
              {t('settings.plugins.error', { message: catalogError })}
            </PreferencesNotice>
            <SettingsButton variant="ghost" className="prefs-plugin-action-btn" onClick={() => void loadCatalog()}>
              <Icon name="refresh" size="sm" />
              {t('settings.plugins.retry')}
            </SettingsButton>
          </div>
        ) : null}

        {operationError ? (
          <PreferencesNotice tone="error" role="alert">
            {t('settings.plugins.error', { message: operationError })}
          </PreferencesNotice>
        ) : null}

        {showEmptyState ? (
          <div className="prefs-plugin-inline-notice">
            <PreferencesNotice tone="muted" role="status">
              {emptyMessage}
            </PreferencesNotice>
            {normalizeSearchQuery(effectiveSearchQuery) ? (
              <SettingsButton
                variant="ghost"
                className="prefs-plugin-action-btn"
                onClick={() => setLocalSearchQuery('')}
              >
                {t('settings.plugins.clearSearch')}
              </SettingsButton>
            ) : selectedCategoryId ? (
              <SettingsButton
                variant="ghost"
                className="prefs-plugin-action-btn"
                onClick={() => setSelectedCategoryId(null)}
              >
                {t('settings.plugins.categoryAll')}
              </SettingsButton>
            ) : null}
          </div>
        ) : null}

        <div className="prefs-plugin-layout">
          <div className="prefs-plugin-main">
            <PluginCatalogFeaturedSection
              t={t}
              rows={featuredRows}
              effectiveLocale={effectiveLocale}
              categories={categories}
              cardPropsForRow={cardPropsForRow}
            />
            {featuredRows.length > 0 && gridRows.length > 0 ? (
              <h4 className="prefs-plugin-section-title">{t('settings.plugins.allPluginsSection')}</h4>
            ) : null}
            <div className="prefs-plugin-grid">
              {gridRows.map((row) => (
                <PluginCatalogCard
                  key={row.id}
                  row={row}
                  effectiveLocale={effectiveLocale}
                  categories={categories}
                  t={t}
                  {...cardPropsForRow(row)}
                />
              ))}
            </div>
          </div>

          {selectedRow ? (
            <PluginCatalogDetailPanelWithFocusTrap
              row={selectedRow}
              detail={selectedDetail}
              detailLoading={detailLoading}
              detailError={detailError}
              effectiveLocale={effectiveLocale}
              categories={categories}
              installed={installedIds.has(selectedRow.id) || isPluginInstalled(selectedRow.id)}
              updateAvailable={isUpdateAvailableForRow(selectedRow)}
              installedVersion={installedVersionById.get(selectedRow.id)}
              installing={installingId === selectedRow.id}
              uninstalling={uninstallingId === selectedRow.id}
              overlayMode={detailOverlay}
              t={t}
              onClose={closeDetail}
              onRetryDetail={() => void loadDetail(selectedRow)}
              onRequestInstall={() => void requestInstall(selectedRow, false)}
              onRequestUpdate={() => void requestInstall(selectedRow, true)}
              onUninstall={() => requestUninstall(selectedRow)}
              panelRef={(el) => {
                detailPanelRef.current = el
              }}
            />
          ) : null}
        </div>
      </div>

      <PluginInstallConfirmDialog
        open={installConfirm != null}
        pluginName={installConfirm?.row.name ?? ''}
        version={installConfirm?.detail.versions[0]?.version ?? installConfirm?.row.latestVersion ?? ''}
        isUpdate={installConfirm?.isUpdate ?? false}
        permissionLabels={confirmPermissionLabels}
        t={t}
        onConfirm={() => void confirmInstall()}
        onCancel={() => setInstallConfirm(null)}
      />

      <ConfirmDialog
        open={uninstallConfirm != null}
        title={t('settings.plugins.confirmUninstallTitle', { name: uninstallConfirm?.row.name ?? '' })}
        message={t('settings.plugins.confirmUninstallMessage', { name: uninstallConfirm?.row.name ?? '' })}
        confirmLabel={t('settings.plugins.uninstall')}
        cancelLabel={t('settings.plugins.confirmCancel')}
        variant="warning"
        onConfirm={() => void confirmUninstall()}
        onCancel={() => setUninstallConfirm(null)}
      />

      <ConfirmDialog
        open={updateAllConfirmOpen}
        title={t('settings.plugins.confirmUpdateAllTitle')}
        message={t('settings.plugins.confirmUpdateAllMessage', { count: updatableRows.length })}
        confirmLabel={t('settings.plugins.updateAll')}
        cancelLabel={t('settings.plugins.confirmCancel')}
        variant="default"
        onConfirm={() => void runUpdateAll()}
        onCancel={() => setUpdateAllConfirmOpen(false)}
      />
    </div>
  )
}

type DetailPanelProps = ComponentProps<typeof PluginCatalogDetailPanel>

function PluginCatalogDetailPanelWithFocusTrap(props: DetailPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null)
  const trapEnabled = props.overlayMode === true

  useFocusTrap(trapEnabled, panelEl, { initialFocusRef: closeButtonRef, onEscape: props.onClose })

  return (
    <PluginCatalogDetailPanel
      {...props}
      panelRef={(el) => {
        setPanelEl(el)
        if (typeof props.panelRef === 'function') props.panelRef(el)
      }}
      closeButtonRef={closeButtonRef}
    />
  )
}
