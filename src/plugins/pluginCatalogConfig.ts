/**
 * Central plugin catalog configuration.
 *
 * Update this file when switching from local development to a hosted catalog.
 *
 * The production value may be:
 * - a same-origin path
 * - a GitHub repository URL
 * - a GitHub Raw URL
 * - a GitHub Pages URL
 */
export const PLUGIN_CATALOG_CONFIG = {
  development: {
    /**
     * Same-origin path used by the Vite dev proxy when VITE_PLUGIN_CATALOG_LOCAL=1.
     * By default dev uses production.baseUrl (lunote-theme on GitHub Raw).
     */
    baseUrl: '/plugin-catalog',
    /**
     * Local catalog server started by `npm run plugin-catalog:dev`.
     */
    proxyTarget: 'http://127.0.0.1:8000',
  },
  production: {
    /**
     * Hosted plugin catalog root (lunote-theme repo; layout matches docs/theme-plugin-example).
     *
     * Use GitHub Raw so catalog JSON/media fetch without HTML wrapper pages.
     */
    baseUrl: 'https://raw.githubusercontent.com/lunote-code/lunote-theme/main',
  },
} as const
