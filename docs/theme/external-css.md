# Lunote External CSS

Lunote loads desktop UI styles from `~/.luna/theme/style/*.css`. External CSS affects **only the live editor and app chrome** — not HTML/PDF/PNG export (use `.luna/theme/export/` for that).

## How it works

1. Place a `.css` file in **`~/.luna/theme/style/`** (not in `snippets/`, `export/`, or `tokens/`).
2. Select it in **Preferences → Appearance → External CSS → External CSS theme**, or from the native **Theme** menu.
3. Click **Rescan** after adding or editing files.

Only **one** full external CSS theme is active at a time. While it is active, **built-in preset colors** (`theme-presets.css`) and **JSON/built-in token variables** step aside so the external file owns the palette. Optional **UI snippets** (`.luna/theme/snippets/`) still stack on top.

**Priority (low → high):** built-in presets → token variables → **external CSS** → UI snippets.

See also: [Themes user guide](../guide/themes.md), [theme examples](../theme-example/README.md), [selector reference](../theme-example/SELECTORS.md), and [style/crossplatnote-theme.example.css](./style/crossplatnote-theme.example.css).

---

## Unified `.luna/theme/` layout

All user-editable appearance files live under one directory:

```text
~/.luna/theme/
  README.md              ← created on first run (folder guide)
  style/*.css            ← external CSS themes (editor UI)
  snippets/*.css         ← stackable UI snippets
  export/*.css           ← export-only CSS
  tokens/*.json          ← JSON color token themes
```

| Layer | Path | Purpose |
|-------|------|---------|
| Built-in preset | Preferences → Appearance → Theme | Default Luna CSS variables (`theme-presets.css`) |
| Custom JSON theme | `.luna/theme/tokens/*.json` | Token overrides via JSON import |
| **External CSS** | `.luna/theme/style/*.css` | Full stylesheet override |
| UI snippets | `.luna/theme/snippets/*.css` | Small stacked tweaks |
| Export CSS | `.luna/theme/export/*.css` | Export output only |

On first launch after an upgrade, the app migrates files from the legacy `~/.luna/config/Theme/` folder and loose `~/.luna/theme/*.json` files into this layout.

External CSS is injected into a `<style id="luna-user-theme-css">` tag. The active file name is exposed on `html` and `body` as `data-theme-css-file`.

---

## CSS variables (recommended)

Prefer overriding **Luna semantic tokens**. They are defined in `src/theme-presets.css` and can be scoped by built-in preset and light/dark mode.

### Surfaces & text

| Variable | Typical use |
|----------|-------------|
| `--surface-app` | Application background |
| `--surface-panel` | Sidebars, panels, dialogs |
| `--surface-editor` | Editor pane background |
| `--surface-preview` | Preview/read surface |
| `--surface-hover` | Hover states |
| `--text-primary` | Primary text |
| `--text-secondary` | Secondary text |
| `--text-muted` | Muted / hint text |
| `--border-subtle` | Light borders |
| `--border-strong` | Strong borders |

### Accent & links

| Variable | Typical use |
|----------|-------------|
| `--accent` | Accent / primary actions |
| `--link` | Link color |
| `--link-hover` | Link hover |
| `--link-visited` | Visited links |
| `--focus-ring` | Focus outline mix |

### Code blocks

| Variable | Typical use |
|----------|-------------|
| `--code-bg` | Fenced code background |
| `--code-gutter-fg` / `--code-gutter-bg` | Source mode gutter |
| `--inline-code-bg` | Inline `code` background |

### Typography (structural, from `index.css`)

| Variable | Typical use |
|----------|-------------|
| `--font-ui` | Chrome / UI |
| `--font-reading` | Editor reading text |
| `--font-mono` | Monospace |
| `--line-reading` | Editor line height |
| `--editor-column-width` | Content column max width (prefer over `max-width` on `.ProseMirror`) |
| `--editor-content-font-size` | Body font size in editor |
| `--editor-content-font-family` | Body font stack in editor |

### Built-in editor polish

The app ships default reading polish in `editor-visual-core.css` and related styles: font smoothing, heading rhythm (`.pm-heading-block--l1` … `--l6`), HR gradient, selection tint, inline image shadow, editor focus ring, and link tokens. External themes should set **palette + personality deltas** only — see [Built-in editor polish](../theme-example/README.md#built-in-editor-polish).

### Scoping selectors

```css
/* All dark presets */
html[data-theme='dark'] {
  --surface-editor: #1a1b26;
}

/* GitHub dark only */
html[data-theme-preset='github'][data-theme='dark'] {
  --link: #7dcfff;
}

/* Body class mirrors light/dark (also set by built-in theme runtime) */
body.theme-dark { /* … */ }
body.theme-light { /* … */ }
```

---

## Stable DOM selectors

These class names are part of the **public styling API** for external CSS. They may retain historical names (e.g. `workspace-split`) but are stable hooks for Lunote, not third-party app compatibility shims.

### App shell & layout

- `.app-shell`, `.workspace`, `.workspace-root`
- `.layout`, `.workspace-split.mod-root`
- `.with-sidebar`, `.without-sidebar`, `.focus-mode`, `.with-knowledge-rail`

### Sidebars & rails

- `.sidebar`, `.workspace-split.mod-left-split`
- `.kos-right-rail`, `.workspace-split.mod-right-split`

### Editor

- `.markdown-visual-editor`, `.markdown-preview-view`, `.preview-pane`
- `.editor-body-surface`, `.main.editor-body-focused`
- `.source-pane`, `.editor-pane`
- `.cm-editor`, `.cm-scroller`, `.cm-gutters`, `.cm-content`, `.cm-line`

### Markdown content (in-editor)

**Headings (primary — NodeView):** `.pm-heading-block--l1` … `--l6` with `.pm-heading-content` inside `.preview-pane.markdown-visual-editor .ProseMirror`

**Headings (fallback — pasted raw HTML):** `.ProseMirror > h1` … `> h6`

**Links:** `.pm-link-inline` (not bare `a` alone in visual mode)

**Blocks:** `.pm-code-block-wrap`, `.pm-image-card`, `aside.pm-callout.luna-callout-card`, `.markdown-table-wrap`

**Export preview:** `.markdown-preview-view`, `.md-callout`

Full list: [theme-example/SELECTORS.md](../theme-example/SELECTORS.md)

---

## Writing a theme

1. **Start with variables** — override Luna tokens for broad color/font changes with minimal CSS.
2. **Target NodeView headings** — use `.pm-heading-block--lN .pm-heading-content`, not bare `h1` alone.
3. **Set `--editor-column-width`** instead of `max-width` on `.ProseMirror`.
4. **Use snippets for optional layers** — `extra-chrome`, `reading-comfort`, `reading-edge-fade`, `reading-frost-glass`, `warm-selection` stack on built-in defaults (enable only one reading-fade overlay at a time).
5. **Test light and dark** — scope rules with `html[data-theme]` or `body.theme-light` / `body.theme-dark`.

Copy [style/crossplatnote-theme.example.css](./style/crossplatnote-theme.example.css) or any file from [theme-example/style/](../theme-example/README.md#external-css-themes) into `~/.luna/theme/style/` as a starting point.

---

## Export behavior

When exporting HTML/PDF/PNG, rules from the active external CSS theme and UI snippets are **filtered** to markdown/content selectors only. Sidebar and workspace chrome rules are stripped so they do not break export layout.

Dedicated export styling belongs in `.luna/theme/export/`.

---

## Migration from Obsidian community themes

Lunote **no longer** supports Obsidian community `.css` themes or Obsidian-specific CSS variables (`--background-primary`, `--text-normal`, etc.).

| Obsidian (removed) | Lunote replacement |
|--------------------|---------------------------|
| `--background-primary` | `--surface-editor` |
| `--background-secondary` | `--surface-panel` |
| `--text-normal` | `--text-primary` |
| `--text-muted` | `--text-muted` |
| `--text-accent` | `--link` |
| `--interactive-accent` | `--accent` |

Rewrite themes using Luna tokens and the selectors documented above.

## Legacy paths (pre-unified layout)

| Old path | New path |
|----------|----------|
| `~/.luna/config/Theme/*.css` | `~/.luna/theme/style/*.css` |
| `~/.luna/theme/*.css` (root) | `~/.luna/theme/style/*.css` |
| `~/.luna/config/Theme/snippets/` | `~/.luna/theme/snippets/` |
| `~/.luna/config/Theme/export/` | `~/.luna/theme/export/` |
| `~/.luna/theme/*.json` | `~/.luna/theme/tokens/*.json` |

Migration runs automatically once; originals are copied, not deleted.
