# Theme examples

Ready-made appearance files for **Lunote**, aligned with the current token system (`theme-presets.css`, `modeThemeTokens.css`, `calloutThemeTokens.css`). Copy into your user Theme folder, **Rescan**, then enable in **Preferences → Appearance**.

| In this repo | On your computer |
|--------------|------------------|
| [`style/`](./style/) · 5 files | `~/.luna/theme/style/` |
| [`tokens/`](./tokens/) · 12 files | `~/.luna/theme/tokens/` |
| [`snippets/`](./snippets/) · 7 files | `~/.luna/theme/snippets/` |

`~/.luna` lives under your home directory (e.g. `/Users/you/.luna` on macOS). Lunote creates subfolders on first run.

**Related docs:** [Themes guide](../guide/themes.md) · [Theme folder](../theme/README.md) · [External CSS reference](../theme/external-css.md) · [Selector reference](./SELECTORS.md) · [JSON schema starter](../theme/tokens/custom-theme.example.json)

**Not included:** `export/` styles (HTML/PDF/PNG only). See [Export-only CSS](../guide/themes.md#export-only-css).

---

## Built-in editor polish

These ship with the app — **external themes should not re-declare them** unless intentionally overriding:

| Feature | Where |
|---------|--------|
| Font smoothing, line-height 1.7, paragraph rhythm | `editor-visual-core.css` |
| Heading rhythm (`.pm-heading-block--l1` … `--l6`) | `editor-visual-core.css` |
| HR centered gradient | `editor-visual-core.css` |
| Selection tint (accent 18%) | `editor-visual-core.css` |
| Inline `img` radius + shadow | `editor-node-image-media.css` |
| Editor focus inset ring | `editor-chrome-shell.css` |
| Link colors (`.pm-link-inline`) | `modeThemeTokens.css` + footnotes-links CSS |
| Callout cards (12px radius, hover) | `lunaCalloutCard.css` |

**Target headings with** `.pm-heading-block--lN .pm-heading-content`, not bare `h1` alone. See [SELECTORS.md](./SELECTORS.md).

**Prefer** `--editor-column-width` over `max-width` on `.ProseMirror`.

---

## How the current system works

| Layer | What you set | What Lunote derives |
|-------|----------------|---------------------|
| **Palette** (external CSS or JSON) | `--surface-*`, `--text-*`, `--accent`, `--link`, code tokens | — |
| **Mode tokens** (built-in, always on) | — | Links, footnotes, math blocks, tables, reveal chips, overlays (`modeThemeTokens.css`) |
| **Callout accents** (built-in, overridable) | `--luna-callout-note`, `--luna-callout-tip`, … | Per-type callout colors from `--link` / `--accent` |

**Cascade (low → high):** built-in preset → JSON tokens → **external CSS** → UI snippets.

When **external CSS** is active, built-in presets and JSON injector palette step aside; **mode-derived tokens still apply** because they read your palette via `var(--surface-*)` etc.

**Prefer palette variables** over scattered component patches. Set colors once on `html[data-theme='light'|'dark']`; Lunote handles footnotes, inline links, math, and tables automatically.

### Recommended palette variables

| Variable | Role |
|----------|------|
| `--surface-app`, `--surface-panel`, `--surface-editor`, `--surface-preview`, `--surface-hover`, `--surface-elevated` | Surfaces |
| `--text-primary`, `--text-secondary`, `--text-muted`, `--text-tertiary` | Text (`tertiary` ≈ muted hints) |
| `--border-subtle`, `--border-strong` | Borders |
| `--accent`, `--link`, `--link-hover`, `--link-visited`, `--focus-ring` | Accent & links |
| `--code-bg`, `--code-gutter-*`, `--inline-code-bg` | Code |
| `--shadow-soft`, `--shadow-panel` | Shadows |
| `--luna-callout-*` | Optional callout type accents |
| `--editor-column-width` | Content column width (default 860px) |

Stable editor hooks: [SELECTORS.md](./SELECTORS.md)

---

## Quick start

### One file (simplest)

1. Copy e.g. [`style/paper-ink.css`](./style/paper-ink.css) → `~/.luna/theme/style/paper-ink.css`.
2. **Rescan** — **Preferences → Appearance** or **Theme → Rescan**.
3. **Preferences → Appearance → External CSS Theme** → choose `paper-ink.css`.

### JSON token theme

1. Copy e.g. [`tokens/ocean-glass.json`](./tokens/ocean-glass.json) → `~/.luna/theme/tokens/`.
2. Rescan.
3. **Custom theme file** or **Import Theme**.

JSON themes set **app chrome palette** (5 colors + radius/spacing). For full editor/code styling, pair with a matching `style/*.css` or use external CSS alone.

### Snippets

1. Copy files from [`snippets/`](./snippets/) → `~/.luna/theme/snippets/`.
2. Rescan → enable under **UI snippets** (multiple allowed).

---

## Recommended pairings

| JSON (`tokens/`) | CSS (`style/`) | Mood |
|------------------|----------------|------|
| [tokyo-night.json](./tokens/tokyo-night.json) | [tokyo-night.css](./style/tokyo-night.css) | Deep blue-purple dark |
| [forest-dawn.json](./tokens/forest-dawn.json) | [forest-dawn.css](./style/forest-dawn.css) | Calm green daytime |
| [sakura-breeze.json](./tokens/sakura-breeze.json) | [sakura-breeze.css](./style/sakura-breeze.css) | Soft pink light |
| [midnight-aurora.json](./tokens/midnight-aurora.json) | [midnight-aurora.css](./style/midnight-aurora.css) | Teal & violet dark |
| [paper-ink.json](./tokens/paper-ink.json) | [paper-ink.css](./style/paper-ink.css) | Cream paper, literary |

**Token-only** (use with built-in preset or your own `style/` file):

| File | Variant | Notes |
|------|---------|--------|
| [graphite-noir.json](./tokens/graphite-noir.json) | dark | Neutral graphite + indigo |
| [mocha-cream.json](./tokens/mocha-cream.json) | dark | Mocha pastel purple |
| [nordic-frost.json](./tokens/nordic-frost.json) | light | Cool Scandinavian minimal |
| [lavender-haze.json](./tokens/lavender-haze.json) | dark | Lavender purple |
| [ocean-glass.json](./tokens/ocean-glass.json) | light | Cyan glass light |
| [ember-glow.json](./tokens/ember-glow.json) | dark | Warm ember orange |
| [slate-minimal.json](./tokens/slate-minimal.json) | light | Slate gray minimal |

Set JSON `"variant"` to `"light"` or `"dark"` to match your palette. Lunote uses it for `data-theme` when the theme is active.

---

## External CSS themes

Copy from [`style/`](./style/) → `~/.luna/theme/style/`.

Each file sets **light and dark palette tokens** plus typography / chrome personality. Rules target NodeView headings (`.pm-heading-block--lN .pm-heading-content`) and avoid duplicating built-in polish.

| File | Description |
|------|-------------|
| [tokyo-night.css](./style/tokyo-night.css) | Tokyo Night — subtle neon glow, accent headings |
| [forest-dawn.css](./style/forest-dawn.css) | Moss green — gradient hr, h2 accent bar |
| [sakura-breeze.css](./style/sakura-breeze.css) | Sakura pink & cream — soft links, rounded inline code |
| [midnight-aurora.css](./style/midnight-aurora.css) | Aurora teal & violet — gradient h1, aurora workspace |
| [paper-ink.css](./style/paper-ink.css) | Literary cream — 72ch column, double-rule h1, quote mark |

Customize: [External CSS reference](../theme/external-css.md) · [SELECTORS.md](./SELECTORS.md)

---

## JSON token themes

Copy from [`tokens/`](./tokens/) → `~/.luna/theme/tokens/`.

| File | Variant |
|------|---------|
| [tokyo-night.json](./tokens/tokyo-night.json) | dark |
| [forest-dawn.json](./tokens/forest-dawn.json) | light |
| [sakura-breeze.json](./tokens/sakura-breeze.json) | light |
| [midnight-aurora.json](./tokens/midnight-aurora.json) | dark |
| [paper-ink.json](./tokens/paper-ink.json) | light |
| [graphite-noir.json](./tokens/graphite-noir.json) | dark |
| [mocha-cream.json](./tokens/mocha-cream.json) | dark |
| [nordic-frost.json](./tokens/nordic-frost.json) | light |
| [lavender-haze.json](./tokens/lavender-haze.json) | dark |
| [ocean-glass.json](./tokens/ocean-glass.json) | light |
| [ember-glow.json](./tokens/ember-glow.json) | dark |
| [slate-minimal.json](./tokens/slate-minimal.json) | light |

Schema: [custom-theme.example.json](../theme/tokens/custom-theme.example.json).

---

## UI snippets

Copy from [`snippets/`](./snippets/) → `~/.luna/theme/snippets/`. Stack any combination.

| File | Effect |
|------|--------|
| [extra-chrome.css](./snippets/extra-chrome.css) | Table / preview pre·img rounding (on top of built-in defaults) |
| [editor-polish.css](./snippets/editor-polish.css) | Legacy alias — same as `extra-chrome` |
| [link-accent.css](./snippets/link-accent.css) | Stronger `.pm-link-inline` underline |
| [reading-comfort.css](./snippets/reading-comfort.css) | Looser line height & paragraph spacing (overrides built-in 1.7) |
| [soft-callouts.css](./snippets/soft-callouts.css) | Callout hover lift + export preview styling |
| [serif-headings.css](./snippets/serif-headings.css) | Serif h1–h2 via NodeView selectors |
| [warm-selection.css](./snippets/warm-selection.css) | Stronger selection than built-in 18% tint |

### Snippet vs built-in

| Snippet | Still needed? |
|---------|----------------|
| extra-chrome | Yes — tables, preview pre/img, raw `pre` |
| reading-comfort | Yes — intentionally looser than default |
| warm-selection | Yes — stronger than default 18% |
| link-accent | Yes — stronger underline on `.pm-link-inline` |
| soft-callouts | Optional — hover lift + export callouts |
| serif-headings | Yes — after NodeView selector fix |

### Suggested stacks

| Goal | Enable |
|------|--------|
| Long-form reading | [paper-ink.css](./style/paper-ink.css) + `serif-headings` + `reading-comfort` + `warm-selection` |
| Dark writing | [midnight-aurora.css](./style/midnight-aurora.css) + `link-accent` + `soft-callouts` |
| Daytime focus | [forest-dawn.css](./style/forest-dawn.css) + `reading-comfort` + `extra-chrome` |
| Code & notes (night) | [tokyo-night.css](./style/tokyo-night.css) + `soft-callouts` + `extra-chrome` |
| Minimal pink light | [sakura-breeze.css](./style/sakura-breeze.css) + `extra-chrome` |

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Theme not in dropdown | **Rescan**; check extension (`.css` / `.json`) and subfolder (`style`, `tokens`, `snippets`). |
| JSON theme does nothing | Select under **Custom theme file**; disable external CSS to compare token colors. |
| Dark mode looks flat | Ensure external CSS defines **both** `html[data-theme='light']` and `html[data-theme='dark']` blocks. |
| Heading styles ignored | Use `.pm-heading-block--lN .pm-heading-content` — see [SELECTORS.md](./SELECTORS.md). |
| Callouts ignore accent | Override `--luna-callout-*` on `html[data-theme]` instead of hard-coding callout hex in rules. |
| Export differs from editor | Normal — use `~/.luna/theme/export/` for export styling. |

More: [Themes guide → Tips](../guide/themes.md#tips).
