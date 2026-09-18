/** Close the history overlay so tab / document navigation can continue. */
export function dismissDocumentHistoryIfOpen(args: {
  documentHistoryOpen: boolean
  closeDocumentHistoryDialog: () => void
}): boolean {
  if (!args.documentHistoryOpen) return false
  args.closeDocumentHistoryDialog()
  return true
}
