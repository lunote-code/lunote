export const SIDEBAR_ONBOARDING_RESET_EVENT = 'luna:sidebar-onboarding-reset'

export const LEGACY_SIDEBAR_ONBOARDING_KEY = 'luna:sidebar-onboarding-dismissed'
export const NO_WORKSPACE_SIDEBAR_ONBOARDING_KEY = 'luna:sidebar-onboarding-dismissed:no-workspace'
export const WORKSPACE_SIDEBAR_ONBOARDING_KEY = 'luna:sidebar-onboarding-dismissed:workspace'

export function resetSidebarWorkspaceOnboarding(): void {
  try {
    localStorage.removeItem(LEGACY_SIDEBAR_ONBOARDING_KEY)
    localStorage.removeItem(NO_WORKSPACE_SIDEBAR_ONBOARDING_KEY)
    localStorage.removeItem(WORKSPACE_SIDEBAR_ONBOARDING_KEY)
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(SIDEBAR_ONBOARDING_RESET_EVENT))
}
