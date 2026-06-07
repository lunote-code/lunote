/**
 * Synchronous pre-React theme bootstrap. Logic mirrors src/platform/bootEarlyTheme.ts
 */
;(function () {
  var SETTINGS_KEY = 'Lunote:appSettings:v1'
  var LEGACY_SETTINGS_KEY = 'CrossPlatNote:appSettings:v1'
  var DEFAULT_VARIANT = 'github-dark'

  var SURFACE_APP = {
    'github-light': '#f6f8fa',
    'github-dark': '#0d1117',
    'idea-light': '#ffffff',
    'idea-dark': '#2b2b2b',
    'dim-light': '#d8dee9',
    'dim-dark': '#1e2030',
  }

  var BUILT_IN = {
    'github-light': 1,
    'github-dark': 1,
    'idea-light': 1,
    'idea-dark': 1,
    'dim-light': 1,
    'dim-dark': 1,
  }

  function normalizeVariant(value) {
    if (typeof value !== 'string') return DEFAULT_VARIANT
    var trimmed = value.trim()
    if (!trimmed) return DEFAULT_VARIANT
    if (BUILT_IN[trimmed]) return trimmed
    switch (trimmed) {
      case 'light':
        return 'github-light'
      case 'system':
      case 'dark':
      case 'github':
        return DEFAULT_VARIANT
      case 'idea':
        return 'idea-dark'
      case 'dim':
        return 'dim-dark'
      default:
        return trimmed
    }
  }

  function resolveMarkup(active, cssFileRaw) {
    var variant = normalizeVariant(active)
    var cssFile = typeof cssFileRaw === 'string' ? cssFileRaw.trim() : ''
    var preset = 'github'
    if (variant.indexOf('idea-') === 0 || variant === 'idea') preset = 'idea'
    else if (variant.indexOf('dim-') === 0 || variant === 'dim') preset = 'dim'
    var mode = 'dark'
    if (variant.slice(-6) === '-light' || variant === 'light') mode = 'light'
    else if (variant.slice(-5) === '-dark' || variant === 'dark') mode = 'dark'
    var surfaceKey = BUILT_IN[variant] ? variant : preset + '-' + mode
    var surfaceApp = SURFACE_APP[surfaceKey] || SURFACE_APP['github-dark']
    return { mode: mode, preset: preset, surfaceApp: surfaceApp, cssFile: cssFile }
  }

  function readSettingsRaw() {
    try {
      return localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_KEY)
    } catch (e) {
      return null
    }
  }

  function parseSettings(raw) {
    if (!raw) return resolveMarkup(DEFAULT_VARIANT)
    try {
      var parsed = JSON.parse(raw)
      var theme = parsed && parsed.appearance && parsed.appearance.theme
      return resolveMarkup(theme && theme.active, theme && theme.cssFile)
    } catch (e) {
      return resolveMarkup(DEFAULT_VARIANT)
    }
  }

  try {
    var markup = parseSettings(readSettingsRaw())
    var root = document.documentElement
    root.setAttribute('data-theme', markup.mode)
    root.setAttribute('data-theme-preset', markup.preset)
    if (markup.cssFile) root.setAttribute('data-theme-css-file', markup.cssFile)
    root.style.backgroundColor = markup.surfaceApp
    root.style.colorScheme = markup.mode
  } catch (e) {}
})()
