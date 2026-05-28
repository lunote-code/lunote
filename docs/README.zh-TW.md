<div align="center">

# Lunote

**一款本地優先的 Markdown 工作區，用于寫作、連結與构建個人知識庫**

*在精致的編輯器裡寫作，用 Wiki 連結連接想法，把每一篇筆記都儲存在本地的 `.md` 檔案中。免费、開源，专為離線工作而生。*

**Typora 式寫作體驗 + Obsidian 式雙向連結知識庫 — 内建能力，無需插件。**

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**文件：** [全部語言](README.md) · [English](README.en.md)

**使用指南（英文）：** [主題](guide/themes.md) · [快捷鍵與 `/` 命令](guide/shortcuts-and-menus.md) · [目錄](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[預覽](#preview) · [為什麼選擇 Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [下载](#download) · [快速开始](#quick-start) · [使用指南](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — 10 秒簡報：寫作、雙向連結、知識圖譜與主题" width="720" />
  </a>
</p>
<p align="center"><sub>10 秒速覽 · 本地 Markdown · 雙向連結 · 图譜 · 主题 · 無需插件</sub></p>

</div>

---

## Lunote 是什麼？

Lunote 是一款桌面 Markdown 工作區，适合想同时獲得这 3 點的人：

- **本地纯 Markdown 檔案**
- **强大的寫作體驗**
- **内建的知識連結工作流**

你可以把任意資料夾直接作為工作區開啟，繼續使用自己掌控的普通 `.md` 檔案。需要流暢寫作时用可視化模式，需要精确控制时切換到 Markdown 原始碼模式，並直接使用 wiki 連結、反向連結、图譜和搜尋，無需依賴插件。

| | |
|---|---|
| **平臺** | macOS、Windows、Linux |
| **介面語言** | English, 繁體中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **匯出** | PDF、Word (DOCX)、HTML、PNG |
| **技術棧** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## 預覽


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Lunote 主工作區" width="720" />
</p>

| 視覺化編輯器 | 知識圖譜 | 主题 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="視覺化編輯器" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="知識圖譜" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="主题預設" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## 為什麼選擇 Lunote

- **本地優先**：你的筆記始終是你自己資料夾裡的普通 Markdown 檔案。
- **編輯器優先**：視覺化編輯與原始 Markdown 原始碼都是一等能力。
- **知識工作流就绪**：wiki 連結、反向連結、图譜、大纲和搜尋都内建。
- **实用**：需要時匯出，用你自己的工具同步，且可離線工作。

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| 對比項 | Typora | Obsidian | Lunote |
|---|---|---|---|
| **最适合谁** | 追求干淨单文件寫作的人 | 追求外掛生態和庫级定制的 PKM 使用者 | 想把寫作和知識連結放在同一應用程式裡的人 |
| **编辑體驗** | 极简 Markdown 編輯器 | 可扩展的 Markdown 平臺 | 視覺化編輯 + Markdown 原始碼 |
| **知識庫能力** | 有限 | 强，但常依賴插件 | 内建 wiki 連結、反向連結、图譜、搜尋 |
| **上手復杂度** | 低 | 中到高 | 低到中 |
| **插件依賴** | 低 | 高 | 低 |
| **适合你如果...** | 你主要想要寫作工具 | 你主要想要生态和扩展性 | 你想平衡寫作體驗與知識工作流 |

---

<a id="download"></a>

## 下载

**[最新發布 →](https://github.com/lunote-code/lunote/releases)**

当前 GitHub release workflow 產出的安裝套件：

| 平臺 | 包类型 | 工作流参考 |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ 可選 `.deb.asc`) | `ubuntu-22.04` |

macOS 首次啟動：

1. 将 **Lunote** 移動到 **Applications**
2. **右鍵 → 開啟 → 開啟**
3. 如有需要，执行 `xattr -cr /Applications/Lunote.app`

---

<a id="quick-start"></a>

## 快速开始

1. 安裝适合你平臺的 Lunote。
2. 開啟一個包含 Markdown 筆記的資料夾，或新增工作區。
3. 开始寫作，用 `[[` 連結筆記，用 `Ctrl+Shift+F` / `Cmd+Shift+F` 搜尋，並在需要時匯出。

如果你已经有 Obsidian、Logseq 或 Typora 的 Markdown 筆記庫，直接開啟檔案夹即可，無需匯入。

---

<a id="user-guide"></a>

## 使用指南（英文）

英文分步說明（主題、快捷鍵與完整 **`/`** 斜杠命令列表）：

- [主題](guide/themes.md) — 內建外觀、Theme 資料夾、Obsidian CSS、程式碼片段與匯出樣式
- [快捷鍵與快捷選單](guide/shortcuts-and-menus.md) — 命令面板、鍵盤快捷鍵與完整 **`/`** 斜杠命令列表
- [指南目錄](guide/README.md) — 全部指南頁面

---

<a id="faq"></a>

## FAQ

**需要帳號或連網吗？**  
不需要。Lunote 支持離線工作，除非你自己同步，否則筆記始终儲存在本地。

**可以使用已有的 Markdown 庫吗？**  
可以。直接開啟任意包含 `.md` / `.markdown` 檔案的資料夾。

**和其他工具相容吗？**  
相容。Lunote 使用標準 Markdown，所以同一個資料夾仍可與 Obsidian、VS Code、Typora 或 Git 一起使用。

**它能完全替代 Obsidian 或 Notion 吗？**  
Lunote 更专注于本地 Markdown、強編輯體驗和内建連結能力。如果你需要行動端或大型外掛生態，仍可與其他工具搭配使用。

**如何反饋 Bug 或提出功能建议？**  
你可以[提交 issue](https://github.com/lunote-code/lunote/issues)或發起[discussion](https://github.com/lunote-code/lunote/discussions)。

---

<a id="license"></a>

## 许可协议

这是一個開源項目。具體条款請查看倉庫中的许可證檔案。

---

<a id="sponsor"></a>

## 支援專案

如果 Lunote 对你有帮助：

- **[给倉庫點 Star](https://github.com/lunote-code/lunote)** — 帮助更多人發現这個項目
- **[参與討論](https://github.com/lunote-code/lunote/discussions)** — 使用场景與反饋和代码一样重要

如果 Lunote 对你有帮助，歡迎透過 Tron 網路上的 **TRC20 USDT** 自愿赞助开發。

| | |
|---|---|
| **網路** | Tron（TRC20）· USDT |
| **地址** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>轉帳前務必核對地址。鏈上轉帳不可撤銷。贊助為自願行為，不構成服務購買。</sub>

---