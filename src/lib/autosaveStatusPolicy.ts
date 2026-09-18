export function shouldAnnounceAutosaveComplete(args: {
  scope: 'allDirty' | 'activeOnly'
  stillDirty: boolean
  activeStillDirty: boolean
}): boolean {
  if (!args.stillDirty) return true
  if (args.scope === 'activeOnly' && !args.activeStillDirty) return true
  return false
}
