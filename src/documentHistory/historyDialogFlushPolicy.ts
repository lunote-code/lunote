import { pathsEqual } from '../lib/workspacePathUtils'

export function shouldFlushEditorBeforeHistoryDiff(args: {
  dialogPath: string
  activePath?: string | null
}): boolean {
  if (!args.dialogPath) return false
  if (args.activePath == null || args.activePath === '') return true
  return pathsEqual(args.dialogPath, args.activePath)
}
