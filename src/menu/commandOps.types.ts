/**
 * Source mode editing operation descriptor - the smallest execution unit of Transaction VM.
 * Direct calls to view.dispatch / editor.commands.* from any path other than this are prohibited.
 */
export type SourceEditorOp =
  //Already
  | { kind: 'insert-code-fence'; language: string }
  | { kind: 'insert-table' }
  | { kind: 'insert-link' }
  | { kind: 'insert-reference-def' }
  | { kind: 'open-emoji-picker' }
  | { kind: 'insert-image' }
  | { kind: 'insert-prefix-line'; prefix: string }
  | { kind: 'insert-paragraph-above' }
  | { kind: 'insert-paragraph-below' }
  | { kind: 'surround-selection'; left: string; right: string }
  | { kind: 'strip-common-marks' }
  | { kind: 'set-text-color'; color: string | null }
  //New: Structure insertion
  | { kind: 'insert-literal'; text: string }        //Directly insert fixed text (hr/toc/footnote)
  | { kind: 'indent-more' }                         //List/code indentation increased
  | { kind: 'indent-less' }                         //List/code indentation reduction
  | { kind: 'toggle-task-done'; done: boolean }     //Switch task completion status
  | { kind: 'insert-table-row'; direction: 'above' | 'below' }
  | { kind: 'heading-level-delta'; delta: 1 | -1 }  //Title level rise and fall
  | { kind: 'delete-selection' }                    //Delete selection or previous character
  | { kind: 'delete-line' }                         //Delete entire line
  | { kind: 'select-all' }                          //Select all
  | { kind: 'select-block' }                        //Select syntax block
