import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useMemo, useState } from 'react'

import '../App.css'
import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleRawSnapshot, getLocaleMessagesSnapshot } from '../i18n/localeRegistry'
import { selectAllInCurrentBlock } from '../editor/lunaBlockSelectAll'
import { LunaCodeBlock } from '../editor/lunaCodeBlock'
import { _setEditorMutationBridgeForTest } from '../editor/editorMutationBridge'
import {
  redoLastTransaction,
  setActiveTransactionDoc,
  undoLastTransaction,
} from '../menu/commandTransaction'
import { flushVmTiptapRecorderBatch, VmTiptapRecorder } from '../vm/vmTiptapRecorder'
import { proseMirrorLowlight } from '../editor/proseMirrorLowlight'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import { flushAllCodeBlockSessions } from '../editor/codeBlock/boundary/codeBlockSessionRegistry'
import { requestCodeBlockCmEdit } from '../editor/codeBlock/boundary/codeBlockBoundaryActions'
import { resolveCodeBlockInputPolicy } from '../editor/codeBlock/boundary'
import { isCodeBlockCmEnabled } from '../editor/codeBlock/cm/codeBlockCmFeature'
import {
  isPmDomSuspendedForCodeBlockCm,
  isPmLockedForCodeBlockCm,
} from '../editor/codeBlock/cm/codeBlockCmPmFocusLock'
import { reconcileCodeBlockCmFocusAfterSerialize } from '../editor/codeBlock/cm/codeBlockCmPmFocusReconcile'
import {
  deleteInActiveCodeBlockCm,
  getFocusedCodeBlockCmView,
  getCodeBlockCmViewInWrap,
  isCodeBlockCmFocused,
} from '../editor/codeBlock/cm/codeBlockCmFocus'
import { buildCodeBlockLineModel } from '../editor/codeBlock/model/lineModel'
import { toggleCodeBlockWithFocusAndLog } from '../editor/codeBlock/behavior/toggleWithFocus'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'

declare global {
  interface Window {
    __QA_CODEBLOCK_CM__?: {
      cmEnabled: boolean
      cmMounted: () => boolean
      cmGutterLineCount: () => number
      cmContentLineCount: () => number
      pmLineCount: () => number | null
      pmText: () => string | null
      cmText: () => string | null
      pmInsertSuffix: (suffix: string) => boolean
      /** Invoke PM-layer Backspace shortcut (bypasses CM target keymap). */
      triggerPmBackspaceShortcut: () => boolean
      /** Exercise fenceGuard delete routing while CM is focused. */
      probeDeleteInActiveCodeBlockCm: () => {
        cmFocused: boolean
        hadSelection: boolean
        deleted: boolean
      }
      /** Registry / menu command path for Mod+a (skips CM target keymap). */
      runEditSelectAllCommand: () => boolean
      runEditUndoCommand: () => boolean
      runEditRedoCommand: () => boolean
      isCmFocused: () => boolean
      readSelectionDiagnostics: () => {
        cmFocused: boolean
        cmFrom: number
        cmTo: number
        cmDocLen: number
        cmSpansFullDoc: boolean
        pmFrom: number
        pmTo: number
        pmEmpty: boolean
        pmSelectsParagraphAbove: boolean
        selectionBgCount: number
      }
      probeSyntaxHighlight: () => {
        wrapLanguage: string | null
        toolbarLabel: string | null
        visibleHljsCount: number
        mirrorHljsCount: number
        mirrorHasHljsRoot: boolean
        lineSpanCount: number
        coloredSpanCount: number
        highlightClassSpanCount: number
      }
      probeCodeBlockDesignTokens: () => {
        themeMode: string | null
        themePreset: string | null
        codeBgToken: string
        codeBlockFontSizeToken: string
        surfaceBackground: string
        gutterBackground: string
        cmFontSize: string
        chipColor: string
        chipBackground: string
      }
      setQaThemeMode: (mode: 'light' | 'dark') => void
      probeCodeBlockScrollbar: () => {
        scrollbarWidth: string
        codeBlockScrollbarSizeToken: string
        standardScrollbarSizeToken: string
        scrollWidth: number
        clientWidth: number
        overflowsHorizontally: boolean
      } | null
      probeCaretDiagnostics: () => {
        cmFocusedClass: boolean
        staleCmFocusedChrome: boolean
        cmHasFocus: boolean
        cmCursorCount: number
        cmCursorVisibility: string | null
        cmCursorInScrollerView: boolean | null
        cmContentCaretColor: string
        pmCaretColor: string
        pmCaretTransparent: boolean
        pmContentEditable: boolean
        pmHasFocus: boolean
        scrollerScrollLeft: number
        activeInCm: boolean
        codeBlockInView: boolean
        pmDomSuspended: boolean
        pmSoftLocked: boolean
        activeElementSummary: string
        pmSelectionEmpty: boolean
        pmSelectionOutsideCodeBlock: boolean
      }
      scrollUntilCodeBlockOffScreen: (direction: 'up' | 'down') => boolean
      scrollCodeBlockCmHorizontally: (toEnd: boolean) => boolean
      /** Mirrors save-path CM flush + PM focus reconcile. */
      simulateMarkdownSerializeFlush: () => boolean
      /** Flush CM→PM without reconcile (reproduces stale `.cm-focused` chrome). */
      simulateStaleCmFocusedAfterFlush: () => boolean
      scrollEditorPageVertically: (deltaY: number) => boolean
      blurActiveElement: () => void
      countCodeBlocks: () => number
      probeBlockCaret: (blockIndex: number) => QaCodeBlockCaretProbe
      scrollBlockOffScreen: (blockIndex: number) => boolean
      getActiveCodeBlockIndex: () => number | null
      /** Place PM caret at end of the paragraph immediately before code block N. */
      focusPmEndBeforeCodeBlock: (blockIndex: number) => boolean
      toggleCodeBlockWithFocus: () => boolean
      focusCodeBlockAtIndex: (blockIndex: number) => boolean
      focusQaParagraph: (label: 'above' | 'below') => boolean
    }
  }
}

const SAMPLE = ['const hello = 1', 'function add(a: number, b: number) {', '  return a + b', '}', '暗示的款'].join(
  '\n',
)

const SAMPLE_B = ['// second block', 'export const beta = 2', 'console.log(beta)'].join('\n')

const COMPACT_SAMPLE_A = ['line one', 'line two', 'line three'].join('\n')
const COMPACT_SAMPLE_B = ['second one', 'second two', 'second three'].join('\n')

const SCROLL_FILLER_BEFORE = Array.from({ length: 18 }, (_, i) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text: `Lead filler ${i + 1}. `.repeat(6) }],
}))

const SCROLL_FILLER = Array.from({ length: 24 }, (_, i) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text: `Scroll filler line ${i + 1}. `.repeat(6) }],
}))

const SCROLL_FILLER_BETWEEN = Array.from({ length: 10 }, (_, i) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text: `Between blocks filler ${i + 1}. `.repeat(6) }],
}))

function resolveCodeBlockWrap(index: number): HTMLElement | null {
  const wraps = document.querySelectorAll('[data-luna-code-block-wrap]')
  const wrap = wraps.item(index)
  return wrap instanceof HTMLElement ? wrap : null
}

function resolveScrollHost(): HTMLElement | null {
  return (
    (document.querySelector('[data-testid="qa-editor-scroll-host"]') as HTMLElement | null) ??
    (document.querySelector('.preview-pane.markdown-visual-editor') as HTMLElement | null)
  )
}

export type QaCodeBlockCaretProbe = {
  blockIndex: number
  cmFocusedClass: boolean
  staleCmFocusedChrome: boolean
  cmHasFocus: boolean
  cmCursorCount: number
  cmCursorVisibility: string | null
  cmContentCaretColor: string
  activeInBlock: boolean
  blockInView: boolean
  activeElementSummary: string
}

function probeCodeBlockWrapCaret(blockIndex: number): QaCodeBlockCaretProbe {
  const wrap = resolveCodeBlockWrap(blockIndex)
  const cmEditor = wrap?.querySelector('.pm-code-block-cm .cm-editor') as HTMLElement | null
  const cmCursor = wrap?.querySelector('.pm-code-block-cm .cm-cursor') as HTMLElement | null
  const cmContent = wrap?.querySelector('.pm-code-block-cm .cm-content') as HTMLElement | null
  const scrollHost = resolveScrollHost()
  const hostRect = scrollHost?.getBoundingClientRect()
  const wrapRect = wrap?.getBoundingClientRect()
  const active = document.activeElement
  const cmView = getCodeBlockCmViewInWrap(wrap)
  const activeInBlock =
    Boolean(active instanceof HTMLElement && wrap?.contains(active)) || Boolean(cmView?.hasFocus)
  return {
    blockIndex,
    cmFocusedClass: cmEditor?.classList.contains('cm-focused') ?? false,
    staleCmFocusedChrome: Boolean(
      wrap?.querySelector('.pm-code-block-cm .cm-editor.cm-focused:not(:focus-within)'),
    ),
    cmHasFocus: activeInBlock,
    cmCursorCount: wrap?.querySelectorAll('.pm-code-block-cm .cm-cursor').length ?? 0,
    cmCursorVisibility: cmCursor ? getComputedStyle(cmCursor).visibility : null,
    cmContentCaretColor: cmContent ? getComputedStyle(cmContent).caretColor : '',
    activeInBlock,
    blockInView:
      Boolean(hostRect && wrapRect) &&
      wrapRect!.bottom > hostRect!.top &&
      wrapRect!.top < hostRect!.bottom,
    activeElementSummary:
      active instanceof HTMLElement
        ? `${active.tagName.toLowerCase()}${active.className ? `.${active.className.split(/\s+/).slice(0, 2).join('.')}` : ''}`
        : String(active?.nodeName ?? 'none'),
  }
}

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const QA_APP_SETTINGS = { ...DEFAULT_APP_SETTINGS, language: 'en' as const }
const QA_TRANSACTION_DOC_ID = 'qa:codeblock-cm'
markAppSettingsHydratedForTests(QA_APP_SETTINGS)

function readBlock(editor: NonNullable<ReturnType<typeof useEditor>>) {
  let text: string | null = null
  let lineCount: number | null = null
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'codeBlock' || text != null) return false
    text = node.textBetween(0, node.content.size, '\n', '\n')
    lineCount = buildCodeBlockLineModel(text).displayLineCount
    return false
  })
  return { text, lineCount }
}

function QaCodeBlockCmInner() {
  const [status, setStatus] = useState('booting')
  const cmEnabled = isCodeBlockCmEnabled()
  const multiBlock = useMemo(
    () => new URLSearchParams(window.location.search).get('blocks') === '2',
    [],
  )
  const compact = useMemo(
    () => new URLSearchParams(window.location.search).get('compact') === '1',
    [],
  )
  const content = useMemo(
    () => {
      if (multiBlock && compact) {
        return {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph above code block.' }] },
            {
              type: 'codeBlock',
              attrs: { language: 'typescript' },
              content: [{ type: 'text', text: COMPACT_SAMPLE_A }],
            },
            { type: 'paragraph', content: [{ type: 'text', text: 'Between blocks.' }] },
            {
              type: 'codeBlock',
              attrs: { language: 'javascript' },
              content: [{ type: 'text', text: COMPACT_SAMPLE_B }],
            },
            { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph below.' }] },
          ],
        }
      }
      return {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph above code block.' }] },
        ...SCROLL_FILLER_BEFORE,
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: SAMPLE }],
        },
        ...(multiBlock
          ? [
              ...SCROLL_FILLER_BETWEEN,
              {
                type: 'codeBlock',
                attrs: { language: 'javascript' },
                content: [{ type: 'text', text: SAMPLE_B }],
              },
            ]
          : []),
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph below.' }] },
        ...SCROLL_FILLER,
      ],
    }
    },
    [compact, multiBlock],
  )

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({ codeBlock: false, heading: false, undoRedo: false }),
      VmTiptapRecorder,
      LunaCodeBlock.configure({
        lowlight: proseMirrorLowlight,
        languageClassPrefix: 'language-',
        defaultLanguage: null,
        exitOnTripleEnter: false,
        exitOnArrowDown: false,
        enableTabIndentation: true,
        tabSize: 4,
      }),
    ],
    content,
    editorProps: {
      attributes: { class: 'qa-codeblock-cm-editor' },
    },
  })

  useEffect(() => {
    if (!editor) return
    _setEditorMutationBridgeForTest(editor, null, 'visual')
    setActiveTransactionDoc(QA_TRANSACTION_DOC_ID)

    window.__QA_CODEBLOCK_CM__ = {
      cmEnabled,
      cmMounted: () => Boolean(document.querySelector('.pm-code-block-cm .cm-editor')),
      cmGutterLineCount: () =>
        document.querySelectorAll('.pm-code-block-cm .cm-lineNumbers .cm-gutterElement').length,
      cmContentLineCount: () => document.querySelectorAll('.pm-code-block-cm .cm-line').length,
      pmLineCount: () => readBlock(editor).lineCount,
      pmText: () => readBlock(editor).text,
      cmText: () => {
        const root = document.querySelector('.pm-code-block-cm-root') as
          | {
              __lunaCmView?: {
                state?: {
                  doc?: {
                    toString?: () => string
                  }
                }
              }
            }
          | null
        const live = root?.__lunaCmView?.state?.doc?.toString?.()
        if (typeof live === 'string') return live
        const lines = document.querySelectorAll('.pm-code-block-cm .cm-line')
        if (lines.length === 0) return null
        return Array.from(lines)
          .map((el) => el.textContent ?? '')
          .join('\n')
      },
      pmInsertSuffix: (suffix: string) => {
        let blockPos: number | null = null
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name !== 'codeBlock' || blockPos != null) return false
          blockPos = pos
          return false
        })
        if (blockPos == null) return false
        const block = editor.state.doc.nodeAt(blockPos)
        if (!block) return false
        const insertPos = blockPos + block.nodeSize - 1
        return editor.chain().insertContentAt(insertPos, suffix).run()
      },
      triggerPmBackspaceShortcut: () => editor.commands.keyboardShortcut('Backspace'),
      probeDeleteInActiveCodeBlockCm: () => {
        const view = getFocusedCodeBlockCmView()
        const sel = view?.state.selection.main
        const policy = resolveCodeBlockInputPolicy(editor, editor.state.selection.$from)
        const deleted = deleteInActiveCodeBlockCm(editor, policy, false)
        return {
          cmFocused: isCodeBlockCmFocused(),
          hadSelection: Boolean(sel && sel.from !== sel.to),
          deleted,
        }
      },
      runEditSelectAllCommand: () => selectAllInCurrentBlock(editor),
      runEditUndoCommand: () => {
        flushVmTiptapRecorderBatch(QA_TRANSACTION_DOC_ID)
        return undoLastTransaction(QA_TRANSACTION_DOC_ID)
      },
      runEditRedoCommand: () => {
        flushVmTiptapRecorderBatch(QA_TRANSACTION_DOC_ID)
        return redoLastTransaction(QA_TRANSACTION_DOC_ID)
      },
      isCmFocused: () => isCodeBlockCmFocused(),
      readSelectionDiagnostics: () => {
        const view = getFocusedCodeBlockCmView()
        const cmSel = view?.state.selection.main
        const cmDocLen = view?.state.doc.length ?? 0
        const pmSel = editor.state.selection
        const pmText = editor.state.doc.textBetween(pmSel.from, pmSel.to, '\n', '\n')
        return {
          cmFocused: isCodeBlockCmFocused(),
          cmFrom: cmSel?.from ?? 0,
          cmTo: cmSel?.to ?? 0,
          cmDocLen,
          cmSpansFullDoc: Boolean(cmSel && cmSel.from === 0 && cmSel.to === cmDocLen && cmDocLen > 0),
          pmFrom: pmSel.from,
          pmTo: pmSel.to,
          pmEmpty: pmSel.empty,
          pmSelectsParagraphAbove: pmText === 'Paragraph above code block.',
          selectionBgCount: document.querySelectorAll('.pm-code-block-cm .cm-selectionBackground').length,
        }
      },
      probeSyntaxHighlight: () => {
        const visibleCm = document.querySelector('.pm-code-block-cm')
        const mirror = document.querySelector('.pm-code-block-pm-mirror')
        const wrap = document.querySelector('[data-luna-code-block-wrap]')

        const countHljs = (root: Element | null) =>
          root?.querySelectorAll('span[class*="hljs-"]').length ?? 0

        const probeCmSpans = (root: Element | null) => {
          if (!root) {
            return { lineSpanCount: 0, coloredSpanCount: 0, highlightClassSpanCount: 0 }
          }
          const lines = Array.from(root.querySelectorAll('.cm-line'))
          const baseColor = lines[0] ? getComputedStyle(lines[0]).color : ''
          let lineSpanCount = 0
          let coloredSpanCount = 0
          let highlightClassSpanCount = 0
          for (const line of lines) {
            for (const span of Array.from(line.querySelectorAll('span'))) {
              lineSpanCount += 1
              const cls = span.className
              if (typeof cls === 'string' && (cls.includes('ͼ') || cls.includes('tok-'))) {
                highlightClassSpanCount += 1
              }
              if (baseColor && getComputedStyle(span).color !== baseColor) {
                coloredSpanCount += 1
              }
            }
          }
          return { lineSpanCount, coloredSpanCount, highlightClassSpanCount }
        }

        const cmSpans = probeCmSpans(visibleCm)
        return {
          wrapLanguage: wrap?.getAttribute('data-language') ?? null,
          toolbarLabel: document.querySelector('.pm-code-lang-chip__label')?.textContent?.trim() ?? null,
          visibleHljsCount: countHljs(visibleCm),
          mirrorHljsCount: countHljs(mirror),
          mirrorHasHljsRoot: mirror?.classList.contains('hljs') ?? false,
          ...cmSpans,
        }
      },
      probeCodeBlockDesignTokens: () => {
        const root = document.documentElement
        const surface = document.querySelector('.pm-code-block-surface') as HTMLElement | null
        const cmEditor = document.querySelector('.pm-code-block-cm .cm-editor') as HTMLElement | null
        const gutter = document.querySelector('.pm-code-block-cm .cm-gutters') as HTMLElement | null
        const chip = document.querySelector('.pm-code-lang-chip') as HTMLElement | null

        const readVar = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim()

        const codeBgToken = readVar(root, '--code-bg')
        const codeBlockFontToken = readVar(
          document.querySelector('.preview-pane.markdown-visual-editor') ?? root,
          '--code-block-font-size',
        )

        return {
          themeMode: root.getAttribute('data-theme'),
          themePreset: root.getAttribute('data-theme-preset'),
          codeBgToken,
          codeBlockFontSizeToken: codeBlockFontToken,
          surfaceBackground: surface ? getComputedStyle(surface).backgroundColor : '',
          gutterBackground: gutter ? getComputedStyle(gutter).backgroundColor : '',
          cmFontSize: cmEditor ? getComputedStyle(cmEditor).fontSize : '',
          chipColor: chip ? getComputedStyle(chip).color : '',
          chipBackground: chip ? getComputedStyle(chip).backgroundColor : '',
        }
      },
      setQaThemeMode: (mode: 'light' | 'dark') => {
        const root = document.documentElement
        if (!root.getAttribute('data-theme-preset')) {
          root.setAttribute('data-theme-preset', 'github')
        }
        root.setAttribute('data-theme', mode)
      },
      probeCodeBlockScrollbar: () => {
        const scroller = document.querySelector('.pm-code-block-cm .cm-scroller') as HTMLElement | null
        if (!scroller) return null
        const host = document.querySelector('.preview-pane.markdown-visual-editor') ?? document.documentElement
        const scrollerStyle = getComputedStyle(scroller)
        return {
          scrollbarWidth: scrollerStyle.scrollbarWidth,
          codeBlockScrollbarSizeToken: getComputedStyle(host).getPropertyValue('--luna-code-block-scrollbar-size').trim(),
          standardScrollbarSizeToken: getComputedStyle(document.documentElement)
            .getPropertyValue('--luna-scrollbar-size')
            .trim(),
          scrollWidth: scroller.scrollWidth,
          clientWidth: scroller.clientWidth,
          overflowsHorizontally: scroller.scrollWidth > scroller.clientWidth,
        }
      },
      probeCaretDiagnostics: () => {
        const pm = document.querySelector('.ProseMirror') as HTMLElement | null
        const cmEditor = document.querySelector('.pm-code-block-cm .cm-editor') as HTMLElement | null
        const cmWrap = document.querySelector('.pm-code-block-cm') as HTMLElement | null
        const cmCursor = document.querySelector('.pm-code-block-cm .cm-cursor') as HTMLElement | null
        const scroller = document.querySelector('.pm-code-block-cm .cm-scroller') as HTMLElement | null
        const cmContent = document.querySelector('.pm-code-block-cm .cm-content') as HTMLElement | null
        const scrollHost =
          (document.querySelector('[data-testid="qa-editor-scroll-host"]') as HTMLElement | null) ??
          (document.querySelector('.preview-pane.markdown-visual-editor') as HTMLElement | null)

        const cursorRect = cmCursor?.getBoundingClientRect()
        const scrollerRect = scroller?.getBoundingClientRect()
        const cursorInScrollerView =
          cursorRect && scrollerRect
            ? cursorRect.left >= scrollerRect.left - 1 && cursorRect.right <= scrollerRect.right + 1
            : null

        const pmCaretColor = pm ? getComputedStyle(pm).caretColor : ''

        const staleCmFocusedChrome = Boolean(
          pm?.querySelector('.pm-code-block-cm .cm-editor.cm-focused:not(:focus-within)'),
        )

        const hostRect = scrollHost?.getBoundingClientRect()
        const wrapRect = cmWrap?.getBoundingClientRect()
        const codeBlockInView =
          Boolean(hostRect && wrapRect) &&
          wrapRect!.bottom > hostRect!.top &&
          wrapRect!.top < hostRect!.bottom

        const active = document.activeElement
        const activeElementSummary =
          active instanceof HTMLElement
            ? `${active.tagName.toLowerCase()}${active.className ? `.${active.className.split(/\s+/).slice(0, 2).join('.')}` : ''}`
            : String(active?.nodeName ?? 'none')

        let pmSelectionEmpty = true
        let pmSelectionOutsideCodeBlock = false
        try {
          const view = editor?.view
          if (view) {
            pmSelectionEmpty = view.state.selection.empty
            const { $from } = view.state.selection
            let inCodeBlock = false
            for (let depth = $from.depth; depth > 0; depth -= 1) {
              if ($from.node(depth).type.name === 'codeBlock') {
                inCodeBlock = true
                break
              }
            }
            pmSelectionOutsideCodeBlock = !inCodeBlock
          }
        } catch {
          pmSelectionEmpty = true
          pmSelectionOutsideCodeBlock = false
        }

        return {
          cmFocusedClass: cmEditor?.classList.contains('cm-focused') ?? false,
          staleCmFocusedChrome,
          cmHasFocus: isCodeBlockCmFocused(),
          cmCursorCount: document.querySelectorAll('.pm-code-block-cm .cm-cursor').length,
          cmCursorVisibility: cmCursor ? getComputedStyle(cmCursor).visibility : null,
          cmCursorInScrollerView: cursorInScrollerView,
          cmContentCaretColor: cmContent ? getComputedStyle(cmContent).caretColor : '',
          pmCaretColor,
          pmCaretTransparent: pmCaretColor === 'transparent' || pmCaretColor === 'rgba(0, 0, 0, 0)',
          pmContentEditable: pm?.isContentEditable ?? false,
          pmHasFocus: pm?.contains(document.activeElement) ?? false,
          scrollerScrollLeft: scroller?.scrollLeft ?? 0,
          activeInCm: Boolean(
            document.activeElement instanceof HTMLElement &&
              document.activeElement.closest('.pm-code-block-cm'),
          ),
          codeBlockInView,
          pmDomSuspended: isPmDomSuspendedForCodeBlockCm(pm),
          pmSoftLocked: editor ? isPmLockedForCodeBlockCm(editor) : false,
          activeElementSummary,
          pmSelectionEmpty,
          pmSelectionOutsideCodeBlock,
        }
      },
      scrollUntilCodeBlockOffScreen: (direction: 'up' | 'down') => {
        const host =
          (document.querySelector('[data-testid="qa-editor-scroll-host"]') as HTMLElement | null) ??
          (document.querySelector('.preview-pane.markdown-visual-editor') as HTMLElement | null)
        const wrap = document.querySelector('.pm-code-block-cm') as HTMLElement | null
        if (!host || !wrap) return false
        if (direction === 'down') {
          host.scrollTop = host.scrollHeight
        } else {
          host.scrollTop = 0
        }
        const hostRect = host.getBoundingClientRect()
        const wrapRect = wrap.getBoundingClientRect()
        return !(wrapRect.bottom > hostRect.top && wrapRect.top < hostRect.bottom)
      },
      scrollCodeBlockCmHorizontally: (toEnd: boolean) => {
        const scroller = document.querySelector('.pm-code-block-cm .cm-scroller') as HTMLElement | null
        if (!scroller) return false
        scroller.scrollLeft = toEnd ? Math.max(0, scroller.scrollWidth - scroller.clientWidth) : 0
        return scroller.scrollLeft > 0 || !toEnd
      },
      simulateMarkdownSerializeFlush: () => {
        flushAllCodeBlockSessions(editor)
        reconcileCodeBlockCmFocusAfterSerialize(editor)
        const serialized = canonicalMarkdownSemantics.trySerialize(editor.state.doc, editor.schema)
        return serialized.ok
      },
      simulateStaleCmFocusedAfterFlush: () => {
        flushAllCodeBlockSessions(editor)
        const active = document.activeElement
        if (active instanceof HTMLElement) active.blur()
        return true
      },
      scrollEditorPageVertically: (deltaY: number) => {
        const host =
          (document.querySelector('[data-testid="qa-editor-scroll-host"]') as HTMLElement | null) ??
          (document.querySelector('.preview-pane.markdown-visual-editor') as HTMLElement | null)
        if (!host) return false
        host.scrollTop += deltaY
        return true
      },
      blurActiveElement: () => {
        const active = document.activeElement
        if (active instanceof HTMLElement) active.blur()
      },
      countCodeBlocks: () => document.querySelectorAll('[data-luna-code-block-wrap]').length,
      probeBlockCaret: (blockIndex: number) => probeCodeBlockWrapCaret(blockIndex),
      scrollBlockOffScreen: (blockIndex: number) => {
        const host = resolveScrollHost()
        const wrap = resolveCodeBlockWrap(blockIndex)
        if (!host || !wrap) return false
        if (blockIndex === 0) {
          host.scrollTop = 0
        } else {
          host.scrollTop = host.scrollHeight
        }
        const hostRect = host.getBoundingClientRect()
        const wrapRect = wrap.getBoundingClientRect()
        return !(wrapRect.bottom > hostRect.top && wrapRect.top < hostRect.bottom)
      },
      getActiveCodeBlockIndex: () => {
        const active = document.activeElement
        if (!(active instanceof HTMLElement)) return null
        const wraps = document.querySelectorAll('[data-luna-code-block-wrap]')
        for (let i = 0; i < wraps.length; i += 1) {
          if (wraps.item(i)?.contains(active)) return i
        }
        return null
      },
      focusPmEndBeforeCodeBlock: (blockIndex: number) => {
        const blockPositions: number[] = []
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'codeBlock') blockPositions.push(pos)
        })
        const blockPos = blockPositions[blockIndex]
        if (blockPos == null) return false
        const $block = editor.state.doc.resolve(blockPos)
        const indexInParent = $block.index($block.depth)
        if (indexInParent <= 0) return false
        const prev = $block.parent.child(indexInParent - 1)
        if (!prev.type.isTextblock) return false
        const paraStart = blockPos - prev.nodeSize
        const end = paraStart + 1 + prev.content.size
        return editor.chain().focus().setTextSelection(end).scrollIntoView().run()
      },
      toggleCodeBlockWithFocus: () => toggleCodeBlockWithFocusAndLog(editor),
      focusCodeBlockAtIndex: (blockIndex: number) => {
        const blockPositions: number[] = []
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'codeBlock') blockPositions.push(pos)
        })
        const blockPos = blockPositions[blockIndex]
        if (blockPos == null) return false
        editor.chain().focus().setTextSelection(blockPos + 1).scrollIntoView().run()
        try {
          const wrap = editor.view.nodeDOM(blockPos) as HTMLElement | null
          if (!wrap?.matches('[data-luna-code-block-wrap]')) return false
          requestCodeBlockCmEdit(wrap)
          return true
        } catch {
          return false
        }
      },
      focusQaParagraph: (label: 'above' | 'below') => {
        const targetText = label === 'above' ? 'Paragraph above code block.' : 'Paragraph below.'
        let focused = false
        editor.state.doc.descendants((node, pos) => {
          if (focused || node.type.name !== 'paragraph') return
          if (node.textContent !== targetText) return
          editor.chain().focus().setTextSelection(pos + 1).run()
          focused = true
        })
        return focused
      },
    }

    const mounted = Boolean(document.querySelector('.pm-code-block-cm'))
    const pmLines = readBlock(editor).lineCount
    setStatus(
      cmEnabled
        ? mounted
          ? `ready:cm-mounted pmLines=${pmLines ?? '?'}`
          : 'ready:cm-flag-but-no-dom'
        : 'ready:legacy (add ?codeblockCm=1 or remove ?codeblockCm=0)',
    )

    return () => {
      _setEditorMutationBridgeForTest(null, null, 'visual')
      delete window.__QA_CODEBLOCK_CM__
    }
  }, [editor, cmEnabled])

  return (
    <div style={{ padding: 24, background: '#0f1115', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready" style={{ color: '#fff', marginBottom: 8 }}>
        CodeBlock CM QA
      </h1>
      <p data-testid="qa-status" style={{ color: '#cbd5e1', marginBottom: 8 }}>
        {status}
      </p>
      <p data-testid="qa-cm-flag" style={{ color: '#94a3b8', marginBottom: 16 }}>
        codeblockCm={cmEnabled ? 'default-on' : 'off'}
      </p>
      <div
        data-testid="qa-editor-scroll-host"
        className="preview-pane markdown-visual-editor"
        style={{ maxWidth: 980, height: 280, overflow: 'auto' }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export function QaCodeBlockCmPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaCodeBlockCmInner />
    </I18nProvider>
  )
}
