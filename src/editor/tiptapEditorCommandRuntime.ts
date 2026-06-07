import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { openLunaEmojiPicker } from './lunaEmojiPicker'
import { openLunaTableInsertPicker } from './lunaTableInsertPicker'
import { selectAllInCurrentBlock } from './lunaBlockSelectAll'
import { isCodeBlockCmEnabled } from './codeBlock/cm/codeBlockCmFeature'
import {
  deleteInActiveCodeBlockCm,
  deleteInFocusedCodeBlockCm,
  isCodeBlockCmFocused,
} from './codeBlock/cm/codeBlockCmFocus'
import { resolveCodeBlockInputPolicy } from './codeBlock/boundary'
import { isCodeEditGuardActive } from './lunaCodeContext'
import {
  isCommandAllowedInCodeContext,
  isCommandAllowedWhileComposing,
} from './visualOpFailure'
import { toggleCodeBlockWithFocusAndLog } from './lunaCodeBlock'
import { openExternalUrlInSystemBrowser } from './openExternalLink'
import { bridgeRestoreLastNonEmptySelection } from './editorMutationBridge'
import {
  destroyEphemeralSession,
  runEphemeralCommand,
  type EphemeralCommandType,
} from './ephemeralFormatting'
import { normalizeTextColor } from './lunaTextColor'
import type { TiptapEditorCommand } from './tiptapEditorTypes'
import { validateASTBeforeCommit } from './astGuardrails'

const TI_FOCUS_NO_SCROLL = { scrollIntoView: false as const }

function normalizeLinkHrefForExternalAction(rawHref: string): string | null {
  const trimmed = rawHref.trim()
  if (!trimmed) return null
  const withProtocol = /^www\./iu.test(trimmed) ? `https://${trimmed}` : trimmed
  const lowered = withProtocol.toLowerCase()
  if (
    lowered.startsWith('javascript:') ||
    lowered.startsWith('data:') ||
    lowered.startsWith('vbscript:')
  ) {
    return null
  }
  if (/^https?:\/\//iu.test(withProtocol) || /^mailto:/iu.test(withProtocol)) {
    return withProtocol
  }
  return null
}

function readSelectionLinkHref(editor: Editor): string | null {
  const attrs = editor.getAttributes('link') as { href?: unknown }
  if (editor.isActive('link') && typeof attrs.href === 'string' && attrs.href.trim()) {
    return attrs.href.trim()
  }
  const linkMark = editor.schema.marks.link
  if (!linkMark) return null
  const { from, to, empty } = editor.state.selection
  if (empty) {
    const at = editor.state.doc.resolve(from)
    const mark =
      linkMark.isInSet(at.marks()) ||
      (from > 1 ? linkMark.isInSet(editor.state.doc.resolve(from - 1).marks()) : null)
    const href = String(mark?.attrs?.href ?? '').trim()
    return href || null
  }
  let hit: string | null = null
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (hit || !node.isText) return
    const mark = linkMark.isInSet(node.marks)
    if (!mark) return
    const href = String(mark.attrs?.href ?? '').trim()
    if (href) hit = href
  })
  return hit
}

export function selectedText(editor: Editor): string {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n')
}

export function runEphemeralEditorCommand(editor: Editor, commandType: EphemeralCommandType): boolean {
  return runEphemeralCommand(editor, commandType, { focusNoScroll: true })
}

export function runTiptapCommand(editor: Editor, command: TiptapEditorCommand): boolean {
  if (editor.isDestroyed) return false
  const findCurrentBlockRange = (): { from: number; to: number } | null => {
    const { $from } = editor.state.selection
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth)
      if (!node.isBlock) continue
      return { from: $from.before(depth), to: $from.after(depth) }
    }
    return null
  }
  const insertParagraphAroundCurrent = (position: 'above' | 'below'): boolean => {
    const block = findCurrentBlockRange()
    if (!block) return false
    const paragraph = editor.schema.nodes.paragraph
    if (!paragraph) return false
    const insertPos = position === 'above' ? block.from : block.to
    const tr = editor.state.tr.insert(insertPos, paragraph.create())
    tr.setSelection(TextSelection.create(tr.doc, insertPos + 1))
    tr.scrollIntoView()
    editor.view.dispatch(tr)
    return true
  }
  const findAncestorCodeBlock = (): { from: number; to: number; text: string } | null => {
    const { state } = editor
    const { $from } = state.selection
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth)
      if (node.type.name !== 'codeBlock') continue
      const from = $from.start(depth)
      const to = $from.end(depth)
      return { from, to, text: node.textContent ?? '' }
    }
    return null
  }
  const indentRange = (from: number, to: number): boolean => {
    if (to <= from) return false
    const text = editor.state.doc.textBetween(from, to, '\n', '\n')
    if (!text.length) return false
    const indented = text
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')
    editor.view.dispatch(editor.state.tr.insertText(indented, from, to))
    return true
  }
  const clearInlineFormatting = (): boolean => {
    destroyEphemeralSession(editor)
    let state = editor.state
    let { from, to, empty } = state.selection
    const restoredSelection = empty ? bridgeRestoreLastNonEmptySelection() : false
    if (restoredSelection) {
      state = editor.state
      ;({ from, to, empty } = state.selection)
    }
    if (import.meta.env.DEV) {
      console.debug('[clear-formatting][selection]', {
        restoredSelection,
        empty,
        from,
        to,
      })
    }
    const tr = state.tr
    const markNames = ['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'link', 'textColor'] as const
    if (empty) {
      tr.setStoredMarks([])
      editor.view.dispatch(tr)
      return true
    }
    for (const name of markNames) {
      const markType = state.schema.marks[name]
      if (!markType) continue
      tr.removeMark(from, to, markType)
    }
    tr.setStoredMarks([])
    editor.view.dispatch(tr.scrollIntoView())
    return true
  }
  if (isCodeEditGuardActive(editor.state) && !isCommandAllowedInCodeContext(command)) {
    return false
  }
  if (editor.view.composing && !isCommandAllowedWhileComposing(command)) {
    return false
  }
  const chain = editor.chain().focus(null, TI_FOCUS_NO_SCROLL)
  const activeHeadingLevel = (): number | null => {
    for (let level = 1; level <= 6; level += 1) {
      if (editor.isActive('heading', { level })) return level
    }
    return null
  }
  switch (command.type) {
    case 'heading':
      return chain.toggleHeading({ level: command.level }).run()
    case 'headingLevelDelta': {
      const level = activeHeadingLevel()
      if (level == null) return false
      const nextLevel = Math.max(1, Math.min(6, level + command.delta))
      if (nextLevel === level) return false
      return chain.setHeading({ level: nextLevel as 1 | 2 | 3 | 4 | 5 | 6 }).run()
    }
    case 'paragraph':
      return chain.setParagraph().run()
    case 'insertParagraphAbove':
      return insertParagraphAroundCurrent('above')
    case 'insertParagraphBelow':
      return insertParagraphAroundCurrent('below')
    case 'callout':
      return chain
        .insertContent([
          {
            type: 'callout',
            attrs: { kind: command.kind, collapsed: false },
            content: [{ type: 'paragraph' }],
          },
          { type: 'paragraph' },
        ])
        .run()
    case 'blockMath':
      return chain
        .insertContent([
          { type: 'blockMath', attrs: { latex: '' } },
          { type: 'paragraph' },
        ])
        .run()
    case 'copyCodeBlock': {
      const codeBlock = findAncestorCodeBlock()
      if (!codeBlock) return false
      void navigator.clipboard.writeText(codeBlock.text)
      return true
    }
    case 'indentCodeSelection': {
      const codeBlock = findAncestorCodeBlock()
      if (!codeBlock) return false
      const from = Math.max(editor.state.selection.from, codeBlock.from)
      const to = Math.min(editor.state.selection.to, codeBlock.to)
      if (from === to) return indentRange(codeBlock.from, codeBlock.to)
      return indentRange(from, to)
    }
    case 'indentCodeBlock': {
      const codeBlock = findAncestorCodeBlock()
      if (!codeBlock) return false
      return indentRange(codeBlock.from, codeBlock.to)
    }
    case 'bulletList':
      return chain.toggleBulletList().run()
    case 'orderedList':
      return chain.toggleOrderedList().run()
    case 'taskList':
      return chain.toggleTaskList().run()
    case 'blockquote':
      return chain.toggleBlockquote().run()
    case 'bold':
      return runEphemeralEditorCommand(editor, 'bold')
    case 'italic':
      return runEphemeralEditorCommand(editor, 'italic')
    case 'underline':
      return runEphemeralEditorCommand(editor, 'underline')
    case 'strike':
      return runEphemeralEditorCommand(editor, 'strike')
    case 'highlight':
      return runEphemeralEditorCommand(editor, 'highlight')
    case 'code':
      return runEphemeralEditorCommand(editor, 'code')
    case 'inlineMath': {
      const { from, to, empty } = editor.state.selection
      const latex = empty ? 'x' : editor.state.doc.textBetween(from, to, '\n', '\n')
      return chain.insertContent({ type: 'inlineMath', attrs: { latex } }).run()
    }
    case 'comment': {
      const { from, to, empty } = editor.state.selection
      const body =
        empty ? 'comment' : editor.state.doc.textBetween(from, to, '\n', '\n').trim() || 'comment'
      const nodeType = editor.schema.nodes.rawInline
      if (!nodeType) return false
      const node = nodeType.create({ source: 'html', content: `<!-- ${body} -->` })
      const tr = editor.state.tr.replaceWith(from, to, node)
      const after = from + node.nodeSize
      tr.setSelection(TextSelection.create(tr.doc, after))
      tr.scrollIntoView()
      editor.view.dispatch(tr)
      return true
    }
    case 'setTextColor': {
      const color = normalizeTextColor(command.color)
      if (!color) {
        return chain.extendMarkRange('textColor').unsetMark('textColor').run()
      }
      return chain.extendMarkRange('textColor').setMark('textColor', { color }).run()
    }
    case 'link': {
      const { from, to, empty } = editor.state.selection
      if (empty) {
        const title = 'title'
        const href = 'https://'
        const linkMark = editor.schema.marks.link
        if (!linkMark) return false
        const tr = editor.state.tr.insertText(title, from, to)
        tr.addMark(from, from + title.length, linkMark.create({ href }))
        tr.setSelection(TextSelection.create(tr.doc, from, from + title.length))
        tr.scrollIntoView()
        editor.view.dispatch(tr)
        return true
      }
      const text = selectedText(editor).trim()
      const href = validateASTBeforeCommit({ type: 'linkHref', href: text }).value
      if (editor.isActive('link')) {
        return chain.extendMarkRange('link').setLink({ href }).run()
      }
      return chain.setLink({ href }).run()
    }
    case 'openLink': {
      const href = normalizeLinkHrefForExternalAction(readSelectionLinkHref(editor) ?? '')
      if (!href) return false
      void openExternalUrlInSystemBrowser(href)
      return true
    }
    case 'copyLinkAddress': {
      const href = readSelectionLinkHref(editor)
      if (!href) return false
      void navigator.clipboard.writeText(href)
      return true
    }
    case 'linkReference': {
      const linkReferenceDef = editor.schema.nodes.linkReferenceDef
      if (!linkReferenceDef) return false
      const { $from } = editor.state.selection
      const insertPos = $from.after()
      const node = linkReferenceDef.create({ label: '', href: 'https://' })
      const tr = editor.state.tr.insert(insertPos, node)
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
      tr.scrollIntoView()
      editor.view.dispatch(tr)
      return true
    }
    case 'image':
      return chain.setImage({ src: './image.png' }).run()
    case 'codeBlock':
      return toggleCodeBlockWithFocusAndLog(editor, command.language || 'text')
    case 'insertTablePicker':
      openLunaTableInsertPicker(editor)
      return true
    case 'openEmojiPicker':
      openLunaEmojiPicker(editor)
      return true
    case 'selectAll':
      if (selectAllInCurrentBlock(editor)) return true
      return editor.commands.selectAll()
    case 'deleteSelection': {
      if (isCodeBlockCmEnabled() && isCodeBlockCmFocused()) {
        const policy = resolveCodeBlockInputPolicy(editor, editor.state.selection.$from)
        if (deleteInActiveCodeBlockCm(editor, policy, false)) return true
        if (deleteInFocusedCodeBlockCm(false)) return true
      }
      return chain.deleteSelection().run()
    }
    case 'clearFormatting':
      return clearInlineFormatting()
    case 'insertText':
      return chain.insertContent(command.text).run()
    case 'horizontalRule':
      return chain.setHorizontalRule().run()
    case 'tocDirective': {
      const commands = editor.commands as typeof editor.commands & { insertTocDirective?: () => boolean }
      if (typeof commands.insertTocDirective !== 'function') return false
      return commands.insertTocDirective()
    }
    case 'footnoteRef': {
      const label = (command.label ?? '1').trim() || '1'
      return chain.insertContent({ type: 'footnoteRef', attrs: { label } }).run()
    }
    default:
      return false
  }
}

export function runTiptapCommandForTest(editor: Editor, command: TiptapEditorCommand): boolean {
  return runTiptapCommand(editor, command)
}
