# JSON token themes

Token files override built-in app colors (sidebars, chrome, semantic CSS variables). They do **not** replace a full external CSS theme.

Code tokens (`--code-bg`, `--code-gutter-*`, `--inline-code-bg`) are auto-derived at runtime from JSON palette colors. For stronger control, pair with a `style/*.css` theme or add a snippet such as `code-gutter-solid.css`.

| Resource | Description |
|----------|-------------|
| [custom-theme.example.json](./custom-theme.example.json) | Minimal schema starter |
| [theme-example/tokens/](../../theme-example/README.md#json-token-themes) | Full preset gallery |

Copy a `.json` file to **`~/.luna/theme/tokens/`**, rescan, then **Import Theme** or select under **Preferences → Appearance → Custom theme file**.
