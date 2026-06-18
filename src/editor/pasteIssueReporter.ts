export type PasteIssueCode = 'heic_unsupported'

type PasteIssueReporter = (code: PasteIssueCode) => void

let reporter: PasteIssueReporter | null = null
let lastIssue: PasteIssueCode | null = null

export function setPasteIssueReporter(next: PasteIssueReporter | null): void {
  reporter = next
}

export function reportPasteIssue(code: PasteIssueCode): void {
  lastIssue = code
  reporter?.(code)
}

/** Whether a paste attempt already surfaced a specific issue to the user. */
export function takeLastPasteIssue(): PasteIssueCode | null {
  const issue = lastIssue
  lastIssue = null
  return issue
}
