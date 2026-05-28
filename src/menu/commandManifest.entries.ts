import type { CommandGroup, CommandManifestEntry, CommandRuntimeKind, CommandUiMeta } from './commandManifest.types'

type DefOpts = {
  group?: CommandGroup
  icon?: string
  accelerator?: string
  runtime?: CommandRuntimeKind
  action?: string
  ui?: CommandUiMeta
  nativeAcceleratorExcluded?: boolean
}

function inferGroup(id: string): CommandGroup {
  if (id.startsWith('file-') || id === 'save' || id === 'preferences' || id === 'open-folder') return 'file'
  if (id.startsWith('edit-')) return 'edit'
  if (id.startsWith('fmt-')) return 'formatting'
  if (id.startsWith('para-')) return 'paragraph'
  if (id.startsWith('toggle-') || id.startsWith('view-')) return 'view'
  if (id.startsWith('win-')) return 'window'
  if (id.startsWith('help-')) return 'system'
  return 'system'
}

function def(id: string, labelKey: string, opts: DefOpts = {}): CommandManifestEntry {
  const ui: CommandUiMeta = { menu: true, ...opts.ui }
  return Object.freeze({
    id,
    labelKey,
    icon: opts.icon,
    accelerator: opts.accelerator,
    group: opts.group ?? inferGroup(id),
    runtime: opts.runtime ?? 'menu',
    action: opts.action,
    ui,
    nativeAcceleratorExcluded: opts.nativeAcceleratorExcluded,
  })
}

const M = (ui?: CommandUiMeta) => ui ?? {}

/** Command Manifest — Single Source of Truth (labelKey/icon/accelerator/runtime/ui)*/
export const COMMAND_MANIFEST_LIST: readonly CommandManifestEntry[] = Object.freeze([
  def('file-new', 'menu.file.new', {
    accelerator: 'Mod+n',
    ui: M({ palette: true, paletteKeywords: ['new', 'xin', '新建'] }),
  }),
  def('file-new-tab', 'menu.file.newTab'),
  def('file-new-window', 'menu.file.newWindow', { accelerator: 'Mod+Shift+n' }),
  def('file-open-file', 'menu.file.openFile', { accelerator: 'Mod+o' }),
  def('open-folder', 'menu.file.openFolder', { ui: M({ toolbar: true, toolbarSlot: 'sidebar-header' }) }),
  def('file-recent-placeholder', 'menu.file.recent'),
  def('file-show-intro', 'menu.file.showIntro'),
  def('file-reveal', 'menu.file.openLocation'),
  def('file-delete', 'menu.file.delete'),
  def('file-close', 'menu.file.close', { accelerator: 'Mod+w', runtime: 'app-close-tab' }),
  def('file-close-workspace', 'menu.file.closeWorkspace'),
  def('save', 'menu.file.save', {
    accelerator: 'Mod+s',
    runtime: 'app-save',
    ui: M({ palette: true, paletteKeywords: ['save', 'cun', '保存'] }),
  }),
  def('file-save-as', 'menu.file.saveAs', { accelerator: 'Mod+Shift+s', runtime: 'app-save-as' }),
  def('app-quit', 'menu.native.app.quit', { runtime: 'app-quit', ui: M({ menu: false }) }),
  def('file-copy-path', 'menu.file.copyPath'),
  def('file-rename', 'menu.file.rename'),
  def('file-revert', 'menu.file.revert'),
  def('file-save-all', 'menu.file.saveAll'),
  def('file-import', 'menu.file.import'),
  def('file-export-pdf', 'menu.file.export.pdf', { ui: M({ palette: true, paletteKeywords: ['pdf', '导出'] }) }),
  def('file-export-markdown', 'commandPalette.exportMd', {
    action: 'file-export-markdown',
    ui: M({ menu: false, palette: true, paletteKeywords: ['markdown', 'md', '导出'] }),
  }),
  def('file-export-html', 'menu.file.export.html', { ui: M({ palette: true, paletteKeywords: ['html', '导出'] }) }),
  def('file-export-html-plain', 'menu.file.export.htmlPlain', { ui: M({ palette: true }) }),
  def('file-export-image', 'menu.file.export.image', { ui: M({ palette: true, paletteKeywords: ['png', 'image', '图片'] }) }),
  def('file-export-word', 'menu.file.export.word', { ui: M({ palette: true, paletteKeywords: ['word', 'docx'] }) }),
  def('preferences', 'menu.file.preferences', { accelerator: 'Mod+,', runtime: 'app-preferences' }),
  def('file-print', 'menu.file.print'),

  def('edit-undo', 'menu.edit.undo', { icon: '↶', accelerator: 'Mod+z' }),
  def('edit-redo', 'menu.edit.redo', { icon: '↷', accelerator: 'Mod+Shift+z' }),
  def('edit-cut', 'menu.edit.cut', { icon: '✂', accelerator: 'Mod+x' }),
  def('edit-copy', 'menu.edit.copy', { icon: '⧉', accelerator: 'Mod+c' }),
  def('edit-paste', 'menu.edit.paste', { icon: '📋', accelerator: 'Mod+v' }),
  def('edit-copy-plain', 'menu.edit.copyPlain'),
  def('edit-copy-md', 'menu.edit.copyMd'),
  def('edit-copy-html', 'menu.edit.copyHtml'),
  def('edit-paste-plain', 'menu.edit.pastePlain'),
  def('edit-select-all', 'menu.edit.selectAll', { accelerator: 'Mod+a' }),
  def('edit-select-block', 'menu.edit.selectBlock'),
  def('edit-delete', 'menu.edit.delete'),
  def('edit-delete-block', 'menu.edit.deleteBlock'),
  def('edit-delete-line', 'menu.edit.deleteLine'),
  def('edit-eol-crlf', 'menu.edit.eol.crlf', { runtime: 'noop' }),
  def('edit-eol-lf', 'menu.edit.eol.lf', { runtime: 'noop' }),
  def('edit-indent-first-line', 'menu.edit.indentFirst', { runtime: 'noop' }),
  def('edit-show-br', 'menu.edit.showBr', { runtime: 'noop' }),
  def('edit-find', 'menu.edit.find.find', { accelerator: 'Mod+f', action: 'edit-find', ui: M({ palette: true }) }),
  def('edit-find-prev', 'menu.edit.find.prev', { accelerator: 'Shift+F3' }),
  def('edit-find-next', 'menu.edit.find.next', { accelerator: 'F3' }),
  def('edit-find-replace', 'menu.edit.find.replace', { accelerator: 'Mod+h' }),
  def('edit-replace-next', 'menu.edit.find.replaceNext'),
  def('edit-jump-to-selection', 'menu.edit.find.jumpSel'),
  def('edit-emoji', 'menu.edit.emoji', { ui: M({ palette: true, paletteKeywords: ['emoji', '表情', '符号'] }) }),

  def('para-h1', 'menu.para.h1', { icon: 'H1', accelerator: 'Mod+1' }),
  def('para-h2', 'menu.para.h2', { icon: 'H2', accelerator: 'Mod+2' }),
  def('para-h3', 'menu.para.h3', { icon: 'H3', accelerator: 'Mod+3' }),
  def('para-h4', 'menu.para.h4', { icon: 'H4', accelerator: 'Mod+4' }),
  def('para-h5', 'menu.para.h5', { icon: 'H5', accelerator: 'Mod+5' }),
  def('para-h6', 'menu.para.h6', { icon: 'H6', accelerator: 'Mod+6' }),
  def('para-paragraph', 'menu.para.para', { accelerator: 'Mod+0' }),
  def('para-heading-up', 'menu.para.headingUp'),
  def('para-heading-down', 'menu.para.headingDown'),
  def('para-table-insert', 'menu.para.table.insert', {
    accelerator: 'Mod+t',
    group: 'insert',
    ui: M({ palette: true, paletteKeywords: ['table', '表格'] }),
  }),
  def('para-table-row-above', 'menu.para.table.rowUp'),
  def('para-table-row-below', 'menu.para.table.rowDown'),
  def('para-math-block', 'menu.para.math', { accelerator: 'Mod+Shift+m', group: 'insert' }),
  def('para-insert-code-block', 'menu.para.code', { accelerator: 'Mod+Shift+k', group: 'insert' }),
  def('para-code-copy', 'menu.para.codeTools.copy'),
  def('para-code-tools-indent-selection', 'menu.para.codeTools.indentSel'),
  def('para-code-tools-indent-block', 'menu.para.codeTools.indentBlock'),
  def('para-callout-tip', 'menu.para.callout.tip', { group: 'insert' }),
  def('para-callout-suggestion', 'menu.para.callout.suggestion', { group: 'insert' }),
  def('para-callout-important', 'menu.para.callout.important', { group: 'insert' }),
  def('para-callout-warning', 'menu.para.callout.warning', { group: 'insert' }),
  def('para-callout-caution', 'menu.para.callout.caution', { group: 'insert' }),
  def('para-quote', 'menu.para.quote', { icon: '❝', accelerator: 'Mod+Shift+q' }),
  def('para-ol', 'menu.para.ol', { accelerator: 'Mod+Shift+]' }),
  def('para-ul', 'menu.para.ul', { accelerator: 'Mod+Shift+[' }),
  def('para-task', 'menu.para.task', { accelerator: 'Mod+Shift+x' }),
  def('para-task-done', 'menu.para.task.done'),
  def('para-task-undone', 'menu.para.task.undone'),
  def('para-list-indent-more', 'menu.para.listIndent.more'),
  def('para-list-indent-less', 'menu.para.listIndent.less'),
  def('para-insert-paragraph-above', 'menu.para.insertAbove'),
  def('para-insert-paragraph-below', 'menu.para.insertBelow'),
  def('para-link-ref', 'menu.para.linkRef', { accelerator: 'Mod+Alt+k', group: 'insert' }),
  def('para-footnote', 'menu.para.footnote', { group: 'insert' }),
  def('para-hr', 'menu.para.hr', { group: 'insert' }),
  def('para-toc', 'menu.para.toc', { group: 'insert' }),

  def('fmt-bold', 'menu.fmt.bold', { icon: 'B', accelerator: 'Mod+b', ui: M({ toolbar: true, toolbarSlot: 'editor-format' }) }),
  def('fmt-italic', 'menu.fmt.italic', { icon: 'I', accelerator: 'Mod+i', ui: M({ toolbar: true, toolbarSlot: 'editor-format' }) }),
  def('fmt-underline', 'menu.fmt.underline', {
    accelerator: 'Mod+u',
    ui: M({ toolbar: true, toolbarSlot: 'editor-format' }),
  }),
  def('fmt-inline-code', 'menu.fmt.code', {
    icon: '</>',
    accelerator: 'Mod+Shift+`',
    ui: M({ toolbar: true, toolbarSlot: 'editor-format' }),
  }),
  def('fmt-inline-math', 'menu.fmt.inlineMath'),
  def('fmt-strike', 'menu.fmt.strike', {
    icon: 'S',
    accelerator: 'Alt+Shift+5',
    ui: M({ toolbar: true, toolbarSlot: 'editor-format' }),
  }),
  def('fmt-comment', 'menu.fmt.comment'),
  def('fmt-link', 'menu.fmt.link', { accelerator: 'Mod+k', ui: M({ toolbar: true, toolbarSlot: 'editor-format' }) }),
  def('fmt-link-open', 'menu.fmt.linkOpen'),
  def('fmt-link-copy', 'menu.fmt.linkCopy'),
  def('fmt-image', 'menu.fmt.image.insert', { accelerator: 'Mod+Shift+i', action: 'fmt-image', group: 'insert' }),
  def('fmt-image-insert-local', 'menu.fmt.image.insertLocal', { group: 'insert' }),
  def('fmt-image-reveal', 'menu.fmt.image.reveal'),
  def('fmt-image-zoom-25', 'menu.fmt.image.zoom.25'),
  def('fmt-image-zoom-33', 'menu.fmt.image.zoom.33'),
  def('fmt-image-zoom-50', 'menu.fmt.image.zoom.50'),
  def('fmt-image-zoom-60', 'menu.fmt.image.zoom.60'),
  def('fmt-image-zoom-80', 'menu.fmt.image.zoom.80'),
  def('fmt-image-zoom-100', 'menu.fmt.image.zoom.100'),
  def('fmt-image-zoom-120', 'menu.fmt.image.zoom.120'),
  def('fmt-image-zoom-150', 'menu.fmt.image.zoom.150'),
  def('fmt-image-as-html', 'menu.fmt.image.conv.html'),
  def('fmt-image-as-md', 'menu.fmt.image.conv.md'),
  def('fmt-image-delete', 'menu.fmt.image.delete'),
  def('fmt-image-copy-to', 'menu.fmt.image.copyTo'),
  def('fmt-image-rename', 'menu.fmt.image.rename', { runtime: 'noop' }),
  def('fmt-image-upload', 'menu.fmt.image.upload'),
  def('fmt-image-copy-all', 'menu.fmt.image.copyAll'),
  def('fmt-image-move-all', 'menu.fmt.image.moveAll'),
  def('fmt-image-upload-all-local', 'menu.fmt.image.uploadAll'),
  def('fmt-image-reload-all', 'menu.fmt.image.reloadAll'),
  def('fmt-image-on-insert-copy', 'menu.fmt.image.onInsert.copy'),
  def('fmt-image-on-insert-upload', 'menu.fmt.image.onInsert.upload'),
  def('fmt-image-root-dir', 'menu.fmt.image.root'),
  def('fmt-image-global-settings', 'menu.fmt.image.global'),
  def('fmt-clear-style', 'menu.fmt.clear', { accelerator: 'Mod+\\' }),

  def('toggle-source-mode', 'menu.view.source', {
    accelerator: 'Mod+/',
    runtime: 'app-mode-toggle',
    ui: M({ palette: true, paletteKeywords: ['source', '源码', 'wysiwyg'], toolbar: true, toolbarSlot: 'sidebar-header' }),
  }),
  def('toggle-focus', 'menu.view.focus', { accelerator: 'F8', runtime: 'app-focus-mode', ui: M({ palette: true }) }),
  def('command-palette-open', 'menu.palette.open', {
    accelerator: 'Mod+Shift+p',
    action: 'command-palette-open',
    group: 'view',
    ui: M({ menu: false }),
  }),
  def('command-palette-open-alt', 'menu.palette.open', {
    accelerator: 'F1',
    action: 'command-palette-open',
    group: 'view',
    ui: M({ menu: false }),
  }),
  def('view-zoom-in', 'menu.view.zoomIn', { accelerator: 'Mod+=', runtime: 'menu' }),
  def('view-zoom-out', 'menu.view.zoomOut', { accelerator: 'Mod+-', runtime: 'menu' }),
  def('toggle-sidebar', 'menu.view.sidebar', { ui: M({ palette: true }) }),
  def('view-sidebar-outline', 'menu.view.outline', { action: 'toggle-sidebar-outline', ui: M({ palette: true }) }),
  def('view-sidebar-files', 'menu.view.docList', { action: 'toggle-sidebar-files' }),
  def('view-search', 'menu.view.search', {
    accelerator: 'Mod+Shift+f',
    action: 'view-search',
    ui: M({ palette: true, paletteKeywords: ['search', '搜索', 'find', '全局'] }),
  }),
  def('view-word-count', 'menu.view.wordCount'),
  def('view-fullscreen', 'menu.view.fullscreen', { accelerator: 'F11', runtime: 'menu' }),
  def('view-live-preview', 'menu.view.livePreview', { action: 'view-live-preview' }),

  def('win-minimize', 'menu.win.min'),
  def('win-zoom', 'menu.win.zoom'),
  def('win-move-resize-half-left', 'menu.win.half.left'),
  def('win-move-resize-half-right', 'menu.win.half.right'),
  def('win-move-resize-half-top', 'menu.win.half.top'),
  def('win-move-resize-half-bottom', 'menu.win.half.bottom'),
  def('win-tile-full', 'menu.win.tile'),

  def('help-about', 'menu.native.help.about', {
    ui: M({ palette: true, paletteKeywords: ['about', '关于'] }),
  }),
  def('help-privacy', 'menu.native.help.privacy', { ui: M({ menu: false }) }),
  def('help-website', 'menu.native.help.website', { ui: M({ menu: false }) }),
  def('help-feedback', 'menu.native.help.feedback', { ui: M({ menu: false }) }),
])

export const COMMAND_MANIFEST: Readonly<Record<string, CommandManifestEntry>> = Object.freeze(
  Object.fromEntries(COMMAND_MANIFEST_LIST.map((e) => [e.id, e])),
)
