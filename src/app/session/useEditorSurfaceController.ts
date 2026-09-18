import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

import type { WikiLinkEditorHandlers } from '../../editor/knowledgeOS/ui/cmWikiLinkExtension'
import type { WikiLinkTarget } from '../../editor/knowledgeRuntime/types'
import {
  useEditorHasTextSelection,
  useEditorFormatToolbarActive,
  useEditorTextColor,
  useEditorSelectionStats,
} from '../hooks/useEditorTextColor'
import { useAssetHandlers, type AssetHandlersDeps } from '../hooks/useAssetHandlers'
import { useEditorNavigationReveal } from '../hooks/useEditorNavigationReveal'
import { useSourceEditorExtensions } from '../hooks/useSourceEditorExtensions'
import type { SidebarListMode } from '../workspace/sidebarPanelView'
import {
  useEditorChromeController,
  type EditorChromeControllerParams,
} from './useEditorChromeController'

type SourceExtensionsDeps = {
  isLargeDoc: boolean
  sidebarListMode: SidebarListMode
  outlineSpyCtxRef: MutableRefObject<{ sidebarListMode: SidebarListMode }>
  setActiveOutlineIdRef: MutableRefObject<(id: string) => void>
  setActiveOutlineId: Dispatch<SetStateAction<string>>
  wikiHandlersRef: MutableRefObject<WikiLinkEditorHandlers | null>
  wikiTargetResolverRef: MutableRefObject<((pos: number) => WikiLinkTarget | null) | null>
  editorViewRef: EditorChromeControllerParams['refs']['editorViewRef']
}

type NavigationRevealDeps = {
  mainPaneMode: 'visual' | 'source'
  activePathRef: EditorChromeControllerParams['refs']['activePathRef']
  contentRef: EditorChromeControllerParams['refs']['contentRef']
  mainPaneModeRef: EditorChromeControllerParams['refs']['mainPaneModeRef']
  visualEditorRef: EditorChromeControllerParams['refs']['visualEditorRef']
  editorViewRef: EditorChromeControllerParams['refs']['editorViewRef']
}

export type EditorSurfaceControllerParams = {
  bumpVisualSelectionRef: MutableRefObject<(() => void) | null>
  assetDeps: AssetHandlersDeps
  chromeParams: Omit<EditorChromeControllerParams, 'pasteImageIntoVisualEditor'>
  sourceExtensionsDeps: SourceExtensionsDeps
  navigationRevealDeps: NavigationRevealDeps
}

/** Asset handlers, editor chrome, source extensions, navigation reveal, and format toolbar state. */
export function useEditorSurfaceController(params: EditorSurfaceControllerParams) {
  const { bumpVisualSelectionRef, assetDeps, chromeParams, sourceExtensionsDeps, navigationRevealDeps } = params

  const assets = useAssetHandlers(assetDeps)

  const chrome = useEditorChromeController({
    ...chromeParams,
    pasteImageIntoVisualEditor: assets.pasteImageIntoVisualEditor,
  })

  const { editorExtensions } = useSourceEditorExtensions({
    ...sourceExtensionsDeps,
    pasteImageHandlerRef: assets.pasteImageHandlerRef,
    onSourceSelectionActivity: () => bumpVisualSelectionRef.current?.(),
  })

  const navigationReveal = useEditorNavigationReveal(navigationRevealDeps)

  const [visualSelectionTick, setVisualSelectionTick] = useState(0)
  const bumpVisualSelection = useCallback(() => {
    setVisualSelectionTick((tick) => tick + 1)
  }, [])
  bumpVisualSelectionRef.current = bumpVisualSelection

  const editorTextColorDeps = useMemo(
    () => ({
      mainPaneMode: chromeParams.mainPaneMode,
      visualEditorRef: chromeParams.refs.visualEditorRef,
      editorViewRef: chromeParams.refs.editorViewRef,
      visualSelectionTick,
    }),
    [chromeParams.mainPaneMode, chromeParams.refs.editorViewRef, chromeParams.refs.visualEditorRef, visualSelectionTick],
  )
  const editorHasTextSelection = useEditorHasTextSelection(editorTextColorDeps)
  const selectionStats = useEditorSelectionStats(editorTextColorDeps)
  const isFormatCommandActive = useEditorFormatToolbarActive(editorTextColorDeps)
  const { applyEditorTextColor } = useEditorTextColor(editorTextColorDeps)

  return {
    ...assets,
    ...chrome,
    editorExtensions,
    ...navigationReveal,
    editorHasTextSelection,
    selectionStats,
    isFormatCommandActive,
    applyEditorTextColor,
    bumpVisualSelection,
    visualSelectionTick,
  }
}
