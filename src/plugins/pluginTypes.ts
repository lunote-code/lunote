export type LocalizedString = string | Record<string, string>

export type PluginPermissionSet =
  | string[]
  | {
      theme?: { register?: boolean }
      network?: { hosts?: string[] }
      filesystem?: { read?: string[]; write?: string[] }
      [key: string]: unknown
    }

export type PluginThemeDefaultEnable = {
  style?: boolean
  snippets?: string[]
  tokens?: string[]
}

export type PluginThemeMetadata = {
  provides?: string[]
  defaultEnable?: PluginThemeDefaultEnable
}

export type PluginCatalogIndexEntry = {
  id: string
  name: string
  author: string
  tagline: LocalizedString
  pluginType?: string
  capabilities?: string[]
  platforms?: string[]
  requiresRestart?: boolean
  experimental?: boolean
  category: string
  tags?: string[]
  /** When true, `icon` points at a publisher-provided asset; otherwise the UI shows a letter avatar. */
  iconExplicit?: boolean
  icon?: string
  latestVersion: string
  minAppVersion?: string
  maxAppVersion?: string | null
  downloads?: number
  rating?: number | null
  featured?: boolean
  verified?: boolean
  updatedAt?: string
  detailUrl: string
}

export type PluginCatalogIndex = {
  schemaVersion: number
  generatedAt?: string
  minAppVersion?: string
  catalogUrl?: string
  plugins: PluginCatalogIndexEntry[]
  categories?: Array<{ id: string; label: LocalizedString }>
}

export type PluginCatalogDetail = {
  schemaVersion: number
  id: string
  name: string
  author: { name: string; url?: string }
  description: LocalizedString
  changelog?: Record<string, LocalizedString>
  media?: {
    iconExplicit?: boolean
    icon?: Record<string, string>
    banner?: string
    screenshots?: Array<{
      url: string
      caption?: LocalizedString
      width?: number
      height?: number
    }>
  }
  versions: Array<{
    version: string
    releasedAt?: string
    minAppVersion?: string
    maxAppVersion?: string | null
    packageUrl: string
    sha256?: string
    sizeBytes?: number
  }>
  pluginType?: string
  capabilities?: string[]
  platforms?: string[]
  requiresRestart?: boolean
  experimental?: boolean
  permissions?: PluginPermissionSet
  homepage?: string
  repository?: string
  documentation?: string
  license?: string
  contributes?: {
    theme?: PluginThemeMetadata
    commands?: string[]
    preferencesSections?: string[]
    panels?: string[]
  }
  /** Legacy v1 field retained for backward compatibility. */
  theme?: PluginThemeMetadata
}

export type PluginThemeSnippetContribution = {
  file: string
  id: string
  label: string
  description?: string
  defaultEnabled?: boolean
}

export type PluginThemeStyleContribution = {
  file: string
  label: string
  description?: string
}

export type PluginThemeTokenContribution = {
  file: string
  label: string
  description?: string
}

export type PluginManifest = {
  schemaVersion: number
  id: string
  name: string
  version: string
  entry?: string | null
  minAppVersion?: string
  maxAppVersion?: string | null
  pluginType?: string
  capabilities?: string[]
  platforms?: string[]
  requiresRestart?: boolean
  experimental?: boolean
  permissions?: PluginPermissionSet
  contributes?: {
    theme?: {
      style?: PluginThemeStyleContribution[]
      snippets?: PluginThemeSnippetContribution[]
      tokens?: PluginThemeTokenContribution[]
      defaultEnable?: PluginThemeDefaultEnable
    }
    commands?: string[]
    preferencesSections?: string[]
    panels?: string[]
  }
  /** Legacy v1 field retained for backward compatibility. */
  theme?: {
    contributes?: {
      style?: PluginThemeStyleContribution[]
      snippets?: PluginThemeSnippetContribution[]
      tokens?: PluginThemeTokenContribution[]
    }
  }
}

export type PluginPackageFile = {
  path: string
  content: string
}

export type PluginPackage = {
  schemaVersion: number
  id: string
  version: string
  manifest: PluginManifest
  files: PluginPackageFile[]
}

export type InstalledPluginRecord = {
  id: string
  name: string
  version: string
  installedAt: string
}
