import { useCallback, useEffect, useRef, type RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { importAsset, revealAssetInFolder, previewAsset } from '../../assets/assetManager'
import { withLunaAssetPickInFlight } from '../../assets/lunaAssetPickSession'
import type { AssetStorageConfig } from '../../assets/assetStoragePolicy'
import {
  assetTooltip,
  createAssetMarkdownLink,
  parseAssetId,
} from '../../assets/markdownLinkTransformer'
import { pickLocalAssetFile } from '../../editor/lunaAssetPicker'
import {
  getAssetMeta,
  getCachedAssetMeta,
  readWorkspaceAssetIndex,
  setActiveAssetWorkspace,
} from '../../assets/workspaceAssetStore'
import type { AssetMeta } from '../../assets/workspaceAssetStore'
import {
  buildAssetGraphFromWorkspace,
  resetAssetGraph,
} from '../../assets/assetGraph'
import { resetAssetReferenceTracker } from '../../assets/assetReferenceTracker'
import { DEFAULT_ASSET_STORAGE_CONFIG } from '../../assets/assetStoragePolicy'
import { workspaceIdFromRoot } from '../../lunaPersistence'
import { savePastedImageAsset } from '../assets/imagePaste'
import { registerWorkspaceAssetScope } from '../../platform/tauri/assetService'

export type AssetHandlersDeps = {
  t: TranslateFn
  rootDir: string
  activePath: string
  assetStorageConfig: AssetStorageConfig
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  setStatus: (msg: string) => void
}

export function useAssetHandlers(deps: AssetHandlersDeps) {
  const { t, rootDir, activePath, assetStorageConfig, contentRef, setStatus } = deps

  const pasteCtxRef = useRef({
    rootDir: '',
    activePath: '',
    assetStorage: DEFAULT_ASSET_STORAGE_CONFIG,
  })

  const pasteImageHandlerRef = useRef<(file: File, mimeHint: string) => Promise<string | null>>(
    async () => null,
  )

  useEffect(() => {
    pasteCtxRef.current = { rootDir, activePath, assetStorage: assetStorageConfig }
  }, [rootDir, activePath, assetStorageConfig])

  const pasteImageIntoVisualEditor = useCallback(
    (file: File, mimeHint: string) =>
      savePastedImageAsset(file, mimeHint, () => pasteCtxRef.current, (key, vars) => setStatus(t(key, vars))),
    [setStatus, t],
  )

  useEffect(() => {
    pasteImageHandlerRef.current = pasteImageIntoVisualEditor
  }, [pasteImageIntoVisualEditor])

  useEffect(() => {
    if (!rootDir) {
      setActiveAssetWorkspace(null, null)
      resetAssetGraph()
      resetAssetReferenceTracker()
      return
    }
    const workspaceId = workspaceIdFromRoot(rootDir)
    setActiveAssetWorkspace(workspaceId, rootDir)
    void registerWorkspaceAssetScope(rootDir).catch((error) => {
      console.error('[LUNA ASSET] register scope failed', error)
    })
    void readWorkspaceAssetIndex(workspaceId).catch((error) => {
      console.error('[LUNA ASSET] read index failed', error)
    })
    void buildAssetGraphFromWorkspace({ root: rootDir, workspaceId }).catch((error) => {
      console.error('[ASSET GRAPH] build failed', error)
    })
  }, [rootDir])

  const pickAndImportLunaAsset = useCallback(async () => {
    return withLunaAssetPickInFlight(async () => {
      if (!rootDir) {
        setStatus('Open a workspace first')
        return null
      }
      const file = await pickLocalAssetFile({ title: 'Choose attachment' })
      if (!file) return null
      const workspaceId = workspaceIdFromRoot(rootDir)
      const documentPath = activePath || `${rootDir.replace(/[/\\]+$/u, '')}/Untitled.md`
      setActiveAssetWorkspace(workspaceId, rootDir)
      const asset = await importAsset(file, {
        documentPath,
        workspaceRoot: rootDir,
        workspaceId,
        storageConfig: assetStorageConfig,
      })
      await dispatchDocumentCommand({
        type: 'ASSET_IMPORTED',
        documentPath,
        workspaceId,
        assetIds: [asset.id],
        content: contentRef.current,
        source: 'luna-asset-link',
      })
      setStatus(`Attachment added: ${asset.originalName}`)
      return asset
    })
  }, [activePath, assetStorageConfig, contentRef, rootDir, setStatus])

  const importDroppedAssets = useCallback(
    async (files: File[]): Promise<AssetMeta[]> => {
      if (!rootDir || files.length === 0) return []
      const workspaceId = workspaceIdFromRoot(rootDir)
      const documentPath = activePath || `${rootDir.replace(/[/\\]+$/u, '')}/Untitled.md`
      setActiveAssetWorkspace(workspaceId, rootDir)
      const assets = await Promise.all(
        files.map((file) =>
          importAsset(file, {
            documentPath,
            workspaceRoot: rootDir,
            workspaceId,
            storageConfig: assetStorageConfig,
          }),
        ),
      )
      await dispatchDocumentCommand({
        type: 'ASSET_IMPORTED',
        documentPath,
        workspaceId,
        assetIds: assets.map((asset) => asset.id),
        content: contentRef.current,
        source: 'editor-drop',
      })
      setStatus(`Imported ${assets.length} file reference(s)`)
      return assets
    },
    [activePath, assetStorageConfig, contentRef, rootDir, setStatus],
  )

  const importDroppedAssetLinks = useCallback(
    async (files: File[]): Promise<string[]> => {
      const assets = await importDroppedAssets(files)
      return assets.map(createAssetMarkdownLink)
    },
    [importDroppedAssets],
  )

  const handleLunaAssetLinkClick = useCallback(
    (href: string, event: globalThis.MouseEvent) => {
      const assetId = parseAssetId(href)
      if (!assetId) return
      event.preventDefault()
      void (async () => {
        const asset = await getAssetMeta(assetId)
        if (!asset) {
          setStatus('File reference missing or index not rebuilt yet')
          return
        }
        if (event.metaKey || event.ctrlKey) {
          if (!rootDir) {
            setStatus('Open a workspace first')
            return
          }
          await revealAssetInFolder(asset, rootDir)
          return
        }
        previewAsset(asset)
      })().catch((error) => {
        setStatus(`Failed to open file reference: ${error instanceof Error ? error.message : String(error)}`)
      })
    },
    [rootDir, setStatus],
  )

  const getLunaAssetTooltip = useCallback(
    (href: string): string | null => {
      const assetId = parseAssetId(href)
      if (!assetId) return null
      const asset = getCachedAssetMeta(assetId)
      if (!asset) return null
      return assetTooltip(asset, {
        documentPath: activePath,
        workspaceRoot: rootDir,
        storageConfig: assetStorageConfig,
      })
    },
    [activePath, assetStorageConfig, rootDir],
  )

  return {
    pasteImageHandlerRef,
    pasteImageIntoVisualEditor,
    pickAndImportLunaAsset,
    importDroppedAssets,
    importDroppedAssetLinks,
    handleLunaAssetLinkClick,
    getLunaAssetTooltip,
  }
}
