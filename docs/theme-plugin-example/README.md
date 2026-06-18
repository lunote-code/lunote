# Theme + Plugin Example Structures

This directory demonstrates a recommended structure for a **remote plugin catalog**, **installed plugin packages**, and **plugin-bundled theme assets**. Plugin icons and screenshots live under `media/` as PNG files served alongside catalog JSON.

The current version has been generalized from a theme-only shape into a **generic contribution model**. Theme features are represented under `contributes.theme`, leaving room for future command packs, panels, exporters, sync providers, and other plugin types.

**14 example plugins** ship here — full external CSS themes, JSON token presets, and UI snippet packs adapted from [theme-example](../theme-example/README.md).

## Related docs

| Doc | Purpose |
|-----|---------|
| [theme-example/](../theme-example/README.md) | Pure theme files: `style/`, `snippets/`, `tokens/` |
| [theme/](../theme/README.md) | The `~/.luna/theme/` layout on a user machine |
| This directory | Plugin marketplace metadata, package manifest, and bundled theme assets |

## Layout

```text
docs/theme-plugin-example/
  README.md
  catalog/                            # Remote catalog: lightweight index + on-demand details
    index.json                        # 14 plugins
    plugins/
      reading-comfort-pack.json
      compact-workspace-pack.json
      tokyo-night-pack.json
      … (12 more detail files)
  packages/                           # Install payloads (static JSON; also built from installed/ in dev server)
    {plugin-id}.json                  # 14 packages
  media/                              # Self-hosted catalog assets (icons; served with JSON)
    {plugin-id}/
      icon.png
      icon@32.png
      icon@128.png
  installed/                          # Installed package examples (runtime authority)
    {plugin-id}/
      plugin.json
      theme/
        style/*.css                   # optional
        snippets/*.css                # optional
        tokens/*.json                 # optional
  schemas/                            # Documentation schemas (not a runtime validator)
    catalog-index.schema.json
    plugin-manifest.schema.json
```

## Data layers

| Layer | File | Purpose |
|------|------|---------|
| Remote index | `catalog/index.json` | List view: name, plugin type, capabilities, icon URL, version, category |
| Remote detail | `catalog/plugins/*.json` | Detail view: description, screenshots, changelog, permissions, package URL |
| Local manifest | `installed/*/plugin.json` | Runtime authority for enablement, permissions, entry point, and contributions |
| Bundled theme assets | `installed/*/theme/**` | Files copied or linked into `~/.luna/theme/` after installation |

Principle: **remote metadata is for discovery and presentation; local `plugin.json` is the runtime source of truth after installation.**

## Remote catalog

### `catalog/index.json`

- Keep entries lightweight
- Use `detailUrl` for on-demand detail fetches
- Keep `icon` as a CDN or repository asset URL (for GitHub-hosted catalogs, point to `media/{id}/icon@128.png` under the same repo root)
- Recommended metadata includes `pluginType`, `capabilities`, `platforms`, `requiresRestart`, and `experimental`

### `catalog/plugins/*.json`

- Keep `media.screenshots` as URLs with dimensions for lazy loading
- Use `versions[].packageUrl` plus `sha256` for install-time verification
- Prefer same-repo JSON package URLs such as `/packages/{id}.json` (local dev server also serves install payloads at that path)
- Show `permissions` before installation
- Treat `contributes.theme` as one branch of a broader contribution model; future branches may include `commands`, `panels`, `exporters`, and more

## Local plugin packages

### `installed/*/plugin.json`

- `id` matches the remote catalog
- `contributes.theme` declares style, snippet, and token files contributed to Lunote
- `contributes.commands`, `contributes.preferencesSections`, and `contributes.panels` are reserved for future plugin types
- The client may register `theme/style/*.css` as selectable external themes and `theme/snippets/*.css` as switchable snippets

### Bundled theme CSS

Bundled CSS follows the same conventions used by [theme-example](../theme-example/README.md):

- Define palette values on `html[data-theme='light'|'dark']`
- Prefer stable hooks such as `--editor-column-width` and `.pm-heading-block--lN`
- Keep snippets focused and token-driven where possible

## Example install sync

After installing `reading-comfort-pack`, a client may sync files like this:

```text
~/.luna/plugins/reading-comfort-pack/     # plugin root (manifest + original package files)
~/.luna/theme/snippets/reading-focus.css  # plugin-managed snippet (copy or symlink)
~/.luna/theme/style/reading-pack-accent.css
~/.luna/theme/tokens/reading-pack.json
```

The exact sync strategy belongs to the plugin runtime. This directory only documents the recommended structure.

## Example plugins (14)

### Full theme packs (`theme-pack`)

Style + snippet + token contributions, or style-only packs adapted from `theme-example/style/`.

| ID | Type | Contributions | Notes |
|----|------|---------------|-------|
| `reading-comfort-pack` | theme-pack | style + snippet + token | Featured; literary palette + reading-focus snippet |
| `tokyo-night-pack` | theme-pack | style | Featured; Tokyo Night external CSS |
| `forest-dawn-pack` | theme-pack | style | Moss-green daytime palette |
| `midnight-aurora-pack` | theme-pack | style | Featured; teal/violet aurora dark theme |
| `sakura-breeze-pack` | theme-pack | style | Soft pink light theme |
| `cobalt-dusk-pack` | theme-pack | style | High-contrast cobalt dark theme |

### JSON token packs (`theme-pack`)

Token-only presets from `theme-example/tokens/`. Pair with built-in variants or any `style/*.css`.

| ID | Token file | Variant |
|----|------------|---------|
| `graphite-noir-pack` | `graphite-noir-pack.json` | dark |
| `ocean-glass-pack` | `ocean-glass-pack.json` | light |

### UI snippet packs (`ui-snippet`)

Stackable `.css` tweaks from `theme-example/snippets/`. Enable on **Preferences → Appearance → UI snippets**.

| ID | Snippets | Category |
|----|----------|----------|
| `compact-workspace-pack` | compact sidebar rows | workspace |
| `link-accent-pack` | stronger link underline | appearance |
| `serif-headings-pack` | serif h1–h2 | appearance |
| `reading-edge-pack` | top/bottom viewport fade | productivity |
| `warm-selection-pack` | stronger selection tint | appearance |
| `code-clarity-pack` | solid gutters + crisp code shadow | productivity |

### Catalog categories

| ID | Label (en / zh-CN) |
|----|---------------------|
| `appearance` | Appearance / 外观 |
| `workspace` | Workspace / 工作区 |
| `productivity` | Productivity / 效率 |

## Regenerating examples

After editing `installed/` sources or adding plugins to the generator list:

```bash
python3 scripts/maintenance/generate_theme_plugin_examples.py
npm run plugin-catalog:build-packages
```

The generator copies CSS/JSON from `docs/theme-example/` into new `installed/{id}/` trees and refreshes `catalog/index.json` plus `catalog/plugins/*.json`. Existing hand-authored packs (`reading-comfort-pack`, `compact-workspace-pack`) are preserved in the catalog index; re-run the generator only when extending the `THEME_STYLE_PACKS`, `TOKEN_PACKS`, or `SNIPPET_PACKS` lists in the script.

## Catalog address configuration

The plugin catalog address is configured directly in:

```text
src/plugins/pluginCatalogConfig.ts
```

The file contains two configuration groups:

- `development.baseUrl` / `development.proxyTarget`
- `production.baseUrl`

For production, the configured source URL is:

```text
https://raw.githubusercontent.com/lunote-code/lunote-theme/main
```

The remote repository root mirrors this directory (`catalog/`, `packages/`, `media/`, …). Lunote also accepts a `https://github.com/lunote-code/lunote-theme/` repository URL and converts it to the matching raw-content base automatically for JSON fetching.

## Regenerating catalog media (screenshots + icons)

Marketing PNGs under `media/` are generated from the English QA playground — no manual screenshots required.

```bash
# Terminal 1
npm run dev

# Terminal 2 (use PORT=5174 if Vite picked another port)
npm run plugin-catalog:capture-media
# or: PORT=5174 npm run plugin-catalog:capture-media
```

The script:

- Opens `/?qa=plugin-catalog-media&locale=en` with a sample English workspace + editor document
- Applies each plugin’s contributed CSS / snippets / JSON tokens from `installed/{id}/`
- Writes `media/{id}/icon@32.png`, `icon@128.png`, and the screenshot paths declared in `catalog/plugins/{id}.json` (`preview.png`, `settings.png`, …)
- Captures plugin settings detail (`settings.png`) via `/?qa=preferences&locale=en`

After manually updating PNGs under `media/`, sync catalog JSON from disk:

```bash
python3 scripts/maintenance/sync_plugin_catalog_media.py
```

## Local catalog service (development)

Run from the project root:

```bash
npm run plugin-catalog:dev
```

The local server exposes:

- `GET /catalog/index.json` — plugin list (14 entries)
- `GET /catalog/plugins/{id}.json` — plugin detail (including `packageUrl`)
- `GET /packages/{id}.json` — install package (`manifest` + all file contents)
- `GET /media/{id}/icon.png` — plugin icon (reads `media/{id}/` on disk; falls back to a shared placeholder)
- `GET /media/{id}/screenshots/*.png` — plugin detail screenshots referenced by `catalog/plugins/*.json`

| Scenario | Example value |
|----------|---------------|
| Local development (Vite proxy) | `/plugin-catalog` |
| GitHub repository | `https://github.com/lunote-code/lunote-theme/` |
| GitHub Raw | `https://raw.githubusercontent.com/org/repo/main` |
| GitHub Pages | `https://org.github.io/repo` |

When using `/plugin-catalog`, Lunote accesses the local server through the Vite proxy to avoid CORS issues. Run both `npm run plugin-catalog:dev` and `npm run dev`, and restart the dev server after changing `pluginCatalogConfig.ts`.

If you serve this directory with a plain static server (for example `python -m http.server 8000`), ensure `packages/{id}.json` exists on disk. The Node dev server can also rebuild packages from `installed/` when a static file is missing. Regenerate static packages after editing installed plugin files:

```bash
npm run plugin-catalog:build-packages
```

## Suggested pairings

| Goal | Install | Then in Preferences |
|------|---------|---------------------|
| Night coding | `tokyo-night-pack` or `cobalt-dusk-pack` | Appearance → External CSS |
| Long-form reading | `reading-comfort-pack` + `reading-edge-pack` | External CSS + enable reading-edge snippet |
| Token + built-in UI | `graphite-noir-pack` | Built-in theme → Custom theme file |
| Large vault | `compact-workspace-pack` | UI snippets |
| Code-heavy notes | `code-clarity-pack` + `cobalt-dusk-pack` | UI snippets + External CSS |

## Further reading

- [Themes guide](../guide/themes.md)
- [Theme examples gallery](../theme-example/README.md)
- [External CSS reference](../theme/external-css.md)
- [Selector reference](../theme-example/SELECTORS.md)
