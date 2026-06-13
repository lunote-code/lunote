# Themes

Lunote separates **what you see while editing** from **how exported files look**. You can combine a built-in color scheme with JSON token themes, external CSS, optional snippets, and export-only styles.

Open **File → Preferences** (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux), then use the **Appearance** section (three tabs below) and **Export** for print/PDF-related options.

---

## Built-in themes

These control Lunote’s default UI tokens (sidebars, editor chrome). They do **not** read files from `.luna/theme/` by themselves.

On **Preferences → Appearance → Built-in theme → Theme**, choose among six variants in three groups:

| Group | Light | Dark |
|-------|-------|------|
| GitHub | GitHub — light | GitHub — dark |
| IDEA | IDEA — light | IDEA — dark |
| Dim | Dim — light | Dim — dark |

Switch from the desktop **Theme** menu or **Preferences → Appearance → Built-in theme**.

**Custom JSON theme:** Place `.json` files in **`.luna/theme/tokens/`**, rescan, then use **Import Theme** or pick a file under **Custom theme file** on the same tab. See [token schema](../theme/tokens/custom-theme.example.json) and [theme examples](../theme-example/README.md#json-token-themes).

---

## Theme folder layout

All user appearance files live under **`~/.luna/theme/`** (**Theme → Open Theme folder…** or **Preferences → Appearance**).

```text
~/.luna/theme/
  README.md              ← short guide (created on first run)
  style/
    my-theme.css         ← external CSS (editor UI)
  snippets/
    tweak.css            ← stackable UI overrides
  export/
    print.css            ← HTML / PDF / PNG only
  tokens/
    my-colors.json       ← JSON color token themes
```

| Path | Editor UI | Export |
|------|-----------|--------|
| `style/*.css` | Yes (one active external theme) | No |
| `snippets/*.css` | Yes (multiple, stacked) | No |
| `export/*.css` | No | Yes |
| `tokens/*.json` | Yes (token override / import) | No |

**Rescan** after adding or editing files (**Preferences** or **Theme → Rescan**).

The repo documents the layout under [docs/theme/](../theme/README.md). **Ready-made themes for users** live in **[docs/theme-example/](../theme-example/README.md)** (copy → rescan → enable)—committed with the project, not a local-only folder.

Older installs: content under `~/.luna/config/Theme/` or loose `.css` / `.json` in the theme root is migrated into these subfolders automatically.

---

## External CSS theme

1. Copy a `.css` file into **`~/.luna/theme/style/`** (not `snippets/`, `export/`, or `tokens/`).
2. **Preferences → Appearance → External CSS** → **Rescan**.
3. Choose the file under **External CSS theme**, or import via **External CSS file** → **Import CSS**.

Only **one** full external CSS file is active at a time. When it is active, built-in preset colors and JSON token variables step aside so the CSS file owns the palette; **UI snippets** still stack on top.

**Priority (low → high):** built-in presets → token variables → **external CSS** → UI snippets.

Reference: [External CSS](../theme/external-css.md) · starter: [crossplatnote-theme.example.css](../theme/style/crossplatnote-theme.example.css) · gallery: [theme-example/style/](../theme-example/README.md#external-css-themes).

---

## UI snippets

Extra `.css` files in **`.luna/theme/snippets/`**. On **Preferences → Appearance → UI snippets**, enable **multiple** snippets (search, filter All/Enabled, import via **Import snippet**); they apply after the active external CSS theme.

Use snippets for small tweaks (fonts, links, callouts) without replacing a full theme. Examples: [theme-example/snippets/](../theme-example/README.md#ui-snippets).

---

## Export-only CSS

Files in **`.luna/theme/export/`** style **exported** HTML, PDF, and PNG. They do **not** change the live editor.

Enable styles on **Preferences → Export → Export styles**. Paper size, TOC, and page breaks are on the **Presets** tab. Sample: [theme-example/export/print-comfort.css](../theme-example/export/print-comfort.css).

---

## Color presets (toolbar)

In **visual mode**, the browser preview build may show a toolbar **color preset** control. On the **desktop app**, use the **Theme** menu and **Preferences → Appearance** for the full set.

---

## Tips

- **Editor looks wrong after CSS changes:** Rescan, or disable snippets one by one to find a conflict.
- **Export differs from the editor:** Expected when using `export/` styles—tune export CSS separately.
- **Missing file warning:** Rescan after restoring the file under `style/`, `tokens/`, or `snippets/`.
