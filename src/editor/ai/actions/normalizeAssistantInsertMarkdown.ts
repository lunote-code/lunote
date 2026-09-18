export function normalizeAssistantInsertMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\s*\\\s*$/gm, '')
    .replace(/^(#{1,6}\s+.+?)\\(?=\s*$)/gm, '$1')
    .replace(/[ \t]+\\(?=\n)/g, '')
    .trim()
}
