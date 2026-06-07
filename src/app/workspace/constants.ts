import versionConfig from '../../../version.json'

/** Installation package/executable file name (short name), consistent with tauri.conf productName*/
export const APP_SHORT_NAME = 'Lunote'
/** The complete product name displayed in the interface and "About"*/
export const APP_DISPLAY_NAME = 'Lunote'

/** Application semver; configured in `version.json` and synced via `npm run version:sync`. */
export const APP_VERSION = versionConfig.version

export const GITHUB_REPO = 'lunote-code/lunote'
export const GITHUB_RELEASES_LATEST_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
export const GITHUB_RELEASES_LATEST_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`

export const BUFFER_TAB_PREFIX = 'luna:buf:'
export function isBufferTabId(path: string): boolean {
  return path.startsWith(BUFFER_TAB_PREFIX)
}
export function newBufferTabId(): string {
  return `${BUFFER_TAB_PREFIX}${crypto.randomUUID()}`
}


export const INITIAL_NOTE_MD =
  '# New note\n\nStart writing your ideas...\n\n```ts\nconsole.log("hello markdown")\n```\n\n<!-- This comment is hidden in preview -->\n'

export const LARGE_DOC_THRESHOLD = 400_000

/** Maximum recent workspace files shown in the sidebar empty state. */
export const RECENT_FILES_LIMIT = 16
