import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import type { Editor } from '@tiptap/core'

import { validateBlockAiRevealState } from '../../editor/ai/editorBlockAi'
import { readTiptapEditorView } from '../../editor/readTiptapEditorView'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'

export function useEditorBlockAiHandleReveal(
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>,
  shellRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  handleRootRef: RefObject<HTMLElement | null>,
  selectionTick: number,
  onUnsupportedBlockClick?: () => void,
): {
  revealed: boolean
  menuOpen: boolean
  setMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  dismiss: () => void
} {
  const [revealed, setRevealed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pointerPickRef = useRef(false)
  const revealedRef = useRef(false)
  const boundEditorRef = useRef<Editor | null>(null)
  const requestRebindRef = useRef<(() => void) | null>(null)

  const dismiss = useCallback(() => {
    setRevealed(false)
    setMenuOpen(false)
    pointerPickRef.current = false
  }, [])

  useEffect(() => {
    revealedRef.current = revealed
  }, [revealed])

  useEffect(() => {
    if (!enabled) {
      dismiss()
    }
  }, [dismiss, enabled])

  useEffect(() => {
    if (!enabled) return

    let disposed = false
    let unbind: (() => void) | null = null

    const teardownBinding = () => {
      unbind?.()
      unbind = null
      boundEditorRef.current = null
    }

    const bindWhenReady = () => {
      if (disposed) return

      const editor = visualEditorRef.current?.getEditor()
      const shell = shellRef.current
      const view = readTiptapEditorView(editor)
      const editorDom = view?.dom
      if (!editor || !view || !editorDom || !shell) {
        window.requestAnimationFrame(bindWhenReady)
        return
      }

      if (boundEditorRef.current && boundEditorRef.current !== editor) {
        teardownBinding()
      }
      if (unbind) return

      const isEditorPointerTarget = (target: EventTarget | null): target is Node => {
        if (!(target instanceof Node)) return false
        if (handleRootRef.current?.contains(target)) return false
        if (!editorDom.contains(target)) return false
        if ((target as HTMLElement).closest?.('.editor-ai-selection-toolbar, .luna-code-toolbar')) return false
        return true
      }

      const isOutsideDismissTarget = (target: EventTarget | null): boolean => {
        if (!(target instanceof Node)) return false
        if (handleRootRef.current?.contains(target)) return false
        if (shell.contains(target)) return false
        return true
      }

      const applyRevealValidation = (phase: 'pointer' | 'selection' | 'revealed') => {
        const validation = validateBlockAiRevealState(editor)
        if (validation.kind === 'valid') {
          if (phase !== 'revealed') {
            pointerPickRef.current = false
            setRevealed(true)
            setMenuOpen(false)
          }
          return
        }

        if (validation.kind === 'unsupported') {
          if (phase === 'pointer' && !validation.silent) {
            onUnsupportedBlockClick?.()
          }
          if (phase === 'revealed') {
            pointerPickRef.current = false
            dismiss()
            return
          }
          // Transient unsupported (e.g. selection not anchored yet after document open): retry on pointerup.
          if (validation.silent || phase === 'pointer') {
            pointerPickRef.current = false
          }
          return
        }

        pointerPickRef.current = false
        if (phase === 'selection' || phase === 'revealed' || validation.kind === 'dismiss') {
          dismiss()
        }
      }

      const attemptReveal = (phase: 'pointer' | 'selection') => {
        if (!pointerPickRef.current || editor.isDestroyed) return
        applyRevealValidation(phase)
      }

      const validateRevealed = () => {
        if (!revealedRef.current || editor.isDestroyed) return
        applyRevealValidation('revealed')
      }

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return
        if (!isEditorPointerTarget(event.target)) return
        pointerPickRef.current = true
      }

      const onPointerUp = (event: PointerEvent) => {
        if (event.button !== 0) return
        if (!pointerPickRef.current) return
        if (!isEditorPointerTarget(event.target)) return
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            attemptReveal('pointer')
          })
        })
      }

      const onSelectionUpdate = () => {
        if (revealedRef.current) {
          validateRevealed()
          return
        }
        attemptReveal('selection')
      }

      const onDocumentPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return
        if (!revealedRef.current) return
        if (!isOutsideDismissTarget(event.target)) return
        dismiss()
      }

      editorDom.addEventListener('pointerdown', onPointerDown, true)
      editorDom.addEventListener('pointerup', onPointerUp, true)
      editor.on('selectionUpdate', onSelectionUpdate)
      document.addEventListener('pointerdown', onDocumentPointerDown, true)

      boundEditorRef.current = editor
      unbind = () => {
        editorDom.removeEventListener('pointerdown', onPointerDown, true)
        editorDom.removeEventListener('pointerup', onPointerUp, true)
        document.removeEventListener('pointerdown', onDocumentPointerDown, true)
        if (!editor.isDestroyed) {
          editor.off('selectionUpdate', onSelectionUpdate)
        }
        if (boundEditorRef.current === editor) {
          boundEditorRef.current = null
        }
      }
    }

    requestRebindRef.current = () => {
      if (disposed) return
      teardownBinding()
      bindWhenReady()
    }

    bindWhenReady()

    return () => {
      disposed = true
      requestRebindRef.current = null
      teardownBinding()
    }
  }, [dismiss, enabled, handleRootRef, onUnsupportedBlockClick, shellRef, visualEditorRef])

  useEffect(() => {
    if (!enabled) return
    const editor = visualEditorRef.current?.getEditor()
    if (!editor || editor.isDestroyed) return
    if (boundEditorRef.current === editor) return
    requestRebindRef.current?.()
  }, [enabled, selectionTick, visualEditorRef])

  useEffect(() => {
    if (!enabled || !revealedRef.current) return
    const editor = visualEditorRef.current?.getEditor()
    if (!editor || editor.isDestroyed) return
    const validation = validateBlockAiRevealState(editor)
    if (validation.kind !== 'valid') {
      dismiss()
    }
  }, [dismiss, enabled, selectionTick, visualEditorRef])

  return { revealed, menuOpen, setMenuOpen, dismiss }
}
