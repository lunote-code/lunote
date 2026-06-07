# README screenshots

PNG files referenced by the root [README.md](../../../README.md) and localized `docs/README.*.md` files.

## Main UI (`screenshots/`)

| File | Description |
|------|-------------|
| `head-view.png` | First launch / welcome (fallback hero when no locale image) |
| `code-view.png` | Visual / code editor |
| `source-view.png` | Markdown source view |
| `graph.png` | Knowledge graph |
| `search.png` | Global search |
| `snipaste.png` | History snapshots |
| `theme.png` | Theme settings (Preferences → Appearance) |

## Localized hero (`screenshots/language/`)

README hero image per UI language (Preferences screenshot). Mapped in `scripts/maintenance/data/readme_preview_i18n.json`:

| File | README locale |
|------|----------------|
| `en.png` | English (`README.md`, `docs/README.en.md`) |
| `cn.png` | 简体中文 (`docs/README.zh-CN.md`) |
| `cn-tw.png` | 繁體中文 (`docs/README.zh-TW.md`) |
| `de.png` | Deutsch |
| `fr.png` | Français |
| `es.png` | Español |
| `it.png` | Italiano |
| `jp.png` | 日本語 |
| `kr.png` | 한국어 |
| `pr.png` | Português (Brasil) |
| `ru.png` | Русский |

## Theme gallery (`screenshots/theme/`)

README **More theme previews** grid (order in `scripts/maintenance/data/readme_preview_i18n.json`):

| File | Preset |
|------|--------|
| `github-light.png` / `github-dark.png` | GitHub |
| `idea-light.png` / `idea-dark.png` | IDEA |
| `dim-light.png` / `dim-dark.png` | Dim |
| `forest-dawn.png` | Forest Dawn |
| `ember-glow.png` | Ember Glow |
| `graphite-noir.png` | Graphite Noir |
| `lavender-haze.png` | Lavender Haze |

Copyable theme **files** (CSS / JSON / snippets) live in [docs/theme-example/](../../theme-example/README.md).

Regenerate README preview blocks after changing screenshots:

```bash
python3 scripts/maintenance/apply_readme_core_sections.py
npm run assets:readme-demo-gif
```
