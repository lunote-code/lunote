import { useCallback, useEffect, useRef, useState } from 'react'

import { bridgeReplaceSelection } from '../editor/editorMutationBridge'
import { pasteFromNavigatorClipboard } from '../editor/pasteFromNavigatorClipboard'

declare global {
  interface Window {
    __QA_NATIVE_INPUT_CLIPBOARD__?: {
      getRenameValue: () => string
      getPaletteValue: () => string
      getEditorBody: () => string
      openRenameDialog: () => void
      openPalette: () => void
      simulateMenuPaste: () => Promise<boolean>
      simulateMenuPasteIntoEditor: () => Promise<boolean>
      focusRenameInput: () => void
      focusPaletteInput: () => void
      blurInputs: () => void
    }
  }
}

export function QaNativeInputClipboardPlayground() {
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const paletteInputRef = useRef<HTMLInputElement | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('note-old-name.md')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteValue, setPaletteValue] = useState('')
  const [editorBody, setEditorBody] = useState('Editor body seed')

  const simulateMenuPaste = useCallback(async () => {
    return pasteFromNavigatorClipboard({
      plainOnly: true,
      mainPaneMode: 'visual',
      visualEditorRef: { current: null },
    })
  }, [])

  const simulateMenuPasteIntoEditor = useCallback(async () => {
    const text = await navigator.clipboard.readText().catch(() => '')
    if (!text) return false
    bridgeReplaceSelection(text)
    setEditorBody((prev) => `${prev}${text}`)
    return true
  }, [])

  useEffect(() => {
    window.__QA_NATIVE_INPUT_CLIPBOARD__ = {
      getRenameValue: () => renameValue,
      getPaletteValue: () => paletteValue,
      getEditorBody: () => editorBody,
      openRenameDialog: () => {
        setRenameOpen(true)
        requestAnimationFrame(() => renameInputRef.current?.focus())
      },
      openPalette: () => {
        setPaletteOpen(true)
        requestAnimationFrame(() => paletteInputRef.current?.focus())
      },
      simulateMenuPaste,
      simulateMenuPasteIntoEditor,
      focusRenameInput: () => renameInputRef.current?.focus(),
      focusPaletteInput: () => paletteInputRef.current?.focus(),
      blurInputs: () => {
        renameInputRef.current?.blur()
        paletteInputRef.current?.blur()
      },
    }
    return () => {
      delete window.__QA_NATIVE_INPUT_CLIPBOARD__
    }
  }, [editorBody, paletteValue, renameValue, simulateMenuPaste, simulateMenuPasteIntoEditor])

  return (
    <div className="qa-native-input-clipboard" data-testid="qa-ready">
      <h1>Native input clipboard QA</h1>
      <p data-testid="qa-status">ready</p>
      <p data-testid="qa-editor-body">{editorBody}</p>

      <button type="button" data-testid="open-rename" onClick={() => setRenameOpen(true)}>
        Open rename dialog
      </button>
      <button type="button" data-testid="open-palette" onClick={() => setPaletteOpen(true)}>
        Open palette input
      </button>

      {renameOpen ? (
        <div className="about-modal rename-modal" role="dialog" data-testid="rename-dialog">
          <label className="rename-modal-field">
            <input
              ref={renameInputRef}
              className="rename-modal-input"
              data-testid="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {paletteOpen ? (
        <div className="command-palette" data-testid="palette-dialog">
          <input
            ref={paletteInputRef}
            className="command-palette-input"
            data-testid="palette-input"
            value={paletteValue}
            onChange={(e) => setPaletteValue(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  )
}
