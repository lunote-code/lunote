# Theme customization

Part of [Lunote docs](../README.md). Lunote keeps **all user appearance files** under **`~/.luna/theme/`**. The repo mirrors that layout here and in [theme examples](../theme-example/README.md).

## Folder layout (user machine)

```text
~/.luna/theme/
  README.md              ← created on first run (short folder guide)
  style/*.css            ← external CSS themes (editor UI)
  snippets/*.css         ← stackable UI snippets
  export/*.css           ← export-only CSS (HTML / PDF / PNG)
  tokens/*.json          ← JSON color token themes
```

| Subfolder | Affects editor | Affects export | Docs in this repo |
|-----------|----------------|----------------|-------------------|
| `style/` | Yes (one active file) | No | [external-css.md](./external-css.md), [style/](./style/) |
| `snippets/` | Yes (multiple) | No | [snippets/](./snippets/), [theme-example/snippets/](../theme-example/README.md#ui-snippets) |
| `export/` | No | Yes | [export/](./export/) |
| `tokens/` | Yes (JSON import) | No | [tokens/](./tokens/), [theme-example/tokens/](../theme-example/README.md#json-token-themes) |

After adding or editing files: **Preferences → Appearance** (or **Export** for `export/`) → **Rescan**, or **Theme → Rescan** from the menu bar.

Legacy paths (`~/.luna/config/Theme/`, loose `~/.luna/theme/*.css` / `*.json` at the theme root) are migrated automatically into the subfolders above.

## Starters in this directory

| File | Copy to |
|------|---------|
| [style/crossplatnote-theme.example.css](./style/crossplatnote-theme.example.css) | `~/.luna/theme/style/` |
| [tokens/custom-theme.example.json](./tokens/custom-theme.example.json) | `~/.luna/theme/tokens/` |

## Ready-made themes (in this repo)

**[theme-example/](../theme-example/README.md)** — complete samples you can copy:

- `theme-example/style/*.css` → `~/.luna/theme/style/`
- `theme-example/tokens/*.json` → `~/.luna/theme/tokens/`
- `theme-example/snippets/*.css` → `~/.luna/theme/snippets/`
- `theme-example/export/*.css` → `~/.luna/theme/export/`

See the [quick start](../theme-example/README.md#quick-start) there, then **Rescan** in Preferences.

## User guide

Overview for readers: [Themes guide](../guide/themes.md).
