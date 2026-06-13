# Theme examples

Ready-made appearance files for **Lunote**, aligned with the current token system (`theme-presets.css`, `modeThemeTokens.css`, `calloutThemeTokens.css`). Copy into your user Theme folder, **Rescan**, then enable in **Preferences**.

| In this repo | On your computer |
|--------------|------------------|
| [`style/`](./style/) · 7 files | `~/.luna/theme/style/` |
| [`tokens/`](./tokens/) · 15 files | `~/.luna/theme/tokens/` |
| [`snippets/`](./snippets/) · 16 files | `~/.luna/theme/snippets/` |
| [`export/`](./export/) · 1 file | `~/.luna/theme/export/` |

`~/.luna` lives under your home directory (e.g. `/Users/you/.luna` on macOS). Lunote creates subfolders on first run.

**Related docs:** [Themes guide](../guide/themes.md) · [Theme folder](../theme/README.md) · [External CSS reference](../theme/external-css.md) · [Plugin theme packs](../theme-plugin-example/README.md) · [Selector reference](./SELECTORS.md) · [JSON schema starter](../theme/tokens/custom-theme.example.json)

---

## Where to enable (Preferences)

Open **File → Preferences** (`Cmd+,` / `Ctrl+,`).

### Appearance

Three tabs — match how files are applied:

| Tab | What it controls | Example files |
|-----|------------------|---------------|
| **Built-in theme** | Built-in color variants (GitHub / IDEA / Dim) + **Custom theme file** (JSON tokens) | `tokens/*.json` |
| **External CSS** | One active full CSS theme for editor UI + import new `.css` into `style/` | `style/*.css` |
| **UI snippets** | Stackable `.css` tweaks (search, filter, enable multiple) + import snippets | `snippets/*.css` |

**Rescan** after adding files: **Theme → Rescan** from the menu bar, or the **Rescan** buttons on the **External CSS** / **UI snippets** / **Export styles** panels.

### Export

Two tabs:

| Tab | What it controls |
|-----|------------------|
| **Presets** | Paper size, table of contents, page breaks |
| **Export styles** | Enable multiple `export/*.css` files (HTML / PDF / PNG only) |

Export CSS does **not** change the live editor.

### Plugins (optional)

**Preferences → Plugins** can install theme packs that copy assets into `~/.luna/theme/`. See [theme-plugin-example](../theme-plugin-example/README.md). Manual copies from this directory work the same way.

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

**Prefer** `--editor-column-width` over `max-width` on `.ProseMirror`. Column width presets (Narrow / Standard / Wide) also live under **Preferences → Editor → Writing appearance**.

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

### Built-in color variants

**Preferences → Appearance → Built-in theme → Theme** lists six variants in three groups:

| Group | Light | Dark |
|-------|-------|------|
| GitHub | `github-light` | `github-dark` |
| IDEA | `idea-light` | `idea-dark` |
| Dim | `dim-light` | `dim-dark` |

JSON token themes and external CSS stack on top of the active built-in variant.

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

### External CSS (one full editor theme)

1. Copy e.g. [`style/paper-ink.css`](./style/paper-ink.css) → `~/.luna/theme/style/paper-ink.css`.
2. **Preferences → Appearance → External CSS** → **Rescan** (or **Theme → Rescan**).
3. Under **External CSS theme**, choose `paper-ink.css`.
4. Or drag a `.css` file into **External CSS file** → **Import CSS**.

### JSON token theme

1. Copy e.g. [`tokens/ocean-glass.json`](./tokens/ocean-glass.json) → `~/.luna/theme/tokens/`.
2. **Preferences → Appearance → Built-in theme** → **Rescan**.
3. **Custom theme file** → pick the JSON file, or **Import Theme** to add a new one.

JSON themes set **app chrome palette** (5 colors + radius/spacing). For full editor/code styling, pair with a matching `style/*.css` or use external CSS alone.

### UI snippets

1. Copy files from [`snippets/`](./snippets/) → `~/.luna/theme/snippets/`.
2. **Preferences → Appearance → UI snippets** → **Rescan**.
3. Enable any combination in the snippet list (search by filename, filter **All** / **Enabled**).
4. Or import via **Snippet file** → **Import snippet**.

### Export-only CSS

1. Copy e.g. [`export/print-comfort.css`](./export/print-comfort.css) → `~/.luna/theme/export/print-comfort.css`.
2. **Preferences → Export → Export styles** → **Rescan**.
3. Enable `print-comfort.css` in the export style list.

---

## Recommended pairings

| JSON (`tokens/`) | CSS (`style/`) | Mood |
|------------------|----------------|------|
| [tokyo-night.json](./tokens/tokyo-night.json) | [tokyo-night.css](./style/tokyo-night.css) | Deep blue-purple dark |
| [forest-dawn.json](./tokens/forest-dawn.json) | [forest-dawn.css](./style/forest-dawn.css) | Calm green daytime |
| [sakura-breeze.json](./tokens/sakura-breeze.json) | [sakura-breeze.css](./style/sakura-breeze.css) | Soft pink light |
| [midnight-aurora.json](./tokens/midnight-aurora.json) | [midnight-aurora.css](./style/midnight-aurora.css) | Teal & violet dark |
| [paper-ink.json](./tokens/paper-ink.json) | [paper-ink.css](./style/paper-ink.css) | Cream paper, literary |
| [alpine-mist.json](./tokens/alpine-mist.json) | [alpine-mist.css](./style/alpine-mist.css) | Crisp blue-white productivity |
| [cobalt-dusk.json](./tokens/cobalt-dusk.json) | [cobalt-dusk.css](./style/cobalt-dusk.css) | High-contrast cobalt dark |

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
| [honey-paper.json](./tokens/honey-paper.json) | light | Warm paper reading tone |

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
| [alpine-mist.css](./style/alpine-mist.css) | Airy cool light/dark palette with restrained accents |
| [cobalt-dusk.css](./style/cobalt-dusk.css) | Cobalt dark + crisp code block contrast |

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
| [alpine-mist.json](./tokens/alpine-mist.json) | light |
| [cobalt-dusk.json](./tokens/cobalt-dusk.json) | dark |
| [honey-paper.json](./tokens/honey-paper.json) | light |

Schema: [custom-theme.example.json](../theme/tokens/custom-theme.example.json).

---

## UI snippets

Copy from [`snippets/`](./snippets/) → `~/.luna/theme/snippets/`. Stack any combination on the **UI snippets** tab.

| File | Effect |
|------|--------|
| [extra-chrome.css](./snippets/extra-chrome.css) | Table / preview pre·img rounding (on top of built-in defaults) |
| [editor-polish.css](./snippets/editor-polish.css) | Legacy alias — same as `extra-chrome` |
| [link-accent.css](./snippets/link-accent.css) | Stronger `.pm-link-inline` underline |
| [reading-comfort.css](./snippets/reading-comfort.css) | Looser line height & paragraph spacing (overrides built-in 1.7) |
| [soft-callouts.css](./snippets/soft-callouts.css) | Callout hover lift |
| [serif-headings.css](./snippets/serif-headings.css) | Serif h1–h2 via NodeView selectors |
| [warm-selection.css](./snippets/warm-selection.css) | Stronger selection than built-in 18% tint |
| [reading-edge-fade.css](./snippets/reading-edge-fade.css) | Subtle top / bottom viewport fade (most common) |
| [reading-edge-fade-deep.css](./snippets/reading-edge-fade-deep.css) | Deeper top / bottom fade for tall displays |
| [reading-vignette.css](./snippets/reading-vignette.css) | Four-edge viewport vignette |
| [reading-side-fade.css](./snippets/reading-side-fade.css) | Left / right fade for ultrawide layouts |
| [reading-scroll-mask.css](./snippets/reading-scroll-mask.css) | Vertical mask on scrolling ProseMirror content |
| [reading-frost-glass.css](./snippets/reading-frost-glass.css) | Frosted-glass backdrop blur on editor surface |
| [code-gutter-solid.css](./snippets/code-gutter-solid.css) | Opaque code gutters to avoid line-number overlap artifacts |
| [compact-sidebar.css](./snippets/compact-sidebar.css) | Dense sidebar rows for large vaults |
| [crisp-code-shadow.css](./snippets/crisp-code-shadow.css) | Sharper fenced code block edges and hover feedback |

**Reading fade snippets:** enable **one** overlay/mask snippet at a time (`reading-edge-fade*`, `reading-vignette`, `reading-side-fade`, `reading-scroll-mask`). `reading-frost-glass` can stack with a fade snippet.

### Snippet vs built-in

| Snippet | Still needed? |
|---------|----------------|
| extra-chrome | Yes — tables, preview pre/img, raw `pre` |
| reading-comfort | Yes — intentionally looser than default |
| warm-selection | Yes — stronger than default 18% |
| link-accent | Yes — stronger underline on `.pm-link-inline` |
| soft-callouts | Optional — hover lift on callouts |
| serif-headings | Yes — after NodeView selector fix |
| reading-edge-fade* / vignette / side-fade / scroll-mask | Yes — optional reading chrome (pick one) |
| reading-frost-glass | Optional — frosted editor surface; stacks with one fade |
| code-gutter-solid | Yes — stabilizes code gutter readability with token-only themes |
| compact-sidebar | Optional — denser sidebar information density |
| crisp-code-shadow | Optional — stronger fenced code visual hierarchy |

### Suggested stacks

| Goal | Enable |
|------|--------|
| Long-form reading | [paper-ink.css](./style/paper-ink.css) + `serif-headings` + `reading-comfort` + `reading-edge-fade` + `warm-selection` |
| Immersive dark read | [midnight-aurora.css](./style/midnight-aurora.css) + `reading-vignette` + `reading-frost-glass` |
| Ultrawide focus | [paper-ink.css](./style/paper-ink.css) + `reading-side-fade` + `reading-comfort` |
| Dark writing | [midnight-aurora.css](./style/midnight-aurora.css) + `link-accent` + `soft-callouts` |
| Daytime focus | [forest-dawn.css](./style/forest-dawn.css) + `reading-comfort` + `extra-chrome` |
| Code & notes (night) | [tokyo-night.css](./style/tokyo-night.css) + `soft-callouts` + `extra-chrome` |
| Minimal pink light | [sakura-breeze.css](./style/sakura-breeze.css) + `extra-chrome` |
| Token-only with stable gutters | `any tokens/*.json` + `code-gutter-solid` |
| Literary PDF export | [paper-ink.css](./style/paper-ink.css) + [print-comfort.css](./export/print-comfort.css) on **Export styles** |

---

## Export-only CSS

Copy from [`export/`](./export/) → `~/.luna/theme/export/`. Target `.markdown-body.markdown-export-body` and `body.markdown-export-root` — see [SELECTORS.md → Export / static preview](./SELECTORS.md#export--static-preview).

| File | Effect |
|------|--------|
| [print-comfort.css](./export/print-comfort.css) | Serif body, relaxed line height for HTML/PDF/PNG |

Enable on **Preferences → Export → Export styles**. Paper presets stay on the **Presets** tab.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Theme not in dropdown | **Rescan** on the correct tab; check extension (`.css` / `.json`) and subfolder (`style`, `tokens`, `snippets`, `export`). |
| JSON theme does nothing | **Built-in theme** tab → **Custom theme file**; disable external CSS to compare token colors. |
| External CSS ignored | **External CSS** tab → pick file under **External CSS theme** (not snippets). |
| Snippet has no effect | **UI snippets** tab → enable the file; confirm it is under `snippets/`, not `style/`. |
| Dark mode looks flat | Ensure external CSS defines **both** `html[data-theme='light']` and `html[data-theme='dark']` blocks. |
| Heading styles ignored | Use `.pm-heading-block--lN .pm-heading-content` — see [SELECTORS.md](./SELECTORS.md). |
| Callouts ignore accent | Override `--luna-callout-*` on `html[data-theme]` instead of hard-coding callout hex in rules. |
| Export differs from editor | Expected — use `~/.luna/theme/export/` and **Export styles** tab. |
| Export style not listed | **Export → Export styles → Rescan**; file must be `.css` in `export/`. |
| Reading fade looks doubled | Disable extra fade snippets — only one overlay/mask at a time. |
| Fade color mismatch | Set `--reading-fade-color` / `--reading-vignette-color` to match `--surface-editor`. |
| Code line numbers overlap long code | Enable `code-gutter-solid.css` or use a full `style/*.css` theme with explicit `--code-gutter-bg`. |

More: [Themes guide → Tips](../guide/themes.md#tips).
