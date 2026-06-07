import type { EphemeralCommandType } from '../editor/ephemeralFormatting'
import { LUNA_TEXT_COLOR_PRESETS } from '../editor/lunaTextColor'
import type { EditorContext } from './commandContext'
import { isCodeGuardedContext } from './commandContext'
import type { CommandResolver, ResolvedCommand } from './commandResolution.types'
import type { SourceEditorOp } from './commandOps.types'
import type { TiptapEditorCommand } from '../editor/TiptapMarkdownEditor'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Insert placeholder into empty selection (aligned with slash command semantics)*/
export const EPHEMERAL_EMPTY_SELECTION_PLACEHOLDER: Record<EphemeralCommandType, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  code: 'code',
  highlight: 'text',
}

function noop(commandId: string, reason: string): ResolvedCommand {
  return { kind: 'noop', reason, commandId }
}

/** For non-editor change commands, use dispatchAppMenuAction directly.*/
function delegateApp(commandId: string, action?: string): CommandResolver {
  const resolved: ResolvedCommand = { kind: 'delegate-app', commandId, action: action ?? commandId }
  return () => resolved
}

// ─────────────────────────────────────────────────────────────
//Inline format (ephemeral)
// ─────────────────────────────────────────────────────────────

function resolveFmtEphemeral(mark: EphemeralCommandType, commandId: string): CommandResolver {
  return (ctx: EditorContext): ResolvedCommand => {
    if (ctx.isReadonly) return noop(commandId, 'readonly')
    if (isCodeGuardedContext(ctx)) return noop(commandId, 'code-guard')
    if (ctx.mode === 'source') return { kind: 'source-ephemeral', commandId, mark }
    const placeholder = ctx.selectionEmpty ? EPHEMERAL_EMPTY_SELECTION_PLACEHOLDER[mark] : undefined
    return { kind: 'tiptap-ephemeral', commandId, mark, placeholder }
  }
}

// ─────────────────────────────────────────────────────────────
//Universal editor commands (visual + source code dual paths)
// ─────────────────────────────────────────────────────────────

function resolveEditorCommand(
  commandId: string,
  visualCommand: TiptapEditorCommand,
  sourceOp: SourceEditorOp,
  options?: { allowInCode?: boolean; noReadonlyCheck?: boolean },
): CommandResolver {
  return (ctx: EditorContext): ResolvedCommand => {
    if (!options?.noReadonlyCheck && ctx.isReadonly) return noop(commandId, 'readonly')
    if (!options?.allowInCode && isCodeGuardedContext(ctx)) return noop(commandId, 'code-guard')
    if (ctx.mode === 'source') return { kind: 'source-command', commandId, op: sourceOp }
    return { kind: 'tiptap-command', commandId, command: visualCommand }
  }
}

function resolveFmtTextColor(color: string | null, commandId: string): CommandResolver {
  return (ctx: EditorContext): ResolvedCommand => {
    if (ctx.isReadonly) return noop(commandId, 'readonly')
    if (isCodeGuardedContext(ctx)) return noop(commandId, 'code-guard')
    if (ctx.selectionEmpty) return noop(commandId, 'empty-selection')
    if (ctx.mode === 'source') {
      return { kind: 'source-command', commandId, op: { kind: 'set-text-color', color } }
    }
    return { kind: 'tiptap-command', commandId, command: { type: 'setTextColor', color } }
  }
}

const FMT_TEXT_COLOR_RESOLVERS: Record<string, CommandResolver> = Object.fromEntries([
  ...LUNA_TEXT_COLOR_PRESETS.map(
    (preset) =>
      [`fmt-text-color-${preset.id}`, resolveFmtTextColor(preset.value, `fmt-text-color-${preset.id}`)] as const,
  ),
  ['fmt-text-color-default', resolveFmtTextColor(null, 'fmt-text-color-default')],
])

// ─────────────────────────────────────────────────────────────
// COMMAND_RESOLUTION_REGISTRY
//Each commandId must register a resolver here or mark runtime:'noop' in the manifest
// ─────────────────────────────────────────────────────────────

export const COMMAND_RESOLUTION_REGISTRY: Record<string, CommandResolver> = {
  //── Inline format ───────────────────────────────────────────
  'fmt-bold': resolveFmtEphemeral('bold', 'fmt-bold'),
  'fmt-italic': resolveFmtEphemeral('italic', 'fmt-italic'),
  'fmt-underline': resolveFmtEphemeral('underline', 'fmt-underline'),
  'fmt-strike': resolveFmtEphemeral('strike', 'fmt-strike'),
  'fmt-highlight': resolveFmtEphemeral('highlight', 'fmt-highlight'),
  'fmt-inline-code': resolveFmtEphemeral('code', 'fmt-inline-code'),

  //── Inline / block format ───────────────────────────────────────
  'fmt-link': resolveEditorCommand('fmt-link', { type: 'link' }, { kind: 'insert-link' }),
  'fmt-image': delegateApp('fmt-image'),
  'fmt-image-insert-local': delegateApp('fmt-image-insert-local'),
  'fmt-inline-math': resolveEditorCommand('fmt-inline-math', { type: 'inlineMath' }, { kind: 'surround-selection', left: '$', right: '$' }),
  'fmt-comment': resolveEditorCommand('fmt-comment', { type: 'comment' }, { kind: 'surround-selection', left: '<!-- ', right: ' -->' }),
  'fmt-clear-style': resolveEditorCommand('fmt-clear-style', { type: 'clearFormatting' }, { kind: 'strip-common-marks' }, { allowInCode: true }),
  ...FMT_TEXT_COLOR_RESOLVERS,

  //fmt-link-open / fmt-link-copy: non-editor changes, go directly to dispatchAppMenuAction
  'fmt-link-open': delegateApp('fmt-link-open'),
  'fmt-link-copy': delegateApp('fmt-link-copy'),

  // fmt-image-zoom-* delegate-app (image display preference, not editor mutation)
  'fmt-image-zoom-25': delegateApp('fmt-image-zoom-25'),
  'fmt-image-zoom-33': delegateApp('fmt-image-zoom-33'),
  'fmt-image-zoom-50': delegateApp('fmt-image-zoom-50'),
  'fmt-image-zoom-60': delegateApp('fmt-image-zoom-60'),
  'fmt-image-zoom-80': delegateApp('fmt-image-zoom-80'),
  'fmt-image-zoom-100': delegateApp('fmt-image-zoom-100'),
  'fmt-image-zoom-120': delegateApp('fmt-image-zoom-120'),
  'fmt-image-zoom-150': delegateApp('fmt-image-zoom-150'),

  //fmt-image-* non-content operations, delegate-app
  'fmt-image-delete': delegateApp('fmt-image-delete'),
  'fmt-image-as-html': delegateApp('fmt-image-as-html'),
  'fmt-image-as-md': delegateApp('fmt-image-as-md'),
  'fmt-image-reveal': delegateApp('fmt-image-reveal'),
  'fmt-image-copy-all': delegateApp('fmt-image-copy-all'),
  'fmt-image-copy-to': delegateApp('fmt-image-copy-to'),
  'fmt-image-upload': delegateApp('fmt-image-upload'),
  'fmt-image-upload-all-local': delegateApp('fmt-image-upload-all-local'),
  'fmt-image-move-all': delegateApp('fmt-image-move-all'),
  'fmt-image-reload-all': delegateApp('fmt-image-reload-all'),
  'fmt-image-on-insert-copy': delegateApp('fmt-image-on-insert-copy'),
  'fmt-image-on-insert-upload': delegateApp('fmt-image-on-insert-upload'),
  'fmt-image-root-dir': delegateApp('fmt-image-root-dir'),
  'fmt-image-global-settings': delegateApp('fmt-image-global-settings'),
  // fmt-image-zoom-* handled by prefix match in executeManifestCommand
  'fmt-image-rename': delegateApp('fmt-image-rename'),

  //──Paragraph ─────────────────────────────────────────────
  'para-h1': resolveEditorCommand('para-h1', { type: 'heading', level: 1 }, { kind: 'insert-prefix-line', prefix: '# ' }),
  'para-h2': resolveEditorCommand('para-h2', { type: 'heading', level: 2 }, { kind: 'insert-prefix-line', prefix: '## ' }),
  'para-h3': resolveEditorCommand('para-h3', { type: 'heading', level: 3 }, { kind: 'insert-prefix-line', prefix: '### ' }),
  'para-h4': resolveEditorCommand('para-h4', { type: 'heading', level: 4 }, { kind: 'insert-prefix-line', prefix: '#### ' }),
  'para-h5': resolveEditorCommand('para-h5', { type: 'heading', level: 5 }, { kind: 'insert-prefix-line', prefix: '##### ' }),
  'para-h6': resolveEditorCommand('para-h6', { type: 'heading', level: 6 }, { kind: 'insert-prefix-line', prefix: '###### ' }),
  'para-paragraph': resolveEditorCommand('para-paragraph', { type: 'paragraph' }, { kind: 'insert-literal', text: '\n\n' }),
  'para-heading-up': resolveEditorCommand('para-heading-up', { type: 'headingLevelDelta', delta: -1 }, { kind: 'heading-level-delta', delta: -1 }),
  'para-heading-down': resolveEditorCommand('para-heading-down', { type: 'headingLevelDelta', delta: 1 }, { kind: 'heading-level-delta', delta: 1 }),
  'para-quote': resolveEditorCommand('para-quote', { type: 'blockquote' }, { kind: 'insert-prefix-line', prefix: '> ' }),
  'para-ul': resolveEditorCommand('para-ul', { type: 'bulletList' }, { kind: 'insert-prefix-line', prefix: '- ' }),
  'para-ol': resolveEditorCommand('para-ol', { type: 'orderedList' }, { kind: 'insert-prefix-line', prefix: '1. ' }),
  'para-task': resolveEditorCommand('para-task', { type: 'taskList' }, { kind: 'insert-prefix-line', prefix: '- [ ] ' }),
  'para-task-done': resolveEditorCommand('para-task-done', { type: 'taskList' }, { kind: 'toggle-task-done', done: true }),
  'para-task-undone': resolveEditorCommand('para-task-undone', { type: 'taskList' }, { kind: 'toggle-task-done', done: false }),
  'para-list-indent-more': resolveEditorCommand('para-list-indent-more', { type: 'indentCodeSelection' }, { kind: 'indent-more' }),
  'para-list-indent-less': resolveEditorCommand('para-list-indent-less', { type: 'indentCodeBlock' }, { kind: 'indent-less' }),
  'para-insert-paragraph-above': resolveEditorCommand('para-insert-paragraph-above', { type: 'insertParagraphAbove' }, { kind: 'insert-paragraph-above' }, { allowInCode: true }),
  'para-insert-paragraph-below': resolveEditorCommand('para-insert-paragraph-below', { type: 'insertParagraphBelow' }, { kind: 'insert-paragraph-below' }, { allowInCode: true }),
  'para-insert-code-block': resolveEditorCommand('para-insert-code-block', { type: 'codeBlock', language: 'text' }, { kind: 'insert-code-fence', language: 'text' }, { allowInCode: true }),
  'para-table-insert': resolveEditorCommand('para-table-insert', { type: 'insertTablePicker' }, { kind: 'insert-table' }, { allowInCode: true }),
  'para-table-row-above': resolveEditorCommand('para-table-row-above', { type: 'paragraph' }, { kind: 'insert-table-row', direction: 'above' }),
  'para-table-row-below': resolveEditorCommand('para-table-row-below', { type: 'paragraph' }, { kind: 'insert-table-row', direction: 'below' }),
  'para-math-block': resolveEditorCommand('para-math-block', { type: 'blockMath' }, { kind: 'surround-selection', left: '$$\n', right: '\n$$' }),
  'para-callout-tip': resolveEditorCommand('para-callout-tip', { type: 'callout', kind: 'tip' }, { kind: 'insert-prefix-line', prefix: '> [!TIP]\n> ' }),
  'para-callout-suggestion': resolveEditorCommand('para-callout-suggestion', { type: 'callout', kind: 'note' }, { kind: 'insert-prefix-line', prefix: '> [!NOTE]\n> ' }),
  'para-callout-important': resolveEditorCommand('para-callout-important', { type: 'callout', kind: 'important' }, { kind: 'insert-prefix-line', prefix: '> [!IMPORTANT]\n> ' }),
  'para-callout-warning': resolveEditorCommand('para-callout-warning', { type: 'callout', kind: 'warning' }, { kind: 'insert-prefix-line', prefix: '> [!WARNING]\n> ' }),
  'para-callout-caution': resolveEditorCommand('para-callout-caution', { type: 'callout', kind: 'caution' }, { kind: 'insert-prefix-line', prefix: '> [!CAUTION]\n> ' }),
  'para-link-ref': resolveEditorCommand('para-link-ref', { type: 'linkReference' }, { kind: 'insert-reference-def' }),
  'para-footnote': resolveEditorCommand('para-footnote', { type: 'footnoteRef', label: '1' }, { kind: 'insert-literal', text: '[^1]' }),
  'para-hr': resolveEditorCommand('para-hr', { type: 'horizontalRule' }, { kind: 'insert-literal', text: '\n---\n' }),
  'para-toc': resolveEditorCommand('para-toc', { type: 'tocDirective' }, { kind: 'insert-literal', text: '\n[TOC]\n' }),
  'para-code-copy': resolveEditorCommand('para-code-copy', { type: 'copyCodeBlock' }, { kind: 'select-block' }, { allowInCode: true }),
  'para-code-tools-indent-selection': resolveEditorCommand('para-code-tools-indent-selection', { type: 'indentCodeSelection' }, { kind: 'indent-more' }, { allowInCode: true }),
  'para-code-tools-indent-block': resolveEditorCommand('para-code-tools-indent-block', { type: 'indentCodeBlock' }, { kind: 'indent-more' }, { allowInCode: true }),

  //──Edit ──────────────────────────────────────────────
  'edit-undo': delegateApp('edit-undo'),    //go undoLastTransaction → native undo fallback
  'edit-redo': delegateApp('edit-redo'),    //go redoLastTransaction → native redo fallback
  'edit-cut': delegateApp('edit-cut'),
  'edit-copy': delegateApp('edit-copy'),
  'edit-paste': delegateApp('edit-paste'),
  'edit-copy-plain': delegateApp('edit-copy-plain'),
  'edit-copy-md': delegateApp('edit-copy-md'),
  'edit-copy-html': delegateApp('edit-copy-html'),
  'edit-paste-plain': delegateApp('edit-paste-plain'),
  'edit-select-all': resolveEditorCommand('edit-select-all', { type: 'selectAll' }, { kind: 'select-all' }, { allowInCode: true }),
  'edit-select-block': resolveEditorCommand('edit-select-block', { type: 'selectAll' }, { kind: 'select-block' }, { allowInCode: true }),
  'edit-delete': resolveEditorCommand('edit-delete', { type: 'deleteSelection' }, { kind: 'delete-selection' }, { allowInCode: true }),
  'edit-delete-block': resolveEditorCommand('edit-delete-block', { type: 'deleteSelection' }, { kind: 'select-block' }, { allowInCode: true }),
  'edit-delete-line': resolveEditorCommand('edit-delete-line', { type: 'deleteSelection' }, { kind: 'delete-line' }, { allowInCode: true }),
  'edit-find': delegateApp('edit-find'),
  'edit-find-prev': delegateApp('edit-find-prev'),
  'edit-find-next': delegateApp('edit-find-next'),
  'edit-find-replace': delegateApp('edit-find-replace'),
  'edit-replace-next': delegateApp('edit-replace-next'),
  'edit-jump-to-selection': delegateApp('edit-jump-to-selection'),

  'edit-eol-crlf': delegateApp('edit-eol-crlf'),
  'edit-eol-lf': delegateApp('edit-eol-lf'),
  'edit-indent-first-line': delegateApp('edit-indent-first-line'),
  'edit-show-br': delegateApp('edit-show-br'),
  'edit-emoji': resolveEditorCommand('edit-emoji', { type: 'openEmojiPicker' }, { kind: 'open-emoji-picker' }),

  //── View/Window/Document (all delegate-app) ─────────────────
  'preferences': delegateApp('preferences'),
  'save': delegateApp('save'),
  'file-save-as': delegateApp('file-save-as'),
  'app-quit': delegateApp('app-quit'),
  'file-new': delegateApp('file-new'),
  'file-new-from-template': delegateApp('file-new-from-template'),
  'file-new-tab': delegateApp('file-new-tab'),
  'file-new-window': delegateApp('file-new-window'),
  'daily-note-open': delegateApp('daily-note-open'),
  'daily-note-open-yesterday': delegateApp('daily-note-open-yesterday'),
  'daily-note-open-tomorrow': delegateApp('daily-note-open-tomorrow'),
  'template-edit-default': delegateApp('template-edit-default'),
  'template-edit-daily': delegateApp('template-edit-daily'),
  'template-open-folder': delegateApp('template-open-folder'),
  'template-preferences': delegateApp('template-preferences'),
  'file-open-file': delegateApp('file-open-file'),
  'open-folder': delegateApp('open-folder'),
  'file-recent-placeholder': delegateApp('file-recent-placeholder'),
  'file-clear-recent': delegateApp('file-clear-recent'),
  'file-close': delegateApp('file-close'),
  'file-close-workspace': delegateApp('file-close-workspace'),
  'file-show-intro': delegateApp('file-show-intro'),
  'file-reveal': delegateApp('file-reveal'),
  'file-delete': delegateApp('file-delete'),
  'file-copy-path': delegateApp('file-copy-path'),
  'file-rename': delegateApp('file-rename'),
  'file-history-open': delegateApp('file-history-open'),
  'file-history-create-snapshot': delegateApp('file-history-create-snapshot'),
  'file-revert': delegateApp('file-revert'),
  'file-save-all': delegateApp('file-save-all'),
  'file-import': delegateApp('file-import'),
  'file-export-pdf': delegateApp('file-export-pdf'),
  'file-export-markdown': delegateApp('file-export-markdown'),
  'file-export-html': delegateApp('file-export-html'),
  'file-export-html-plain': delegateApp('file-export-html-plain'),
  'file-export-image': delegateApp('file-export-image'),
  'file-export-word': delegateApp('file-export-word'),
  'file-print': delegateApp('file-print'),
  'command-palette-open': delegateApp('command-palette-open'),
  'command-palette-open-alt': delegateApp('command-palette-open'),
  'toggle-source-mode': delegateApp('toggle-source-mode'),
  'toggle-focus': delegateApp('toggle-focus'),
  'toggle-sidebar': delegateApp('toggle-sidebar'),
  'view-sidebar-outline': delegateApp('view-sidebar-outline', 'toggle-sidebar-outline'),
  'view-sidebar-files': delegateApp('view-sidebar-files', 'toggle-sidebar-files'),
  'view-search': delegateApp('view-search'),
  'view-word-count': delegateApp('view-word-count'),
  'view-fullscreen': delegateApp('view-fullscreen'),
  'view-zoom-in': delegateApp('view-zoom-in'),
  'view-zoom-out': delegateApp('view-zoom-out'),
  'view-live-preview': delegateApp('view-live-preview'),
  'win-minimize': delegateApp('win-minimize'),
  'win-zoom': delegateApp('win-zoom'),
  'win-move-resize-half-left': delegateApp('win-move-resize-half-left'),
  'win-move-resize-half-right': delegateApp('win-move-resize-half-right'),
  'win-move-resize-half-top': delegateApp('win-move-resize-half-top'),
  'win-move-resize-half-bottom': delegateApp('win-move-resize-half-bottom'),
  'win-tile-full': delegateApp('win-tile-full'),
  'help-shortcuts': delegateApp('help-shortcuts'),
  'help-about': delegateApp('help-about'),
  'help-privacy': delegateApp('help-privacy'),
  'help-website': delegateApp('help-website'),
  'help-feedback': delegateApp('help-feedback'),
}

export function hasCommandResolver(commandId: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMMAND_RESOLUTION_REGISTRY, commandId)
}
