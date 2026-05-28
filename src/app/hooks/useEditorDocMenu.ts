import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { applySourceTextColor } from '../../editor/markdownInsertHelpers'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { pasteFromNavigatorClipboard } from '../../editor/pasteFromNavigatorClipboard'
import { bridgeDeleteSelection } from '../../editor/editorMutationBridge'
import { executeManifestCommand } from '../../menu'
import type { AppMenuContext, AppMenuUiDeps } from '../../menu'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import type { EditorView } from '@codemirror/view'
import type { EditorDocMenuPick, EditorDocMenuState } from '../workspace/contextMenuTypes'
import { isBufferTabId } from '../workspace/constants'
import { revealInExplorer } from '../../platform/tauri/platformShellService'

export type EditorDocMenuDeps = {
  t: TranslateFn
  rootDir: string
  activePath: string
  mainPaneMode: 'visual' | 'source'
  mainPaneModeRef: MutableRefObject<'visual' | 'source'>
  visualEditorRef: MutableRefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: MutableRefObject<EditorView | null>
  appMenuCtxRef: MutableRefObject<AppMenuContext>
  paletteUiDepsRef: MutableRefObject<AppMenuUiDeps>
  setEditorDocMenu: Dispatch<SetStateAction<EditorDocMenuState | null>>
  setStatus: (msg: string) => void
  pasteImageIntoVisualEditor: (file: File, mimeHint: string) => Promise<string | null>
  pastePlainFromClipboard: (plainOnly?: boolean) => Promise<void>
  saveCurrent: (manual?: boolean) => Promise<void>
  openRenameDialog: (root: string, oldPath: string, isDirectory: boolean) => void
  dispatchOpenDocumentInTab: (root: string, path: string) => Promise<void>
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  confirmAppDialog: (options: {
    title: string
    message: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
}

export function useEditorDocMenu(deps: EditorDocMenuDeps) {
  const {
    t,
    rootDir,
    activePath,
    mainPaneMode,
    mainPaneModeRef,
    visualEditorRef,
    editorViewRef,
    appMenuCtxRef,
    paletteUiDepsRef,
    setEditorDocMenu,
    setStatus,
    pasteImageIntoVisualEditor,
    saveCurrent,
    openRenameDialog,
    dispatchOpenDocumentInTab,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    confirmAppDialog,
  } = deps

  const editorDiskFileReady = Boolean(rootDir && activePath && !isBufferTabId(activePath))
  const editorCanRevealInOs = isTauri() && editorDiskFileReady

  const handleEditorTextColorPick = useCallback(
    (color: string | null) => {
      setEditorDocMenu(null)
      if (mainPaneMode === 'visual') {
        visualEditorRef.current?.runCommand({ type: 'setTextColor', color })
        requestAnimationFrame(() => visualEditorRef.current?.focus())
        return
      }
      const v = editorViewRef.current
      if (!v) return
      if (!applySourceTextColor(v, color)) return
      requestAnimationFrame(() => editorViewRef.current?.focus())
    },
    [editorViewRef, mainPaneMode, setEditorDocMenu, visualEditorRef],
  )

  const handleEditorDocMenuPick = useCallback(
    (action: EditorDocMenuPick) => {
      setEditorDocMenu(null)
      const mRoot = rootDir
      const mPath = activePath
      void (async () => {
        try {
          switch (action) {
            case 'cut': {
              if (mainPaneMode === 'visual') {
                const cutText = visualEditorRef.current?.getSelectedText() ?? ''
                if (!cutText) return
                await navigator.clipboard.writeText(cutText)
                bridgeDeleteSelection()
                requestAnimationFrame(() => visualEditorRef.current?.focus())
              } else {
                const v = editorViewRef.current
                if (!v) return
                const { from, to } = v.state.selection.main
                if (from === to) return
                const cutText = v.state.sliceDoc(from, to)
                await navigator.clipboard.writeText(cutText)
                bridgeDeleteSelection()
                requestAnimationFrame(() => editorViewRef.current?.focus())
              }
              return
            }
            case 'copy': {
              if (mainPaneMode === 'visual') {
                const text = visualEditorRef.current?.getSelectedText() ?? ''
                if (!text) return
                await navigator.clipboard.writeText(text)
                return
              }
              const v = editorViewRef.current
              if (!v) return
              const { from, to } = v.state.selection.main
              if (from === to) return
              await navigator.clipboard.writeText(v.state.sliceDoc(from, to))
              return
            }
            case 'paste': {
              try {
                const ok = await pasteFromNavigatorClipboard({
                  onPasteImage: pasteImageIntoVisualEditor,
                  visualEditorRef,
                  sourceViewRef: editorViewRef,
                  mainPaneMode: mainPaneModeRef.current,
                })
                if (!ok) setStatus(t('app.status.clipboardReadFailed'))
              } catch {
                setStatus(t('app.status.clipboardReadFailed'))
              }
              return
            }
            case 'selectAll':
              void executeManifestCommand(
                'edit-select-all',
                appMenuCtxRef.current!,
                paletteUiDepsRef.current!,
              )
              return
            case 'openTab':
              if (!mRoot || !mPath) return
              await dispatchOpenDocumentInTab(mRoot, mPath)
              return
            case 'save':
              await saveCurrent(true)
              return
            case 'rename': {
              if (!mRoot || !mPath) {
                setStatus(t('app.status.noRenameTarget'))
                return
              }
              openRenameDialog(mRoot, mPath, false)
              return
            }
            case 'revert': {
              if (!mRoot || !mPath) {
                setStatus(t('app.status.noRevertTarget'))
                return
              }
              if (isBufferTabId(mPath)) {
                setStatus(t('app.status.bufferNoDiskVersion'))
                return
              }
              const ok = await confirmAppDialog({
                title: t('app.confirm.title'),
                message: t('app.confirm.revertFile'),
                variant: 'warning',
              })
              if (!ok) return
              resetModeSwitchEditorBootstrap()
              bumpColdOpenGeneration()
              await dispatchDocumentCommand({
                type: 'REVERT_DOCUMENT',
                root: mRoot,
                path: mPath,
                source: 'editor-menu-revert',
              })
              setStatus(t('app.menu.revertedFromDisk'))
              return
            }
            case 'copyPath':
              if (!mPath) {
                setStatus(t('app.menu.noPathToCopy'))
                return
              }
              await navigator.clipboard.writeText(mPath)
              setStatus(t('app.menu.pathCopied'))
              return
            case 'reveal':
              if (!isTauri()) {
                setStatus(t('app.status.revealDesktopOnly'))
                return
              }
              if (!mPath) {
                setStatus(t('app.menu.noSavedFileToReveal'))
                return
              }
              await revealInExplorer(mPath, rootDir || '')
              return
            default:
              return
          }
        } catch (e) {
          setStatus(
            t('app.status.operationFailed', {
              message: e instanceof Error ? e.message : String(e),
            }),
          )
        }
      })()
    },
    [
      activePath,
      appMenuCtxRef,
      bumpColdOpenGeneration,
      confirmAppDialog,
      dispatchOpenDocumentInTab,
      editorViewRef,
      mainPaneMode,
      mainPaneModeRef,
      openRenameDialog,
      paletteUiDepsRef,
      pasteImageIntoVisualEditor,
      resetModeSwitchEditorBootstrap,
      rootDir,
      saveCurrent,
      setEditorDocMenu,
      setStatus,
      t,
      visualEditorRef,
    ],
  )

  return { editorDiskFileReady, editorCanRevealInOs, handleEditorTextColorPick, handleEditorDocMenuPick }
}
