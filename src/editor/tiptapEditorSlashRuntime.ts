import { type Editor } from '@tiptap/core'

import { openLunaTableInsertPicker } from './lunaTableInsertPicker'
import {
  computeSuggestMenuPosition,
  matchWikiLinkSuggestInText,
  searchWikiLinkSuggestCandidates,
} from './lunaWikiLinkSuggest'
import { isCodeEditGuardActive } from './lunaCodeContext'
import { isSelectionInsideTableCell } from './lunaTableCell'
import {
  buildSlashMenuRows,
  computeSlashMenuPosition,
  firstExecutableSlashRowIndex,
  type SlashCommandItem,
  type SlashCommandLeaf,
  SLASH_FILE_LINK_ID,
  type SlashMenuState,
  type WikiLinkMenuState,
} from './tiptapSlashMenuModel'
import type { TiptapEditorCommand } from './tiptapEditorTypes'
import type { EphemeralCommandType } from './ephemeralFormatting'

type FocusNoScrollOption = { scrollIntoView: false }

type CreateTiptapSlashCommandsArgs = {
  t: (key: string) => string
  focusNoScroll: FocusNoScrollOption
  runTiptapCommand: (editor: Editor, command: TiptapEditorCommand) => boolean
  runEphemeralCommand: (editor: Editor, commandType: EphemeralCommandType) => boolean
}

function insertWikiLinkTrigger(editor: Editor, focusNoScroll: FocusNoScrollOption): boolean {
  return editor.chain().focus(null, focusNoScroll).insertContent('[[').run()
}

function slashRunTiptap(
  id: string,
  label: string,
  aliases: string[],
  command: TiptapEditorCommand,
  runTiptapCommand: CreateTiptapSlashCommandsArgs['runTiptapCommand'],
): SlashCommandLeaf {
  return {
    id,
    label,
    aliases,
    run: (editor) => runTiptapCommand(editor, command),
  }
}

function slashRunEphemeral(
  id: string,
  label: string,
  aliases: string[],
  mark: EphemeralCommandType,
  runEphemeralCommand: CreateTiptapSlashCommandsArgs['runEphemeralCommand'],
): SlashCommandLeaf {
  return {
    id,
    label,
    aliases,
    run: (editor) => runEphemeralCommand(editor, mark),
  }
}

export function createTiptapSlashCommands(args: CreateTiptapSlashCommandsArgs): readonly SlashCommandItem[] {
  const { t, focusNoScroll, runTiptapCommand, runEphemeralCommand } = args
  return [
    slashRunEphemeral('bold', t('editor.slash.bold'), ['bold', '粗体', '加粗'], 'bold', runEphemeralCommand),
    slashRunEphemeral('italic', t('editor.slash.italic'), ['italic', '斜体'], 'italic', runEphemeralCommand),
    slashRunTiptap('h1', t('editor.slash.h1'), ['h1', 'heading1', 'title', '标题1', '一级标题'], {
      type: 'heading',
      level: 1,
    }, runTiptapCommand),
    slashRunTiptap('h2', t('editor.slash.h2'), ['h2', 'heading2', '标题2', '二级标题'], {
      type: 'heading',
      level: 2,
    }, runTiptapCommand),
    slashRunTiptap('h3', t('editor.slash.h3'), ['h3', 'heading3', '标题3', '三级标题'], {
      type: 'heading',
      level: 3,
    }, runTiptapCommand),
    slashRunTiptap('h4', t('editor.slash.h4'), ['h4', 'heading4', '标题4', '四级标题'], {
      type: 'heading',
      level: 4,
    }, runTiptapCommand),
    slashRunTiptap('h5', t('editor.slash.h5'), ['h5', 'heading5', '标题5', '五级标题'], {
      type: 'heading',
      level: 5,
    }, runTiptapCommand),
    slashRunTiptap('h6', t('editor.slash.h6'), ['h6', 'heading6', '标题6', '六级标题'], {
      type: 'heading',
      level: 6,
    }, runTiptapCommand),
    slashRunTiptap('bullet', t('editor.slash.bullet'), ['list', 'ul', 'bullet', '无序列表'], {
      type: 'bulletList',
    }, runTiptapCommand),
    slashRunTiptap('ordered', t('editor.slash.ordered'), ['ol', 'ordered', '有序列表'], {
      type: 'orderedList',
    }, runTiptapCommand),
    slashRunTiptap('task', t('editor.slash.task'), ['task', 'todo', 'checkbox', '任务', '待办', '任务列表'], {
      type: 'taskList',
    }, runTiptapCommand),
    slashRunTiptap(
      'code-block',
      t('editor.slash.codeBlock'),
      ['code', 'codeblock', 'fence', '代码', '代码块'],
      { type: 'codeBlock', language: 'text' },
      runTiptapCommand,
    ),
    {
      id: 'table',
      label: t('editor.slash.table'),
      aliases: ['table', 'tbl', '表格'],
      run: (editor) => {
        const commands = editor.commands as typeof editor.commands & {
          insertTable?: (options: { rows: number; cols: number; withHeaderRow?: boolean }) => boolean
        }
        if (typeof commands.insertTable === 'function') {
          return commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        }
        openLunaTableInsertPicker(editor)
        return true
      },
    },
    {
      id: 'knowledge-base',
      label: t('editor.slash.knowledgeBase'),
      aliases: ['wiki', 'link', 'doc', '文档', '文档链接', '链接', '双链', 'wikilink', '知识库', 'knowledge', 'kb'],
      run: (editor) => insertWikiLinkTrigger(editor, focusNoScroll),
    },
    {
      id: SLASH_FILE_LINK_ID,
      label: t('editor.slash.fileLink'),
      aliases: ['file', 'asset', 'attach', 'attachment', '附件', '文件', '文件链接', 'filelink', 'luna-asset'],
      run: () => true,
    },
    slashRunTiptap('footnote', t('editor.slash.footnote'), ['footnote', 'fn', 'note', '脚注', '注脚'], {
      type: 'footnoteRef',
      label: '1',
    }, runTiptapCommand),
    {
      id: 'mermaid',
      label: t('editor.slash.mermaid'),
      aliases: ['mermaid', 'mmd', '流程图', '图表'],
      run: (editor) =>
        editor
          .chain()
          .focus(null, focusNoScroll)
          .insertContent([
            {
              type: 'mermaidBlock',
              attrs: {
                source: 'graph TD\n  A[Start] --> B[End]',
              },
            },
            { type: 'paragraph' },
          ])
          .run(),
    },
    slashRunTiptap(
      'callout-tip',
      t('editor.slash.calloutTip'),
      ['tip', 'hint', '提醒', '提示', 'callout', '警告框'],
      { type: 'callout', kind: 'tip' },
      runTiptapCommand,
    ),
    slashRunTiptap(
      'callout-caution',
      t('editor.slash.calloutCaution'),
      ['caution', 'attention', '注意', '警告框'],
      { type: 'callout', kind: 'caution' },
      runTiptapCommand,
    ),
    slashRunTiptap(
      'callout-important',
      t('editor.slash.calloutImportant'),
      ['important', 'critical', '重要', '警告框'],
      { type: 'callout', kind: 'important' },
      runTiptapCommand,
    ),
    slashRunTiptap(
      'emoji',
      t('editor.slash.emoji'),
      ['emoji', 'emoticon', 'symbol', '表情', '符号', 'emoji符号'],
      { type: 'openEmojiPicker' },
      runTiptapCommand,
    ),
  ]
}

export function buildTiptapSlashMenuState(
  editor: Editor,
  shell: HTMLElement,
  commands: readonly SlashCommandItem[],
): SlashMenuState | null {
  const state = editor.state
  const { selection } = state
  if (!selection.empty) return null
  if (editor.view.composing || isCodeEditGuardActive(state) || isSelectionInsideTableCell(editor)) return null
  const { $from } = selection
  if ($from.parent.type.name !== 'paragraph') return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const hit = /(?:^|\s)\/([a-zA-Z0-9\u4e00-\u9fa5-_]*)$/u.exec(textBefore)
  if (!hit) return null

  const query = (hit[1] ?? '').trim().toLowerCase()
  const startOffset = textBefore.length - hit[0].length + (hit[0].startsWith('/') ? 0 : 1)
  const from = $from.start() + startOffset
  const to = $from.pos
  const rows = buildSlashMenuRows(commands, query)
  if (!rows.length) return null

  const pos = Math.max(1, Math.min(to, state.doc.content.size))
  const caretRect = editor.view.coordsAtPos(pos)
  const shellRect = shell.getBoundingClientRect()
  const { left, top, placement, maxHeight } = computeSlashMenuPosition(caretRect, shellRect, rows.length)
  return {
    from,
    to,
    query,
    left,
    top,
    placement,
    maxHeight,
    rows,
    activeIndex: firstExecutableSlashRowIndex(rows),
  }
}

export function buildTiptapWikiLinkMenuState(editor: Editor, shell: HTMLElement): WikiLinkMenuState | null {
  const state = editor.state
  const { selection } = state
  if (!selection.empty) return null
  if (editor.view.composing || isCodeEditGuardActive(state) || isSelectionInsideTableCell(editor)) return null
  const { $from } = selection
  if (!$from.parent.isTextblock) return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const match = matchWikiLinkSuggestInText(textBefore, $from.start())
  if (!match) return null

  const items = searchWikiLinkSuggestCandidates(match.query, { limit: 8 })
  const pos = Math.max(1, Math.min(match.replaceTo, state.doc.content.size))
  const caretRect = editor.view.coordsAtPos(pos)
  const shellRect = shell.getBoundingClientRect()
  const { left, top, placement, maxHeight } = computeSuggestMenuPosition(caretRect, shellRect, items.length)
  return {
    replaceFrom: match.replaceFrom,
    replaceTo: match.replaceTo,
    embed: match.embed,
    query: match.query,
    left,
    top,
    placement,
    maxHeight,
    items,
    activeIndex: 0,
  }
}
