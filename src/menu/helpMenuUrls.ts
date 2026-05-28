/** Help menu external link (please replace with actual address before publishing)*/
export const HELP_URL_PRIVACY = 'https://example.com/privacy'
export const HELP_URL_WEBSITE = 'https://example.com'

export function buildHelpFeedbackMailto(subject: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}`
}
