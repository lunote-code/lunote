/** Remove one indent level from line prefix (tabs or spaces, tabSize columns per Tab insert). */
export function removeOneIndentLevel(line: string, tabSize: number): { text: string; removed: number } {
  if (!line.length) return { text: line, removed: 0 }
  let removed = 0
  let columns = 0
  while (removed < line.length && columns < tabSize) {
    const ch = line[removed]
    if (ch === ' ') {
      removed += 1
      columns += 1
    } else if (ch === '\t') {
      removed += 1
      break
    } else {
      break
    }
  }
  return { text: line.slice(removed), removed }
}
