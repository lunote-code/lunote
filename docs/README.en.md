<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>Build a connected knowledge system with AI.</strong><br />
  <em>Lunote combines Markdown notes, wiki links, knowledge graph visualization, and AI-powered knowledge discovery to help you think, learn, and create more effectively.</em><br />
  <em>Turn scattered notes into connected knowledge — local-first, optional AES-256 workspace encryption, and fully under your control.</em>
</p>

<p align="center">
  Available for <strong>macOS</strong>, <strong>Windows</strong>, and <strong>Linux</strong>.
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
  <a href="#key-features"><img src="https://img.shields.io/badge/workspace%20encryption-AES--256--GCM-green" alt="AES-256 workspace encryption" /></a>
</p>

<h3 align="center">
  <a href="#preview">Screenshots</a> &nbsp;|&nbsp;
  <a href="#why-lunote">Why Lunote</a> &nbsp;|&nbsp;
  <a href="#key-features">Features</a> &nbsp;|&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;|&nbsp;
  <a href="#download">Download</a> &nbsp;|&nbsp;
  <a href="#contributing">Contributing</a>
</h3>

<p align="center">
  <strong>Docs:</strong> <a href="README.md">All languages</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>Translations:</strong>
  <a href="../README.md">🇬🇧</a>
  <a href="README.zh-CN.md">🇨🇳</a>
  <a href="README.zh-TW.md">🇹🇼</a>
  <a href="README.ja.md">🇯🇵</a>
  <a href="README.ko.md">🇰🇷</a>
  <a href="README.de.md">🇩🇪</a>
  <a href="README.fr.md">🇫🇷</a>
  <a href="README.es.md">🇪🇸</a>
  <a href="README.pt.md">🇵🇹</a>
  <a href="README.it.md">🇮🇹</a>
  <a href="README.ru.md">🇷🇺</a>
</p>

<p align="center">
  <strong>Guide:</strong> <a href="guide/themes.md">Themes</a> · <a href="guide/shortcuts-and-menus.md">Shortcuts & slash (/) commands</a> · <a href="guide/README.md">All guides</a>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">Screenshots</a> · <a href="#why-lunote">Why Lunote</a> · <a href="#key-features">Features</a> · <a href="#compare">Compare</a> · <a href="#download">Download</a> · <a href="#getting-started">Getting Started</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <img src="assets/demo/lunote-demo.gif" alt="Lunote — demo: connected knowledge, wiki links, AI, knowledge graph visualization" width="720" />
</p>
<p align="center"><sub>Connected knowledge · `[[wiki links]]` · AI discovery · graph visualization · local-first · optional encryption</sub></p>

---

Lunote is an **AI-native knowledge management workspace** — a personal knowledge base where ideas connect, grow, and become something AI can truly understand. Open any folder of `.md` files and start building a system, not just a pile of notes.

| | |
|---|---|
| **Platforms** | macOS, Windows, Linux |
| **UI languages** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG · print |
| **Security** | Optional workspace encryption (AES-256-GCM) · passwords never saved on disk |

**v1.0.4** patch: opening a workspace no longer hangs on the loading overlay; the visual editor stays on TipTap 3.23.1 after 3.30/3.31 broke editing.

---

<a id="why-lunote"></a>

## Why Lunote

Most note apps help you **capture** information. Few help you **build knowledge**.

- **Ordinary notes become silos** — ideas pile up in folders, but relationships stay invisible. You remember writing something, but not how it connects to everything else.
- **Connections are how knowledge compounds** — wiki links, backlinks, and related notes turn isolated pages into a network you can navigate, revisit, and extend.
- **AI should understand your whole knowledge base** — not just the open document. When AI reads your workspace context, linked notes, and search results, it can synthesize, suggest links, surface gaps, and help you form new insights.
- **Your notes can stay encrypted at rest** — optional AES-256-GCM workspace encryption protects Markdown on disk; image attachments stay plaintext unless you enable **Encrypt images**; unlock with your password each session; idle auto-lock can lock after inactivity; passwords are never saved.

Lunote is built for this: a **local-first personal knowledge base** with optional **workspace encryption**, where connected thinking and AI understanding work together — without cloud lock-in, accounts, or a plugin maze.

---

<a id="key-features"></a>

## Key Features

<!-- readme-body-start -->

### AI-Powered Knowledge Base

AI that understands and works with your notes — not a sidecar chat window.

- **Workspace-aware conversations** — chat with context from the current note, selection, `@`-mentioned notes, linked neighbors, and workspace search
- **AI search** — retrieve relevant snippets across your vault when you ask
- **Summaries & synthesis** — condense notes, selections, or themes into clear takeaways
- **Writing assistance** — continue, rewrite, translate, and structure content in Lunote Markdown
- **Knowledge synthesis** — cross-note analysis, workspace overviews, and topic-level insight

Bring your own API key (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, and more) in **Preferences → AI**.

### Connected Knowledge

Build relationships between ideas — the foundation of a living knowledge system.

- **Wiki links** — `[[link notes]]` naturally as you write; rename a note and links update across the vault
- **Backlinks** — see what points to the note you're reading
- **Related notes** — follow threads without losing context
- **Bidirectional linking** — connections work both ways, automatically

### Knowledge Discovery

Find related ideas, patterns, and hidden connections across your workspace.

- **Link suggestions** — AI proposes `[[wiki links]]` based on your existing notes
- **Relationship discovery** — surface how topics cluster and relate
- **Topic exploration** — map what you know, what's missing, and what to write next
- **Missing connection detection** — spot gaps, orphans, and underlinked ideas

### Knowledge Graph Visualization

The graph is a **view of your knowledge network** — how ideas connect around what you're thinking about right now.

- **Local subgraph** centered on the open note — choose depth and filters
- **Navigate by connection** — jump between linked notes from the graph
- **See knowledge evolve** — watch clusters form as you link more ideas

> The default view is a **local subgraph** around the active note. Use **Global** or fullscreen for a workspace-wide link graph. Performance caps: **extended** (default) 400 nodes / 700 edges, **standard** 250 / 400, **compact** 120 / 200 — not an unlimited vault graph like Obsidian.

### Markdown Native

Future-proof notes in an open, portable format.

- **Markdown first** — write in visual or source mode; focus mode when you need depth
- **Open format** — plain `.md` files on disk; no proprietary database
- **Portable notes** — open the same folder in Obsidian, Typora, or any Markdown tool
- **Rich content** — code blocks, tables, math, Mermaid, callouts; export to PDF, Word, HTML, PNG

### Workspace Encryption

Protect sensitive notes at rest — built in, no plugin required.

- **AES-256-GCM** — Markdown note bodies encrypted on disk
- **Password per session** — unlock when opening the workspace; never saved to disk
- **Optional per workspace** — enable in **Preferences → Security**
- **Images optional** — attachments stay plaintext by default; enable **Encrypt images** to encrypt common image files (PNG, JPEG, WebP, GIF, HEIC, SVG, etc.)
- **Idle auto-lock** — after inactivity (default 5 minutes; off, 1–60 minutes, or Never), save then lock an unlocked encrypted workspace; leftover dirty work skips the lock

### Local First

Your knowledge stays under your control.

- **You own the data** — notes live on your machine in a workspace folder
- **Workspace based** — open any vault; sync with Git, Syncthing, or iCloud on your terms
- **Privacy friendly** — offline-first, no account required; AI calls only what you configure
- **Encryption when you need it** — see [Workspace Encryption](#key-features) above; passwords never saved on disk
- **Lightweight** — core knowledge tools built in; [theme packs](https://github.com/lunote-code/lunote-theme) optional

### Productivity essentials

- Tabs, outline, Command Palette (`Cmd+Shift+P`), per-note snapshots and version history
- Global search (`Cmd+Shift+F` / `Ctrl+Shift+F`), `/` slash menu (AI continue / summarize / improve, drawing canvas, mindmap)
- Daily notes, optional new-note templates, system-tray quick capture
- Light/dark themes and optional packs in **Preferences → Plugins**

<!-- readme-body-end -->

---

<a id="preview"></a>

## Screenshots

<p align="center">
  <img src="assets/screenshots/ai+code-view.png" alt="AI + code view — workspace-aware writing" width="720" />
</p>
<p align="center"><sub>AI + code view — workspace-aware writing</sub></p>

<p align="center">
  <img src="assets/screenshots/graph.png" alt="Knowledge graph — explore connected ideas" width="720" />
</p>
<p align="center"><sub>Knowledge graph — explore connected ideas</sub></p>

### More

| AI assistant | Code editor | Source view |
| :---: | :---: | :---: |
| <img src="assets/screenshots/AI.png" alt="AI assistant" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/code-view.png" alt="Code editor" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="Source view" width="240" style="max-width: 100%; height: auto;" /> |

| Mermaid diagrams | Global search | Theme settings |
| :---: | :---: | :---: |
| <img src="assets/screenshots/mermaid.png" alt="Mermaid diagrams" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="Global search" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="Theme settings" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="getting-started"></a>

## Getting Started

1. **[Download](#download)** Lunote for macOS, Windows, or Linux.
2. **Open your workspace** — an Obsidian vault, Notion export folder, Typora directory, or any `.md` folder. No import step.
3. **Build connections** — type `[[` to link notes; check backlinks and the knowledge graph around your current note.
4. **Enable AI** — add your API key in **Preferences → AI**, then ask about your note or whole workspace.
5. **Discover & grow** — use AI link suggestions, workspace overviews, and search to find patterns and gaps.
6. **Optional: encrypt your workspace** — in **Preferences → Security**, enable workspace encryption to protect Markdown notes at rest. Enter your password when opening the workspace. Turn on **Encrypt images** if you want attachments encrypted too; set **Auto-lock after inactivity** if you want the session to lock when idle.

> **Switching tools?** Your files never move. Any Markdown app can read the same folder.

---

<a id="download"></a>

## Download

**[Download latest release →](https://github.com/lunote-code/lunote/releases)**

No sign-up · local `.md` files only · works offline · **optional workspace encryption**

<details>
<summary><strong>macOS first launch (Gatekeeper)</strong></summary>

1. Move **Lunote** to **Applications**
2. **Right-click → Open → Open**
3. If needed, run `xattr -cr /Applications/Lunote.app`

</details>

| Platform | Package |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) |

---

<a id="compare"></a>

## Lunote vs Notion vs Obsidian

| | Notion | Obsidian | Lunote |
|---|---|---|---|
| **Your data** | Cloud account | Local `.md` files | Local `.md` files |
| **Knowledge model** | Pages in a workspace | Vault + plugins | Connected workspace, built in |
| **AI** | Cloud AI on their data | Plugin-dependent | Workspace-aware AI (your API key) |
| **Wiki links & graph** | Basic | Full-vault graph (often plugin) | **Local subgraph** + discovery, built in |
| **Time to first note** | Sign up, then write | Tune plugins (optional) | Open folder → connect ideas |
| **Workspace encryption** | No | Plugin / OS-level | **Built-in** (AES-256-GCM, optional) |
| **Offline & privacy** | Partial | Full offline | Full offline, no account |

---

<a id="use-cases"></a>

## Use cases

- **Personal knowledge base** — grow a second brain with wiki links, backlinks, and AI synthesis
- **Research & learning** — connect readings, summaries, and insights across topics
- **Developer docs** — ADRs, runbooks, and snippets with code blocks and PDF export
- **Leaving Notion or Obsidian** — same Markdown folders, less overhead, no upload
- **Sensitive notes & journals** — optional workspace encryption keeps Markdown notes protected at rest; enable **Encrypt images** for common image attachments
- **Team async docs** — share a workspace via Git; everyone keeps plain `.md` files

---

<a id="roadmap"></a>

## Roadmap

Lunote is actively evolving toward a deeper **AI-native knowledge management** experience. Direction includes:

- Richer **knowledge discovery** — smarter link suggestions, topic maps, and gap detection
- Deeper **AI workspace understanding** — better context, synthesis, and cross-note reasoning
- Expanded **graph visualization** — more ways to explore how knowledge connects
- Continued **local-first** polish — performance, export, and cross-platform reliability

Track progress and propose ideas in [GitHub Discussions](https://github.com/lunote-code/lunote/discussions) and [Issues](https://github.com/lunote-code/lunote/issues).

---

<a id="star"></a>

## Star Lunote on GitHub

If Lunote helps you build connected knowledge, **[star the repository](https://github.com/lunote-code/lunote)** — it helps others discover an AI-powered personal knowledge base. Stories and ideas welcome in [Discussions](https://github.com/lunote-code/lunote/discussions).

---

<a id="user-guide"></a>

## User guide

English how-to guides (themes, shortcuts, encryption, graph, and the full **`/`** slash command list):

- [Themes](guide/themes.md) — built-in themes, Theme folder, external CSS, snippets, export styles, **Preferences → Plugins** catalog
- [Shortcuts & quick menus](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Workspace encryption](guide/workspace-encryption.md) — AES-256-GCM, optional image encryption, idle auto-lock
- [Knowledge graph](guide/knowledge-graph.md) — local subgraph, Global / fullscreen, performance caps
- [Platform differences](guide/platform-differences.md) — OS-specific PDF, print, reveal, and troubleshooting
- [Guide index](guide/README.md) — all guide pages

---

<a id="development"></a>

## Development

If you wish to build Lunote yourself:

- **Prerequisites:** Node.js, Rust, and [Tauri](https://tauri.app/) platform tooling.
- **Dev:** `npm install` then `npm run tauri:dev`
- **Bundle:** `npm run tauri:bundle` (or `tauri:bundle:dmg` / `msi` / `deb`)
- **Docs:** [Documentation index](README.md) · [Packaging](packaging-strategy.md) · [Scripts](../scripts/README.md)

Questions? [Open an issue](https://github.com/lunote-code/lunote/issues). Pull requests welcome.

---

<a id="contributing"></a>

## Contributing

Before a pull request:

- Read [Scripts & maintenance](../scripts/README.md) for locale and release tooling
- Run `npm run lint` and relevant tests when touching editor or export code
- Keep messaging consistent across [localized READMEs](README.md)

Ideas and migration stories: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## FAQ

**Do I need an account or internet?**  
No. Lunote is offline-first. Notes stay local until you sync the folder yourself. AI features require your own API key and network when you use them.

**Is Lunote an AI note app or a Markdown editor?**  
Lunote is a **personal knowledge base** — Markdown is how your notes are stored, and AI is how your workspace becomes understandable and discoverable. The editor serves the knowledge system, not the other way around.

**Can I open my Obsidian vault?**  
Yes. Point Lunote at the same folder. No migration step.

**Does it replace Obsidian or Notion entirely?**  
Not always. Lunote focuses on connected knowledge, workspace-aware AI, and local-first desktop workflows. Pair it with mobile or specialized plugins if you need them.

**Full vault graph like Obsidian Graph view?**  
Partially. Lunote defaults to a **local subgraph** around the open note. You can switch to a **workspace graph** in the knowledge rail or open it fullscreen — all linked notes in the workspace, up to performance caps (default **extended** tier: 400 nodes / 700 edges; **standard**: 250 / 400; **compact**: 120 / 200). It is not an unlimited whole-vault graph like Obsidian’s Graph view.

**How does AI use my notes?**  
AI context includes the current note, selection, `@`-mentioned notes, linked neighbors, and workspace search snippets — only what you send in a conversation. Configure your provider in **Preferences → AI**.

**Can I encrypt my workspace?**  
Yes. In **Preferences → Security**, you can optionally enable **workspace encryption**. Markdown notes are stored encrypted on disk; enter your password when opening the workspace. Image attachments stay plaintext unless you enable **Encrypt images**. Idle **auto-lock** can lock an unlocked session after inactivity. Passwords stay in memory only and are never saved — if you lose the password, encrypted notes cannot be recovered.

**Are there plugins?**  
Only for themes — optional packs in **Preferences → Plugins** from [lunote-theme](https://github.com/lunote-code/lunote-theme). Wiki links, knowledge graph, AI, and export work without installing anything.

**Feedback?**  
[Open an issue](https://github.com/lunote-code/lunote/issues) or [start a discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## License

Open-source software. See the repository license file for terms.

---
