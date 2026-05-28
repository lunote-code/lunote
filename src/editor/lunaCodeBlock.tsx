import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { mergeAttributes, type Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  caretLineInCodeBlock,
  codeBlockNodeAt,
  resolveOwnedCodeBlockPos,
  selectionInCodeBlockAt,
} from './codeBlockSelection'
import {
  codeBlockGutterLineCount,
  countCodeBlockLogicalLines,
} from './codeBlockLineMetrics'
import { LunaLowlightPlugin } from './lunaLowlightPlugin'
import { insertCodeBlockAtRange, resolveInsertCodeBlockRange } from './lunaCodeBlockToggle'

import { LunaCodeLanguagePalette } from './LunaCodeLanguagePalette'
import { LunaCodeToolbarButton } from './LunaCodeToolbarButton'
import { exitCodeBlockBackward, exitCodeBlockForward } from './lunaCodeBlockNav'
import {
  detectLanguageFromCodeSample,
  getLunaCodeLanguages,
  normalizeLanguageForLowlight,
  resolveCanonicalLanguageId,
} from './lunaCodeLanguages'

/** Internal experiment: only apply diff related DOM/CSS when it is true; the product UI does not provide a switching entry*/
const ENABLE_EXPERIMENTAL_DIFF = false
const codeBlockCopyFlashRoots = new Map<HTMLElement, () => void>()
let codeBlockCopyListenerBound = false

function handleCodeBlockCopyCapture(event: ClipboardEvent): void {
  const target = event.target as Node | null
  if (!target) return
  for (const [root, flash] of codeBlockCopyFlashRoots) {
    if (!root.contains(target)) continue
    flash()
    return
  }
}

function bindGlobalCodeBlockCopyListener(): void {
  if (codeBlockCopyListenerBound || typeof document === 'undefined') return
  document.addEventListener('copy', handleCodeBlockCopyCapture, true)
  codeBlockCopyListenerBound = true
}

function unbindGlobalCodeBlockCopyListenerIfIdle(): void {
  if (!codeBlockCopyListenerBound || codeBlockCopyFlashRoots.size > 0 || typeof document === 'undefined') return
  document.removeEventListener('copy', handleCodeBlockCopyCapture, true)
  codeBlockCopyListenerBound = false
}

/**
 * Shortcut key/menu: After toggle fence code block, if the selection falls outside the codeBlock text range, it will be included in the content area.
 * `$from.start()` / `$from.end()` is already the endpoint of the legal range of text within the block, and further `+1` is prohibited (an empty block will cross the boundary).
 */
export function toggleCodeBlockWithFocusAndLog(editor: Editor, language = 'text'): boolean {
  const { $from } = editor.state.selection

  let ok: boolean
  if ($from.parent.type.name === 'codeBlock') {
    ok = editor.chain().focus().toggleCodeBlock({ language }).run()
  } else {
    const range = resolveInsertCodeBlockRange(editor)
    ok =
      range != null
        ? insertCodeBlockAtRange(editor, range, language)
        : editor.chain().focus().toggleCodeBlock({ language }).run()
  }

  if (!ok) return false
  let s = editor.state
  const moveSelectionIntoCodeBlock = (contentStart: number) => {
    editor.chain().focus().setTextSelection(contentStart).run()
    s = editor.state
  }
  if (s.selection instanceof NodeSelection && s.selection.node.type.name === 'codeBlock') {
    moveSelectionIntoCodeBlock(s.selection.from + 1)
  } else if (s.selection.$from.parent.type.name === 'codeBlock') {
    const $fromAfter = s.selection.$from
    const contentStart = $fromAfter.start()
    const contentEnd = $fromAfter.end()
    const p = s.selection.from
    if (p < contentStart || p > contentEnd) {
      moveSelectionIntoCodeBlock(contentStart)
    }
  } else {
    const $pos = s.selection.$from
    const nodeAfter = $pos.nodeAfter
    if (nodeAfter?.type.name === 'codeBlock') {
      moveSelectionIntoCodeBlock($pos.pos + 1)
    } else {
      const nodeBefore = $pos.nodeBefore
      if (nodeBefore?.type.name === 'codeBlock') {
        const start = $pos.pos - nodeBefore.nodeSize
        moveSelectionIntoCodeBlock(start + 1)
      }
    }
  }
  return true
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.24a2 2 0 00-.59-1.41l-2.24-2.24A2 2 0 0015.76 3H10a2 2 0 00-2 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M16 4v4h4M6 8H5a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const LunaCodeBlockView = memo(function LunaCodeBlockView(props: ReactNodeViewProps) {
  const { editor, node, updateAttributes, getPos } = props
  const attrLang = String(node.attrs.language ?? '')
  const folded = Boolean(node.attrs.folded)
  const diffMode = Boolean(node.attrs.diffMode)

  const chipRef = useRef<HTMLButtonElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [hoverLine, setHoverLine] = useState<number | null>(null)
  const [caretLine, setCaretLine] = useState(1)
  const [copyFlash, setCopyFlash] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const langs = useMemo(() => getLunaCodeLanguages(), [])

  const displayLang = useMemo(() => {
    const c = resolveCanonicalLanguageId(attrLang) ?? attrLang
    const hit = langs.find((l) => l.id === c)
    return hit?.displayName ?? (attrLang.trim() ? attrLang : 'Plain text')
  }, [attrLang, langs])

  const blockDocPos = getPos?.() ?? null
  const ownedBlockPos = useMemo(
    () => resolveOwnedCodeBlockPos(editor, blockDocPos),
    [editor, blockDocPos, editor.state.doc, editor.state.selection],
  )

  const liveBlockNode = useMemo(
    () => (ownedBlockPos != null ? codeBlockNodeAt(editor, ownedBlockPos) : null) ?? node,
    [editor, ownedBlockPos, node, editor.state.doc],
  )
  const nodeLineCount = useMemo(() => countCodeBlockLogicalLines(liveBlockNode), [liveBlockNode])
  const gutterLineCount = useMemo(
    () => codeBlockGutterLineCount(nodeLineCount, caretLine),
    [nodeLineCount, caretLine],
  )
  const lineNumbers = useMemo(
    () => Array.from({ length: gutterLineCount }, (_, i) => i + 1),
    [gutterLineCount],
  )

  const syncCaretLine = useCallback(() => {
    const logical = caretLineInCodeBlock(editor, ownedBlockPos ?? blockDocPos)
    if (logical != null) setCaretLine(logical)
  }, [editor, ownedBlockPos, blockDocPos])

  useEffect(() => {
    syncCaretLine()
    const onSel = () => syncCaretLine()
    editor.on('selectionUpdate', onSel)
    return () => {
      editor.off('selectionUpdate', onSel)
    }
  }, [editor, syncCaretLine])

  useEffect(() => {
    const root = wrapRef.current
    if (!root) return
    const flash = () => {
      setCopyFlash(true)
      window.setTimeout(() => setCopyFlash(false), 200)
    }
    codeBlockCopyFlashRoots.set(root, flash)
    bindGlobalCodeBlockCopyListener()
    return () => {
      codeBlockCopyFlashRoots.delete(root)
      unbindGlobalCodeBlockCopyListenerIfIdle()
    }
  }, [])

  const relLineFromClientY = useCallback(
    (clientX: number, clientY: number) => {
      const blockPos = ownedBlockPos ?? blockDocPos
      if (blockPos == null) return null
      const coords = editor.view.posAtCoords({ left: clientX, top: clientY })
      if (!coords) return null
      const $pos = editor.state.doc.resolve(coords.pos)
      const block = codeBlockNodeAt(editor, blockPos)
      if (!block || !selectionInCodeBlockAt($pos, blockPos, block)) return null
      const contentFrom = blockPos + 1
      const offset = coords.pos - contentFrom
      if (offset < 0) return 1
      const text = editor.state.doc.textBetween(contentFrom, coords.pos, '\n', '\n')
      return Math.min(gutterLineCount, Math.max(1, text.replace(/\r\n/g, '\n').split('\n').length))
    },
    [editor, ownedBlockPos, blockDocPos, gutterLineCount],
  )

  const onSurfaceMove = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('.luna-code-toolbar')) {
        setHoverLine(null)
        return
      }
      setHoverLine(relLineFromClientY(e.clientX, e.clientY))
    },
    [relLineFromClientY],
  )
  const onSurfaceLeave = useCallback(() => setHoverLine(null), [])

  const onPreMouseDown = useCallback(
    (e: React.MouseEvent<HTMLPreElement>) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return
      const blockPos = ownedBlockPos ?? blockDocPos
      if (blockPos == null) return
      const block = codeBlockNodeAt(editor, blockPos)
      if (!block) return

      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
      if (coords) {
        const $pos = editor.state.doc.resolve(coords.pos)
        if ($pos.parent.type.name === 'codeBlock') return
      }

      e.preventDefault()
      const contentEnd = blockPos + block.nodeSize - 1
      void editor.chain().focus().setTextSelection(contentEnd).scrollIntoView().run()
    },
    [editor, ownedBlockPos, blockDocPos],
  )

  const commitLanguage = useCallback(
    (id: string) => {
      const canonical = normalizeLanguageForLowlight(id)
      const pos = resolveOwnedCodeBlockPos(editor, getPos?.())
      const mermaidType = editor.schema.nodes.mermaidBlock
      if (canonical === 'mermaid' && mermaidType && pos != null) {
        const block = codeBlockNodeAt(editor, pos)
        if (!block) return
        const text = block.textContent
        const ok = editor
          .chain()
          .focus()
          .command(({ tr }) => {
            const m = mermaidType.create({ source: text })
            tr.replaceWith(pos, pos + block.nodeSize, m)
            return true
          })
          .scrollIntoView()
          .run()
        setPaletteOpen(false)
        if (ok) return
      }
      updateAttributes({ language: canonical.length ? canonical : null })
      setPaletteOpen(false)
      const focusPos = pos != null ? pos + 1 : null
      if (focusPos != null && focusPos <= editor.state.doc.content.size) {
        void editor.chain().focus().setTextSelection(focusPos).scrollIntoView().run()
      }
    },
    [editor, getPos, node, updateAttributes],
  )

  const copyAllCode = useCallback(async () => {
    const text = node.textContent
    let ok: boolean
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch {
        ok = false
      }
    }
    if (!ok) return
    setCopyFlash(true)
    window.setTimeout(() => setCopyFlash(false), 220)
    setCopySuccess(true)
    window.setTimeout(() => setCopySuccess(false), 900)
  }, [node])

  const onCopyButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      void copyAllCode()
    },
    [copyAllCode],
  )

  const onChipKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      const pos = resolveOwnedCodeBlockPos(editor, getPos?.())
      if (pos == null) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (paletteOpen) setPaletteOpen(false)
        else exitCodeBlockForward(editor, pos)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (paletteOpen) setPaletteOpen(false)
        else exitCodeBlockBackward(editor, pos)
        return
      }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const focusPos = pos + 1
        if (focusPos <= editor.state.doc.content.size) {
          void editor.chain().focus().setTextSelection(focusPos).scrollIntoView().run()
        }
        return
      }
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        exitCodeBlockBackward(editor, pos)
      }
    },
    [editor, getPos, paletteOpen],
  )

  return (
    <NodeViewWrapper
      as="div"
      ref={wrapRef}
      className={`pm-code-block-wrap${folded ? ' pm-code-block-wrap--folded' : ''}${ENABLE_EXPERIMENTAL_DIFF && diffMode ? ' pm-code-block-wrap--diff' : ''}${copyFlash ? ' pm-code-block-wrap--copied' : ''}${paletteOpen ? ' pm-code-block-wrap--palette-open' : ''}`}
      data-luna-code-block-wrap
      data-language={attrLang}
      data-folded={folded ? 'true' : undefined}
      data-diff={ENABLE_EXPERIMENTAL_DIFF && diffMode ? 'true' : undefined}
      data-luna-code-block-from={blockDocPos != null ? String(blockDocPos) : undefined}
      spellCheck={false}
      onMouseMove={onSurfaceMove}
      onMouseLeave={onSurfaceLeave}
    >
        <LunaCodeLanguagePalette
          open={paletteOpen}
          anchorEl={chipRef.current}
          languages={langs}
          onPick={commitLanguage}
          onClose={() => setPaletteOpen(false)}
        />
        <div ref={surfaceRef} className="pm-code-block-surface">
          <div className="luna-code-toolbar" role="toolbar" aria-label="Code block toolbar">
            <LunaCodeToolbarButton
              ref={chipRef}
              variant="chip"
              className="pm-code-lang-chip"
              aria-haspopup="listbox"
              aria-expanded={paletteOpen}
              aria-label="code language"
              title={displayLang}
              onClick={() => setPaletteOpen((o) => !o)}
              onKeyDown={onChipKeyDown}
            >
              <span className="pm-code-lang-chip__label">{displayLang}</span>
              <span className="pm-code-lang-chip__chev" aria-hidden>
                <IconChevronDown className="pm-code-lang-chip__chev-svg" />
              </span>
            </LunaCodeToolbarButton>
            <LunaCodeToolbarButton
              variant="icon"
              pressed={folded}
              title={folded ? 'Expand code block' : 'Collapse to preview'}
              aria-label={folded ? 'Expand code block' : 'Collapse to preview'}
              onClick={() => updateAttributes({ folded: !folded })}
            >
              {folded ? <IconChevronDown /> : <IconChevronUp />}
            </LunaCodeToolbarButton>
            <LunaCodeToolbarButton
              variant="icon"
              preventMouseDownDefault
              className={`luna-btn--copy${copySuccess ? ' luna-btn--copy-success' : ''}`}
              title="Copy all code"
              aria-label="Copy all code"
              onClick={onCopyButtonClick}
            >
              <span className="luna-btn__copy-icons" aria-hidden>
                <span className="luna-btn__copy-icon luna-btn__copy-icon--idle">
                  <IconCopy />
                </span>
                <span className="luna-btn__copy-icon luna-btn__copy-icon--done">
                  <IconCheck />
                </span>
              </span>
            </LunaCodeToolbarButton>
          </div>
          <pre className="pm-code-block-pre" onMouseDown={onPreMouseDown}>
            <div className="pm-code-linenos" aria-hidden="true" contentEditable={false}>
              {lineNumbers.map((n) => (
                <span
                  key={n}
                  className={`pm-code-lineno${hoverLine === n ? ' pm-code-lineno--hover' : ''}${caretLine === n ? ' pm-code-lineno--caret' : ''}`}
                >
                  {n}
                </span>
              ))}
            </div>
            <NodeViewContent<'div'> as="div" className="pm-code-block-content hljs" />
          </pre>
        </div>
      </NodeViewWrapper>
  )
})

export const LunaCodeBlock = CodeBlockLowlight.extend({
  /** Disable automatic codeBlock triggered by VS Code clipboard metadata (input layer disables structure inference)*/
  addProseMirrorPlugins() {
    const parent = this.parent?.() ?? []
    const withoutDefaultLowlight = parent.filter((plugin) => {
      const key = plugin.spec.key
      return !(key instanceof PluginKey && String(key) === 'lowlight$')
    })
    const patched = withoutDefaultLowlight.map((plugin) => {
      if (!plugin.props?.handlePaste) return plugin
      return new Plugin({
        ...plugin.spec,
        props: {
          ...plugin.spec.props,
          handlePaste: () => false,
        },
      })
    })
    const lowlight = LunaLowlightPlugin({
      name: this.name,
      lowlight: this.options.lowlight,
      defaultLanguage: this.options.defaultLanguage,
    })
    const autoDetectLanguageOnPaste = new Plugin({
      props: {
        handlePaste: (view, event) => {
          const { $from } = view.state.selection
          if ($from.parent.type.name !== 'codeBlock') return false
          const nodePos = $from.before()
          const node = view.state.doc.nodeAt(nodePos)
          if (!node || node.type.name !== 'codeBlock') return false

          const currentRaw = String(node.attrs.language ?? '').trim()
          const current = resolveCanonicalLanguageId(currentRaw) ?? currentRaw.toLowerCase()
          const canAutoDetect =
            !current ||
            current === 'text' ||
            current === 'txt' ||
            current === 'plain' ||
            current === 'plaintext'
          if (!canAutoDetect) return false

          const pastedText = event.clipboardData?.getData('text/plain')?.trim() ?? ''
          if (!pastedText) return false
          const detected = detectLanguageFromCodeSample(pastedText)
          if (!detected) return false
          const canonical = normalizeLanguageForLowlight(detected)
          if (!canonical || canonical === current) return false

          view.dispatch(
            view.state.tr.setNodeMarkup(nodePos, node.type, {
              ...node.attrs,
              language: canonical,
            }),
          )
          return false
        },
      },
    })
    return [lowlight, ...patched, autoDetectLanguageOnPaste]
  },

  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      language: {
        default: this.options.defaultLanguage,
        parseHTML: (element) => {
          const el = element as HTMLElement
          const wrap = el.closest('[data-luna-code-block-wrap]') as HTMLElement | null
          const fromWrap = wrap?.getAttribute('data-language')?.trim()
          if (fromWrap) return fromWrap
          const fromData = el.getAttribute('data-language')?.trim()
          if (fromData) return fromData
          const { languageClassPrefix } = this.options
          if (!languageClassPrefix) return null
          const codeEl: HTMLElement | null =
            el.tagName === 'PRE' ? (el.firstElementChild as HTMLElement | null) : el
          const classNames: string[] = codeEl ? Array.from(codeEl.classList) : []
          const languages = classNames
            .filter((className) => className.startsWith(languageClassPrefix))
            .map((className) => className.replace(languageClassPrefix, ''))
          return languages[0] || null
        },
        rendered: false,
      },
      folded: {
        default: false,
        parseHTML: (element) => {
          const el = element as HTMLElement
          if (el.getAttribute('data-folded') === 'true') return true
          const wrap = el.closest('[data-luna-code-block-wrap]') as HTMLElement | null
          return wrap?.getAttribute('data-folded') === 'true'
        },
        renderHTML: (attrs) => ((attrs as { folded?: boolean }).folded ? { 'data-folded': 'true' } : {}),
      },
      diffMode: {
        default: false,
        parseHTML: (element) => {
          const el = element as HTMLElement
          if (el.getAttribute('data-diff') === 'true') return true
          const wrap = el.closest('[data-luna-code-block-wrap]') as HTMLElement | null
          return wrap?.getAttribute('data-diff') === 'true'
        },
        renderHTML: (attrs) => ((attrs as { diffMode?: boolean }).diffMode ? { 'data-diff': 'true' } : {}),
      },
    }
  },

  addNodeView() {
    /**
     * Use `pre > div.pm-code-block-content` in the editing area (Typora-style single-line flow),
     * Avoid `code > span` from collapsing line breaks under WebKit+CJK+IME, causing the false line number area to be unclickable/enter invalid.
     */
    return ReactNodeViewRenderer(LunaCodeBlockView, { contentDOMElementTag: 'div' })
  },

  renderHTML({ node, HTMLAttributes }) {
    const lang = (node.attrs.language as string | null | undefined) || ''
    const folded = Boolean(node.attrs.folded)
    const diffMode = Boolean(node.attrs.diffMode)
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-language': lang,
        ...(folded ? { 'data-folded': 'true' } : {}),
        ...(ENABLE_EXPERIMENTAL_DIFF && diffMode ? { 'data-diff': 'true' } : {}),
      }),
      [
        'code',
        {
          class: ['hljs', lang ? `${this.options.languageClassPrefix}${lang}` : null].filter(Boolean).join(' '),
        },
        0,
      ],
    ]
  },
})
