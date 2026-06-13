import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { createModeSwitchEditorState } from '../../createModeSwitchEditorState'
import {
  activateNativeInput,
  deactivateNativeInput,
  mountNativeInput,
  unmountNativeInput,
} from '../../documentRuntime/nativeInput'
import { debugCodeBlockCmFocus, describeDomTarget } from './codeBlockCmFocusDebug'
import { patchCodeBlockCmDocFromPm, scheduleCodeBlockCmDocPatch } from './codeBlockCmDefer'
import {
  codeBlockCmLanguageCompartment,
  createCodeBlockCmBaseExtensions,
  loadCodeBlockCmLanguageExtension,
} from './codeBlockCmExtensions'

type CmRootHost = HTMLElement & { __lunaCmView?: EditorView }

export type CodeBlockCmPaneProps = {
  mountKey: string
  blockId: string | null
  doc: string
  languageId: string | null | undefined
  tabSize?: number
  className?: string
  onChange: (value: string) => void
  onBlur?: (relatedTarget: EventTarget | null) => void
  onBoundaryUp?: () => boolean
  onBoundaryDown?: () => boolean
  onDeleteEmptyBlock?: () => boolean
  onUndo?: () => boolean
  onRedo?: () => boolean
  onViewReady?: (view: EditorView) => void
}

export function CodeBlockCmPane({
  mountKey,
  blockId,
  doc,
  languageId,
  tabSize = 4,
  className,
  onChange,
  onBlur,
  onBoundaryUp,
  onBoundaryDown,
  onDeleteEmptyBlock,
  onUndo,
  onRedo,
  onViewReady,
}: CodeBlockCmPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onBlurRef = useRef(onBlur)
  onBlurRef.current = onBlur
  const onBoundaryUpRef = useRef(onBoundaryUp)
  onBoundaryUpRef.current = onBoundaryUp
  const onBoundaryDownRef = useRef(onBoundaryDown)
  onBoundaryDownRef.current = onBoundaryDown
  const onViewReadyRef = useRef(onViewReady)
  onViewReadyRef.current = onViewReady
  const blockIdRef = useRef(blockId)
  blockIdRef.current = blockId
  const onDeleteEmptyBlockRef = useRef(onDeleteEmptyBlock)
  onDeleteEmptyBlockRef.current = onDeleteEmptyBlock
  const onUndoRef = useRef(onUndo)
  onUndoRef.current = onUndo
  const onRedoRef = useRef(onRedo)
  onRedoRef.current = onRedo
  const suppressEmitRef = useRef(false)
  const nativeInputIdRef = useRef<string | null>(null)

  const buildExtensions = useCallback((): Extension[] => {
    return createCodeBlockCmBaseExtensions({
      languageId: null,
      tabSize,
      onDocChange: (value) => {
        if (suppressEmitRef.current) return
        onChangeRef.current(value)
      },
      onFocus: () => {
        const id = nativeInputIdRef.current
        if (id) activateNativeInput(id)
        debugCodeBlockCmFocus('cm-onFocus', {
          nativeInputId: id,
          blockId,
          activeElement: describeDomTarget(document.activeElement),
        })
      },
      onBlur: (relatedTarget) => {
        const id = nativeInputIdRef.current
        if (id) deactivateNativeInput(id)
        debugCodeBlockCmFocus('cm-onBlur', {
          nativeInputId: id,
          blockId,
          activeElement: describeDomTarget(document.activeElement),
          relatedTarget: describeDomTarget(relatedTarget),
        })
        onBlurRef.current?.(relatedTarget)
      },
      onBoundaryUp: () => onBoundaryUpRef.current?.() ?? false,
      onBoundaryDown: () => onBoundaryDownRef.current?.() ?? false,
      onDeleteEmptyBlock: () => onDeleteEmptyBlockRef.current?.() ?? false,
      onUndo: () => onUndoRef.current?.() ?? false,
      onRedo: () => onRedoRef.current?.() ?? false,
    })
  }, [tabSize])

  const buildExtensionsRef = useRef(buildExtensions)
  buildExtensionsRef.current = buildExtensions

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    root.replaceChildren()
    const state = createModeSwitchEditorState({
      doc,
      extensions: buildExtensionsRef.current(),
    })
    const view = new EditorView({ state, parent: root })
    viewRef.current = view
    ;(root as CmRootHost).__lunaCmView = view
    root.dataset.nativeInputHost = 'code-block'
    const inputId = mountNativeInput({
      type: 'codemirror',
      dom: root,
      blockId: blockIdRef.current,
    })
    nativeInputIdRef.current = inputId
    debugCodeBlockCmFocus('cm-mount', { mountKey, blockId, nativeInputId: inputId })
    onViewReadyRef.current?.(view)

    let cancelled = false
    void loadCodeBlockCmLanguageExtension(languageId).then((langExts) => {
      if (cancelled || viewRef.current !== view) return
      view.dispatch({
        effects: codeBlockCmLanguageCompartment.reconfigure(langExts),
      })
    })

    return () => {
      cancelled = true
      debugCodeBlockCmFocus('cm-unmount', {
      mountKey,
      blockId,
      nativeInputId: nativeInputIdRef.current,
      foldedMountKey: mountKey.endsWith(':1'),
      activeElement: describeDomTarget(document.activeElement),
    })
      const id = nativeInputIdRef.current
      if (id) unmountNativeInput(id)
      nativeInputIdRef.current = null
      delete root.dataset.nativeInputHost
      view.destroy()
      viewRef.current = null
      delete (root as CmRootHost).__lunaCmView
    }
  }, [mountKey])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.compositionStarted) return
    // While CM owns focus, sessionDoc lags one React frame behind CM edits (paste/typing).
    // Patching from stale props here reverts the first keystroke/paste ("flash then gone").
    if (view.hasFocus) return
    if (view.state.doc.toString() === doc) return
    return scheduleCodeBlockCmDocPatch(view, doc, (activeView, nextDoc) => {
      suppressEmitRef.current = true
      patchCodeBlockCmDocFromPm(activeView, nextDoc)
      // Keep suppression through the deferred CM doc-change flush (next microtask).
      queueMicrotask(() => {
        queueMicrotask(() => {
          suppressEmitRef.current = false
        })
      })
    })
  }, [doc])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    void loadCodeBlockCmLanguageExtension(languageId).then((langExts) => {
      if (viewRef.current !== view) return
      view.dispatch({
        effects: codeBlockCmLanguageCompartment.reconfigure(langExts),
      })
    })
  }, [languageId])

  return (
    <div
      className={['pm-code-block-cm', className].filter(Boolean).join(' ')}
      data-code-block-cm=""
      data-code-block-input=""
      data-native-input-host="code-block"
    >
      <div ref={rootRef} className="pm-code-block-cm-root" />
    </div>
  )
}
