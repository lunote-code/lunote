# Export style examples

Export-only CSS lives in **`~/.luna/theme/export/`**. These files affect HTML, PDF, and PNG output—not the live editor.

## Ready-made sample

Copy from the repo:

| File | Copy to |
|------|---------|
| [theme-example/export/print-comfort.css](../theme-example/export/print-comfort.css) | `~/.luna/theme/export/print-comfort.css` |

Then **Preferences → Export → Export styles** → **Rescan** → enable the file.

Paper size, margins, and TOC options are on the **Presets** tab in the same section.

## Your own files

Add `.css` files under `~/.luna/theme/export/` and target export hosts such as `.markdown-body.markdown-export-body`. See [SELECTORS.md](../theme-example/SELECTORS.md#export--static-preview).
