<div align="center">

# Lunote

**A local-first Markdown workspace for writing, linking, and building a personal knowledge base**

*Write in a polished editor, connect ideas with wiki links, and keep every note as plain `.md` on your disk. Free, open source, and built for offline work.*

**Typora-style writing + Obsidian-style linking — built in, no plugins.**

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**Docs:** [All languages](docs/README.md) · [简体中文](docs/README.zh-CN.md)

**Guide:** [Themes](docs/guide/themes.md) · [Shortcuts & `/` commands](docs/guide/shortcuts-and-menus.md) · [All guides](docs/guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[Preview](#preview) · [Why Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [Download](#download) · [Quick start](#quick-start) · [User guide](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="docs/assets/demo/lunote-demo.gif" alt="Lunote — 10s demo: writing, wiki links, knowledge graph, and themes" width="720" />
  </a>
</p>
<p align="center"><sub>10s tour · local Markdown · wiki links · graph · themes · no plugins</sub></p>

</div>

---

## What is Lunote?

Lunote is a desktop Markdown workspace for people who want three things together:

- **Plain local Markdown files**
- **A strong writing experience**
- **Built-in linked-note workflows**

Open any folder as a workspace and keep working on normal `.md` files you still own. Write in visual mode when you want flow, switch to Markdown source when you want control, and use wiki links, backlinks, graph, and search without relying on plugins.

| | |
|---|---|
| **Platforms** | macOS, Windows, Linux |
| **UI languages** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG |
| **Tech** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## Preview


<p align="center">
  <img src="docs/assets/screenshots/hero-preview.png" alt="Lunote main workspace" width="720" />
</p>

| Visual editor | Knowledge graph | Theme |
| :---: | :---: | :---: |
| <img src="docs/assets/screenshots/editor-visual.png" alt="Visual editor" width="240" style="max-width: 100%; height: auto;" /> | <img src="docs/assets/screenshots/knowledge-graph.png" alt="Knowledge graph" width="240" style="max-width: 100%; height: auto;" /> | <img src="docs/assets/screenshots/theme-presets.png" alt="Export options" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Why Lunote

- **Local-first**: your notes stay as normal Markdown files in folders you control.
- **Editor-first**: visual editing and raw Markdown source are both first-class.
- **Knowledge-ready**: wiki links, backlinks, graph, outline, and search are built in.
- **Practical**: export when needed, sync with your own tools, and work offline.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| Compare point | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Best fit** | Clean single-document writing | Plugin-heavy PKM and vault customization | Writing + linked knowledge in one app |
| **Editing style** | Minimal Markdown editor | Markdown platform with extensions | Visual editing + raw Markdown source |
| **Knowledge features** | Limited | Strong, often plugin-driven | Built-in wiki links, backlinks, graph, search |
| **Setup complexity** | Low | Medium to high | Low to medium |
| **Plugin dependence** | Low | High | Low |
| **Choose it if...** | You mainly want a writing app | You mainly want an ecosystem | You want a balance of writing and knowledge workflows |

---

<a id="download"></a>

## Download

**[Latest release →](https://github.com/lunote-code/lunote/releases)**

Current GitHub release workflow artifacts:

| Platform | Package | Workflow reference |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

macOS first launch:

1. Move **Lunote** to **Applications**
2. **Right-click → Open → Open**
3. If needed, run `xattr -cr /Applications/Lunote.app`

---

<a id="quick-start"></a>

## Quick start

1. Install Lunote for your platform.
2. Open a folder with Markdown notes, or start a new workspace.
3. Write, link notes with `[[`, search with `Ctrl+Shift+F` / `Cmd+Shift+F`, and export when needed.

If you already have an Obsidian, Logseq, or Typora-based Markdown library, just open the folder. No import is required.

---

<a id="user-guide"></a>

## User guide

English how-to guides (themes, shortcuts, and the full **`/`** slash command list):

- [Themes](docs/guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [Shortcuts & quick menus](docs/guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Guide index](docs/guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**Do I need an account or internet?**  
No. Lunote works offline and keeps notes local unless you sync them yourself.

**Can I use an existing Markdown library?**  
Yes. Open any folder with `.md` / `.markdown` files.

**Is it compatible with other tools?**  
Yes. Lunote uses standard Markdown, so the same folder can still be used with Obsidian, VS Code, Typora, or Git.

**Does it replace Obsidian or Notion entirely?**  
Lunote focuses on local Markdown, strong editing, and built-in linking. If you need a mobile app or a big plugin ecosystem, you may still pair it with other tools.

**How do I report bugs or request features?**  
[Open an issue](https://github.com/lunote-code/lunote/issues) or start a [discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## License

Open-source software. See the repository license file for terms.

---

<a id="sponsor"></a>

## Support the project

If Lunote helps you:

- **[Star the repo](https://github.com/lunote-code/lunote)** — it helps others discover the project
- **[Share feedback](https://github.com/lunote-code/lunote/discussions)** — ideas and use cases matter as much as code

If Lunote helps you, you can voluntarily sponsor development via **TRC20 USDT** on the Tron network.

| | |
|---|---|
| **Network** | Tron (TRC20) · USDT |
| **Address** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>Verify the address before sending. On-chain transfers cannot be reversed. Sponsorship is voluntary and does not constitute a purchase of services.</sub>

---