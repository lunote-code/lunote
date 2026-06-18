export const MERMAID_FLOWCHART_TEMPLATE = `flowchart LR
  A[Start] --> B[Process]
  B --> C[End]`

export const MERMAID_MINDMAP_TEMPLATE = `mindmap
  root((Topic))
    Child A
    Child B`

export function isMermaidSourceEmpty(source: string): boolean {
  return source.trim().length === 0
}
