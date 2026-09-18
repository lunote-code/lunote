# Lunote documentation

Product overview and user docs. Start with the root [README.md](../README.md) (English) or pick a language below.

**Positioning:** AI-powered personal knowledge base — an **AI-native knowledge management workspace** where connected notes, knowledge discovery, graph visualization, and optional **workspace encryption** (AES-256-GCM, idle auto-lock) work together locally. Current app version: **1.0.3**.

## What is in this repository

```text
docs/
├── README.md              ← this file
├── README.{locale}.md     ← product overview (10 languages)
├── README.en.md           ← English copy (same structure as root README; links relative to `docs/`)
├── assets/                ← screenshots & demo GIF for READMEs
├── guide/                 ← user guide (English)
├── theme/                 ← theme folder layout & external CSS reference
└── theme-example/         ← ready-made themes (copy into ~/.luna/theme/)
```

| Path | Description |
|------|-------------|
| [guide/](guide/README.md) | How to use the desktop app |
| [theme/](theme/README.md) | `~/.luna/theme/` layout, starters, [external CSS](theme/external-css.md) |
| **[theme-example/](theme-example/README.md)** | **39 sample files** (7 CSS themes, 15 JSON tokens, 16 snippets, 1 export style) |
| [README.en.md](README.en.md) etc. | Localized product pages |

## User guide (English)

| Doc | Topic |
|-----|--------|
| [Guide index](guide/README.md) | Entry point |
| [Themes](guide/themes.md) | Built-in themes, Theme folder, CSS, snippets, export |
| [Shortcuts & menus](guide/shortcuts-and-menus.md) | Command Palette, shortcuts, **`/`** slash commands |
| [Workspace encryption](guide/workspace-encryption.md) | AES-256-GCM, optional image encryption, idle auto-lock |
| [Knowledge graph](guide/knowledge-graph.md) | Local subgraph, Global / fullscreen, performance caps |
| [Editor Tab semantics](guide/editor-tab-semantics.md) | Visual vs source Tab, block-level Select All |
| [Templates](Templates/README.md) | Default and daily note templates, variables, optional new-note templates |
| [Platform differences](guide/platform-differences.md) | PDF, print, reveal in file manager, OS notes |
| [Packaging & signing](packaging-strategy.md) | Release workflow, GitHub Secrets, installers |

Localized READMEs link here as `docs/guide/…` on GitHub.

## Themes

| Doc | Topic |
|-----|--------|
| [Theme index](theme/README.md) | Maps to `~/.luna/theme/{style,snippets,export,tokens}/` |
| [External CSS](theme/external-css.md) | Variables, selectors, migration |
| **[Theme examples](theme-example/README.md)** | **Start here for ready-made themes** — copy files, rescan, enable in Preferences |

`theme-example/` is part of this repo (not local-only): `style/*.css`, `tokens/*.json`, `snippets/*.css`.

## Languages

English · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [English (docs)](README.en.md)

Supported in the app UI: the languages above.

## Assets

READMEs expect media under `docs/assets/`:

```text
assets/demo/lunote-demo.gif
assets/screenshots/AI.png
assets/screenshots/graph.png
assets/screenshots/ai+code-view.png
assets/screenshots/code-view.png
assets/screenshots/source-view.png
assets/screenshots/mermaid.png
assets/screenshots/search.png
assets/screenshots/theme.png
assets/screenshots/head-view.png
assets/screenshots/snipaste.png
```

Root [README.md](../README.md) uses the `docs/assets/` prefix; files in `docs/README.*.md` use `assets/` (relative to `docs/`).

## Maintainer-only (not in this repo)

These stay on your machine (`.gitignore`): `.cursor/`, `.venv-*/`, `scripts/sponsor.json`, `docs/compatibility/`, `docs/qa/`, `docs/adr/`, and most of `scripts/` — see [scripts/README.md](../scripts/README.md) for what **is** committed for CI/release.
