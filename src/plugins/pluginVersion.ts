function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .split('.')
    .map((part) => {
      const match = part.match(/^\d+/)
      return match ? Number.parseInt(match[0], 10) : 0
    })
}

/** Compare semver-like plugin versions. Returns positive when `left` is newer than `right`. */
export function comparePluginVersions(left: string, right: string): number {
  const leftParts = parseVersionParts(left)
  const rightParts = parseVersionParts(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0
    const rightValue = rightParts[index] ?? 0
    if (leftValue > rightValue) return 1
    if (leftValue < rightValue) return -1
  }

  return 0
}

export function isPluginUpdateAvailable(installedVersion: string, latestVersion: string): boolean {
  if (!installedVersion || !latestVersion) return false
  return comparePluginVersions(latestVersion, installedVersion) > 0
}
