/** Code Block Runtime — Document flow embedded code/mermaid block unified state*/

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
