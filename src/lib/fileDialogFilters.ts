import type { TranslateFn } from '../i18n'

export type FileDialogFilterKind = 'markdown' | 'pdf' | 'html' | 'png' | 'word' | 'svg' | 'files'

const FILTER_KEY: Record<FileDialogFilterKind, string> = {
  markdown: 'app.dialog.filter.markdown',
  pdf: 'app.dialog.filter.pdf',
  html: 'app.dialog.filter.html',
  png: 'app.dialog.filter.png',
  word: 'app.dialog.filter.word',
  svg: 'app.dialog.filter.svg',
  files: 'app.dialog.filter.files',
}

export function fileDialogFilter(
  t: TranslateFn,
  kind: FileDialogFilterKind,
  extensions: string[],
): { name: string; extensions: string[] } {
  return { name: t(FILTER_KEY[kind]), extensions }
}
