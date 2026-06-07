import { Extension, type Extensions } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { LunaTable, LunaTableView } from './lunaTable'
import { isSelectionInsideTableCell, LunaTableCell, LunaTableHeader, LunaTableCellHeadingGuard } from './lunaTableCell'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Underline from '@tiptap/extension-underline'
import { LunaBlockSelectAll } from './lunaBlockSelectAll'
import { LunaCodeBlock, toggleCodeBlockWithFocusAndLog } from './lunaCodeBlock'
import { isCodeEditGuardActive } from './lunaCodeContext'
import { LunaCodeFenceGuard } from './codeBlock/behavior/fenceGuard'
import { LunaCodeBlockNav } from './codeBlock/behavior/nav'
import { LunaEditorCaretNav } from './lunaEditorCaretNav'
import { proseMirrorLowlight } from './proseMirrorLowlight'
import { CalloutNode } from './extensions/CalloutNode'
import { LunaCodeBlockCmIsolation } from './extensions/LunaCodeBlockCmIsolation'
import { LunaMermaidIsolation } from './extensions/LunaMermaidIsolation'
import { LunaNativeTextInputIsolation } from './extensions/LunaNativeTextInputIsolation'
import { LunaMermaidSourceKeyboardIsolation } from './extensions/LunaMermaidSourceKeyboardIsolation'
import { LunaMermaidSourceSync } from './extensions/LunaMermaidSourceSync'
import { LunaDocumentRuntime } from './documentRuntime'
import { MermaidBlock } from './extensions/MermaidNode'
import { LunaBlockMath, LunaInlineMath } from './extensions/MathNode'
import { LUNA_KATEX_HTML_OPTIONS } from './lunaKatexOptions'
import { LunaEmoji } from './lunaEmoji'
import { LunaRawBlock } from './lunaRawBlock'
import { LunaRawInline } from './lunaRawInline'
import { LunaHeading } from './lunaHeading'
import { LunaImage } from './lunaImage'
import { LunaListTypora } from './lunaListTypora'
import { LunaTabInText } from './lunaTabInText'
import { TocDirective } from './tocDirective'
import { LunaSplitBlockParagraphDefault } from './lunaSplitBlockParagraphDefault'
import { LunaEmptyParagraphSelectionStyle } from './lunaEmptyParagraphSelectionStyle'
import { LunaParagraphDoubleClickWordSelect } from './lunaParagraphDoubleClickWordSelect'
import { LunaImeSwallowMarkShortcuts } from './lunaImeCoreUx'
import { LunaEphemeralCommitOnEnter, LunaEphemeralFormattingShortcuts } from './lunaEphemeralFormatting'
import { LunaMarkdownSourceReveal } from './lunaMarkdownSourceReveal'
import { LunaTableSlashCommand } from './lunaTableSlashCommand'
import { LunaTaskListLiveLift } from './lunaTaskListLiveLift'
import { LunaInlineHtmlMarkLiveLift } from './lunaInlineHtmlMarkLiveLift'
import { LunaLink } from './lunaLink'
import { LunaTextColor } from './lunaTextColor'
import { LunaHighlight } from './lunaHighlight'
import {
  LunaDefinitionDescription,
  LunaDefinitionList,
  LunaDefinitionTerm,
} from './lunaDefinitionList'
import { LunaFootnoteDef, LunaFootnoteRef } from './lunaFootnote'
import { LunaFootnoteDefLiveLift } from './lunaFootnoteDefLiveLift'
import { LunaLinkReferenceDef } from './lunaLinkReferenceDef'
import { LunaInputLayerGuard } from './extensions/LunaInputLayerGuard'
import { LunaWebviewPasteBridge } from './extensions/LunaWebviewPasteBridge'
import { LunaCodeBlockCmFocusDebug } from './extensions/LunaCodeBlockCmFocusDebug'
import { LunaPasteScrollDebug } from './extensions/LunaPasteScrollDebug'
import type { WebviewPasteImageHandler } from './webviewPasteBridge'
import { VmTiptapRecorder } from '../vm/vmTiptapRecorder'
import { VmInputRouter } from '../vm/inputRouter'

export type LunaMarkdownEditorExtensionOptions = {
  resolveMediaSrc: (src: string) => string
  getNoteAssetContext: () => { root: string; notePath: string } | null
  onPasteImage?: WebviewPasteImageHandler
  placeholderText?: string
  placeholderHint?: string
}

/**
 * List of block-level extensions consistent with TiptapMarkdownEditor (shared by getSchema / useEditor).
 */
export function createLunaMarkdownEditorExtensions(options: LunaMarkdownEditorExtensionOptions): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      link: false,
      codeBlock: false,
      /** StarterKit 3.x includes Underline by default; register it separately below to avoid duplication of extensions*/
      underline: false,
      /**
       * Disable ProseMirror native history — VM transaction log is the sole
       * undo/redo authority. Keeping native history alongside VM creates dual
       * undo stacks (see audit findings F-P0-3 / S-1).
       */
      undoRedo: false,
      /**
       * Typora semantics: the visual document should not keep a synthetic root
       * tail paragraph that doesn't exist in Markdown. New paragraphs must be
       * created only when the user explicitly continues editing past a block.
       */
      trailingNode: false,
      bulletList: {
        HTMLAttributes: { class: 'pm-editor-list pm-bullet-list' },
      },
      orderedList: {
        HTMLAttributes: { class: 'pm-editor-list pm-ordered-list' },
      },
    }),
    /**
     * VM Recorders — must be first so they capture every PM transaction,
     * including those from other extensions below.
     */
    VmTiptapRecorder,
    /** Routes drop, cut → VM command → applyVMSteps */
    VmInputRouter,
    /** Both the browser and Tauri intercept PM's native paste and use pure text/image pipelines.*/
    LunaWebviewPasteBridge.configure({ onPasteImage: options.onPasteImage }),
    LunaPasteScrollDebug,
    LunaCodeBlockCmFocusDebug,
    /** Intercept Mod-B/I/` etc. during word formation to avoid conflicts with CJK IME*/
    LunaInputLayerGuard,
    LunaImeSwallowMarkShortcuts,
    /** Ephemeral inline format: Mod-B/I wait for snapshot restoration, disable toggle*/
    LunaEphemeralFormattingShortcuts,
    /** Enter ends the ephemeral input and restores the text style after a line break.*/
    LunaEphemeralCommitOnEnter,
    /** Double-click the mark with reveal → the document inline is replaced with the Markdown source code (without overlay); ordinary text retains the native word selection*/
    LunaMarkdownSourceReveal,
    LunaRawBlock,
    LunaRawInline,
    LunaEmoji,
    LunaHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    Superscript,
    Subscript,
    Underline,
    LunaTextColor,
    LunaHighlight,
    LunaDefinitionList,
    LunaDefinitionTerm,
    LunaDefinitionDescription,
    LunaInlineHtmlMarkLiveLift,
    LunaListTypora,
    /** Tab: Indent the list/insert spaces in the text to prevent WebView from moving the focus to the beginning of the line*/
    LunaTabInText,
    LunaCodeBlock.configure({
      lowlight: proseMirrorLowlight,
      languageClassPrefix: 'language-',
      defaultLanguage: null,
      /** Enter within the code block only breaks the line, not `exitCode` jumps out of the fence*/
      exitOnTripleEnter: false,
      exitOnArrowDown: false,
      enableTabIndentation: true,
      tabSize: 4,
    }),
    /** Enter / Tab: precede Table and default keymap to avoid accidentally damaging edits within the fence with tables and splitBlocks.*/
    LunaCodeFenceGuard,
    /** Code block boundary ↑↓ → language bar / body (higher than default keymap)*/
    LunaCodeBlockNav,
    LunaEditorCaretNav,
    /** Mod-A block-level select all (before built-in keymap)*/
    LunaBlockSelectAll,
    LunaFootnoteRef,
    LunaFootnoteDef,
    LunaFootnoteDefLiveLift,
    LunaLinkReferenceDef,
    LunaLink.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: false,
      protocols: ['mailto', 'luna-asset'],
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        class: 'pm-link-inline',
      },
    }),
    LunaBlockMath.configure({
      katexOptions: LUNA_KATEX_HTML_OPTIONS,
    }),
    LunaInlineMath.configure({
      katexOptions: LUNA_KATEX_HTML_OPTIONS,
    }),
    MermaidBlock,
    LunaNativeTextInputIsolation,
    LunaCodeBlockCmIsolation,
    LunaMermaidIsolation,
    LunaMermaidSourceKeyboardIsolation,
    LunaMermaidSourceSync,
    LunaDocumentRuntime,
    CalloutNode,
    LunaImage.configure({
      resolveSrc: options.resolveMediaSrc,
      getNoteAssetContext: options.getNoteAssetContext,
    } as Parameters<typeof LunaImage.configure>[0]),
    LunaTable.configure({
      resizable: true,
      View: LunaTableView,
    }),
    TableRow,
    LunaTableHeader,
    LunaTableCell,
    LunaTableCellHeadingGuard,
    LunaTableSlashCommand,
    TaskList.configure({
      HTMLAttributes: { class: 'pm-editor-task-list' },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: 'pm-task-item' },
    }),
    LunaTaskListLiveLift,
    TocDirective,
    Placeholder.configure({
      placeholder: ({ editor, node }) => {
        if (node.type.name !== 'paragraph') return ''
        const main = options.placeholderText ?? 'Start writing...'
        const hint = options.placeholderHint?.trim()
        if (editor.isEmpty && hint) {
          return `${main}\n${hint}`
        }
        return main
      },
    }),
    Extension.create({
      name: 'lunaPasteImage',
      addProseMirrorPlugins() {
        return []
      },
      addKeyboardShortcuts() {
        const inTable = () => isSelectionInsideTableCell(this.editor)
        const inCode = () => isCodeEditGuardActive(this.editor.state)
        return {
          'Mod-1': () => {
            if (inCode()) return true
            return !inTable() && this.editor.commands.toggleHeading({ level: 1 })
          },
          'Mod-2': () => {
            if (inCode()) return true
            return !inTable() && this.editor.commands.toggleHeading({ level: 2 })
          },
          'Mod-3': () => {
            if (inCode()) return true
            return !inTable() && this.editor.commands.toggleHeading({ level: 3 })
          },
          'Mod-4': () => {
            if (inCode()) return true
            return !inTable() && this.editor.commands.toggleHeading({ level: 4 })
          },
          'Mod-5': () => {
            if (inCode()) return true
            return !inTable() && this.editor.commands.toggleHeading({ level: 5 })
          },
          'Mod-6': () => {
            if (inCode()) return true
            return !inTable() && this.editor.commands.toggleHeading({ level: 6 })
          },
          'Mod-Shift-7': () => {
            if (inCode()) return true
            return this.editor.commands.toggleBulletList()
          },
          'Mod-Shift-8': () => {
            if (inCode()) return true
            return this.editor.commands.toggleOrderedList()
          },
          'Mod-Shift-9': () => {
            if (inCode()) return true
            return this.editor.commands.toggleTaskList()
          },
          'Mod-Shift-.': () => {
            if (inCode()) return true
            return this.editor.commands.toggleBlockquote()
          },
          'Mod-Shift-`': () => toggleCodeBlockWithFocusAndLog(this.editor),
          'Mod-Shift-c': () => toggleCodeBlockWithFocusAndLog(this.editor),
          'Mod-Alt-c': () => toggleCodeBlockWithFocusAndLog(this.editor),
        }
      },
    }),
    LunaParagraphDoubleClickWordSelect,
    LunaEmptyParagraphSelectionStyle,
    /** Put at the end of the list to override the splitBlock of @tiptap/core Commands*/
    LunaSplitBlockParagraphDefault,
  ]
}
