/**
 * Code Block Runtime — document-flow embedded block state.
 * Runtime edit/preview is active for **Mermaid** (`mermaidBlock`).
 * `'code'` in `CodeBlockType` is reserved for PM scan compatibility; fenced `codeBlock` edits inline in ProseMirror.
 */
export type CodeBlockType = 'mermaid' | 'code' | 'json' | 'sql'

export type CodeBlockMode = 'edit' | 'preview'

export type CodeBlockRuntime = {
  blockId: string
  type: CodeBlockType
  state: {
    draft: string
    mode: CodeBlockMode
    height: number
    scrollTop: number
  }
  ui: {
    focused: boolean
    dirty: boolean
  }
}

export type CodeBlockRuntimeSnapshot = {
  blockMap: ReadonlyMap<string, CodeBlockRuntime>
  focusedBlockId: string | null
  pendingByBlockId: ReadonlyMap<string, Partial<CodeBlockRuntime['state']>>
}
