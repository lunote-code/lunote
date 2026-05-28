import { isTauri } from '@tauri-apps/api/core'

import { APP_VERSION, GITHUB_RELEASES_LATEST_PAGE, GITHUB_RELEASES_LATEST_API } from '../app/workspace/constants'
import { openExternalUrlInSystemBrowser } from '../editor/openExternalLink'

export type AppUpdateCheckResult =
  | { status: 'latest'; currentVersion: string; latestVersion: string }
  | { status: 'update-available'; currentVersion: string; latestVersion: string; releaseUrl: string }
  | { status: 'error'; currentVersion: string; reason: 'network' | 'parse' | 'unknown' }

const DISMISSED_UPDATE_VERSION_KEY = 'lunote.dismissedUpdateVersion'

type GitHubReleasePayload = {
  tag_name?: string
  html_url?: string
}

export function normalizeReleaseVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '')
}

function parseVersionParts(version: string): [number, number, number] | null {
  const normalized = normalizeReleaseVersion(version)
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function isVersionNewer(latest: string, current: string): boolean {
  const a = parseVersionParts(latest)
  const b = parseVersionParts(current)
  if (!a || !b) return normalizeReleaseVersion(latest) !== normalizeReleaseVersion(current)
  if (a[0] !== b[0]) return a[0] > b[0]
  if (a[1] !== b[1]) return a[1] > b[1]
  return a[2] > b[2]
}

export async function fetchLatestGitHubRelease(): Promise<{ version: string; releaseUrl: string } | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_LATEST_API, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as GitHubReleasePayload
    const version = payload.tag_name ? normalizeReleaseVersion(payload.tag_name) : ''
    if (!version) return null
    const releaseUrl =
      typeof payload.html_url === 'string' && payload.html_url.trim()
        ? payload.html_url.trim()
        : GITHUB_RELEASES_LATEST_PAGE
    return { version, releaseUrl }
  } catch {
    return null
  }
}

export async function checkForAppUpdate(currentVersion = APP_VERSION): Promise<AppUpdateCheckResult> {
  const latest = await fetchLatestGitHubRelease()
  if (!latest) {
    return { status: 'error', currentVersion, reason: 'network' }
  }
  if (isVersionNewer(latest.version, currentVersion)) {
    return {
      status: 'update-available',
      currentVersion,
      latestVersion: latest.version,
      releaseUrl: latest.releaseUrl,
    }
  }
  return {
    status: 'latest',
    currentVersion,
    latestVersion: latest.version,
  }
}

export function shouldRunAutoUpdateCheck(): boolean {
  return import.meta.env.PROD && isTauri()
}

export function getDismissedUpdateVersion(): string | null {
  try {
    const value = localStorage.getItem(DISMISSED_UPDATE_VERSION_KEY)
    return value?.trim() || null
  } catch {
    return null
  }
}

export function setDismissedUpdateVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_UPDATE_VERSION_KEY, version)
  } catch {
    /* ignore quota / privacy mode */
  }
}

export async function openAppReleasePage(releaseUrl = GITHUB_RELEASES_LATEST_PAGE): Promise<void> {
  await openExternalUrlInSystemBrowser(releaseUrl)
}
