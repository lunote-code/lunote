/** The same algorithm as `viewportModeAnchor.modeSwitchBufferFingerprint`, shared by snapshots/anchors to avoid module circular dependencies.*/
export function modeSwitchPlainTextFingerprint(text: string): string {
  let h = 2166136261 >>> 0
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  }
  return (h >>> 0).toString(16)
}
