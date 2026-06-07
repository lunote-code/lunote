<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>開啟你的 Markdown 資料夾就能用——寫作、雙向連結、圖譜，無需外掛。</strong><br />
  <em>免費開源、可離線。每一篇筆記都是磁碟上的 <code>.md</code> 檔案。</em><br />
  <em>筆記只存在你的電腦上。無需帳號、不上傳——需要時用 Git、Syncthing、iCloud 等自行同步資料夾。</em>
</p>

<p align="center">
  支持 <strong>macOS</strong>、<strong>Windows</strong>、<strong>Linux</strong>。
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
</p>

<h3 align="center">
  <a href="#preview">截圖</a> &nbsp;|&nbsp;
  <a href="#overview">是什麼</a> &nbsp;|&nbsp;
  <a href="#capabilities">功能</a> &nbsp;|&nbsp;
  <a href="#download">下載</a> &nbsp;|&nbsp;
  <a href="#development">开發</a> &nbsp;|&nbsp;
  <a href="#contribution">参與贡献</a>
</h3>

<p align="center">
  <strong>文件：</strong> <a href="README.md">全部語言</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>其他語言：</strong>
  <a href="../README.md">🇬🇧</a>
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
  <strong>使用指南（英文）：</strong> <a href="guide/themes.md">主題</a> · <a href="guide/shortcuts-and-menus.md">快捷鍵與斜線（/）命令</a> · <a href="guide/README.md">目錄</a>
</p>

<p align="center">
  <strong>Typora 式寫作 + Obsidian 式雙向連結 — 內建，不用裝外掛。</strong>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下載-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="下載-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下載-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="下載-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下載-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="下載-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">截圖</a> · <a href="#overview">是什麼</a> · <a href="#capabilities">功能</a> · <a href="#download">下載</a> · <a href="#quick-start">快速開始</a> · <a href="#user-guide">使用指南</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — 示範：寫作、雙向連結、知識圖譜、主題" width="720" />
  </a>
</p>
<p align="center"><sub>寫作 · `[[雙向連結]]` · 反向連結 · 圖譜 · 匯出 · 主題</sub></p>

---

<a id="preview"></a>

## 截圖

<p align="center">
  <img src="assets/screenshots/language/cn-tw.png" alt="Lunote — 首次開啟" width="720" />
</p>

| 程式碼編輯 | 原始碼檢視 | 知識圖譜 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/code-view.png" alt="程式碼編輯" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="原始碼檢視" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/graph.png" alt="知識圖譜" width="240" style="max-width: 100%; height: auto;" /> |

| 全域搜尋 | 歷史快照 | 主題設定 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/search.png" alt="全域搜尋" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/snipaste.png" alt="歷史快照" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="主題設定" width="240" style="max-width: 100%; height: auto;" /> |

### 更多主題預覽

更多外觀截圖見 `assets/screenshots/theme/`。可直接複製的 CSS、JSON 權杖與片段： **[主題範例](theme-example/README.md)**.

| GitHub 淺色 | GitHub 深色 | IDEA 淺色 | IDEA 深色 | Dim 淺色 |
| :---: | :---: | :---: | :---: | :---: |
| <img src="assets/screenshots/theme/github-light.png" alt="GitHub 淺色" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/github-dark.png" alt="GitHub 深色" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/idea-light.png" alt="IDEA 淺色" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/idea-dark.png" alt="IDEA 深色" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/dim-light.png" alt="Dim 淺色" width="200" style="max-width: 100%; height: auto;" /> |

| Dim 深色 | 森林晨曦 | 餘燼微光 | 石墨黑 | 薰衣草霧 |
| :---: | :---: | :---: | :---: | :---: |
| <img src="assets/screenshots/theme/dim-dark.png" alt="Dim 深色" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/forest-dawn.png" alt="森林晨曦" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/ember-glow.png" alt="餘燼微光" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/graphite-noir.png" alt="石墨黑" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/lavender-haze.png" alt="薰衣草霧" width="200" style="max-width: 100%; height: auto;" /> |

---

<!-- readme-body-start -->
<a id="overview"></a>

## 这是什麼

開啟 **`.md` 資料夾**就能寫。內建 `[[雙向連結]]`、反向連結與知識圖譜——**無需帳號，無需外掛市集**。

- 把任意 **`.md` 資料夾**当作工作區開啟
- **可視化與原始碼**一键切換（`Cmd+/` / `Ctrl+/`）
- 內建 **雙向連結**、反向連結、知識圖譜、大綱與全文搜尋

| | |
|---|---|
| **平臺** | macOS、Windows、Linux |
| **介面語言** | English、繁體中文、繁體中文、日本語、한국어、Deutsch、Français、Español、Русский、Português (Brasil)、Italiano |
| **匯出** | PDF、Word (DOCX)、HTML、PNG · 列印 |

---

<a id="capabilities"></a>

## 功能

按你的场景選用——以下能力均开箱即用：

### 寫作

*長文、文件、日记：可視化與原始碼隨时切換。*

- 視覺化編輯與 **Markdown 原始碼**；`Cmd+/` / `Ctrl+/` 切換
- **`/` 斜線選單**：標題、清單、表格、代码、Mermaid、标注框、雙向連結
- 表格、公式、圖片、Mermaid、**專注模式**、命令面板（`Cmd+Shift+P`）
- **程式碼區塊**：行号、語法高亮、語言選擇、折叠與一键複製
- **格式工具栏**（标注框、顏色等）；可在 **檔案 → 偏好設定 → 排版** 中關閉
- 在 **偏好設定 → 排版** 中調整**閱讀栏宽**、字體與字級

### 雙向連結

*搭建第二大腦：`[[雙向連結]]`、反向連結、圖譜，無需外掛。*

- `[[雙向連結]]` 自動補全，可安全開啟尚未創建的筆記
- **知識側欄**：反向連結、本地圖譜、嵌入、分頁與 **YAML Frontmatter** 编辑
- 重新命名或移動筆記时，自動更新資料夾內的 `[[連結]]`

### 整理

*筆記變多後：多分頁、日記、大綱、全文搜尋。*

- 側欄檔案樹、多分頁、**全域搜尋**（`Cmd+Shift+F`）
- 单篇**大綱**，並監测外部檔案变更
- 儲存與冲突处理，在檔案管理器中显示
- **日記**：今日 / 昨日 / 明日，依模板自動建立（`Cmd+Shift+D` / `Ctrl+Shift+D`）
- **筆記模板**：支援 `{{date:…}}`、`{{title}}` 等變數，在 **檔案 → 模板** 中編輯
- **快速擷取**：系統匣 + 全域快捷鍵，背景也能開啟今日日記

### 匯出與外观

*分享或列印 PDF/Word/HTML，主題可自訂。*

- 匯出 **PDF、HTML、DOCX、PNG**，支持系统**列印**
- 明暗主題、**Theme 資料夾**、外部 CSS
- 視覺模式與預覽支持**閱讀栏宽**預設（窄 / 標準 / 宽）

### 历史

*大膽改稿：快照可先預覽，再决定是否寫回磁碟。*

- 单篇筆記**快照**；恢復到編輯器，確認儲存前不會覆盖磁碟

<!-- readme-body-end -->

---

<a id="download"></a>

## 下載

**[下載最新版本 →](https://github.com/lunote-code/lunote/releases)**

無需注册 · 本地 `.md` 檔案 · 可離線使用

<details>
<summary><strong>macOS 首次開啟（Gatekeeper）</strong></summary>

1. 将 **Lunote** 拖入 **應用程式**
2. **右鍵 → 開啟 → 開啟**
3. 若仍被拦截，在终端执行：`xattr -cr /Applications/Lunote.app`

</details>

| Platform | Package |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) |

---

<a id="quick-start"></a>

## 快速開始

1. 在[下載](#download)区安裝對應平臺的 Lunote。
2. **直接開啟既有筆記庫**——Obsidian、Logseq、Typora 或任意 `.md` 資料夾，無需匯入。
3. 开始寫作，输入 `[[` 建立雙向連結，用 `Cmd+Shift+F` / `Ctrl+Shift+F` 搜尋，需要時匯出 PDF 或 Word。

> **從別的工具遷過來？** 檔案仍在原处，隨时可用 Obsidian 等繼續編輯同一份 Markdown。

---

<a id="why-lunote"></a>

## 為什麼用 Lunote

- **檔案在你手裡**：筆記就是你自己資料夾裡的 `.md`。
- **一個應用程式搞定**：寫作體驗順手，雙向連結和圖譜也內建，不用折騰外掛。

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## 和其他工具比

正在用 Typora 或 Obsidian？Lunote 適合想要**順手寫作 + 內建雙向連結圖譜**、又不想折騰外掛的人。

| | Typora | Obsidian | Lunote |
|---|---|---|---|
| **寫作體驗** | 很好 | 不錯 | 很好，內建 |
| **雙向連結與圖譜** | 較弱 | 強（常靠外掛） | 強，內建 |
| **上手要不要外掛** | 很少 | 經常要 | 不需要 |


---


<a id="user-guide"></a>

## 使用指南（英文）

英文分步說明（主題、快捷鍵與完整 **`/`** 斜線命令清單）：

- [主題](guide/themes.md) — 內建外觀、Theme 資料夾、external CSS、程式碼片段與匯出樣式
- [快捷鍵與快捷選單](guide/shortcuts-and-menus.md) — 命令面板、鍵盤快捷鍵與完整 **`/`** 斜線命令清單
- [模板](Templates/README.md) — 預設筆記與日記模板、變數說明
- [平臺差异](guide/platform-differences.md) — 各系统 PDF、列印、在檔案管理器中显示與排错
- [指南目錄](guide/README.md) — 全部指南頁面

---


<a id="development"></a>

## 开發

自行构建 Lunote：

- **環境：** Node.js、Rust 與 [Tauri](https://tauri.app/) 平臺依賴
- **开發：** `npm install` 后执行 `npm run tauri:dev`
- **打包：** `npm run tauri:bundle`（或 `tauri:bundle:dmg` / `msi` / `deb`）
- **文件：** [文件索引](README.md) · [打包說明](packaging-strategy.md) · [脚本說明](../scripts/README.md)

问題反饋：[提 Issue](https://github.com/lunote-code/lunote/issues)，歡迎 PR。

---

<a id="contribution"></a>

## 参與贡献

提交 PR 前建议：

- 閱讀 [脚本與維護](../scripts/README.md) 了解多語言與發布流程
- 修改編輯器或匯出相关代码时運行 `npm run lint` 與相关测試
- 調整產品文案时同步 [多語言 README](README.md)

想法與遷移经驗：[討論区](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

---

<a id="faq"></a>

## 常見問題

**需要帳號或連網吗？**  
不需要。可離線使用；筆記在本地，除非你自行同步資料夾（Git、Syncthing、iCloud 盤等）。

**能開啟 Obsidian / Typora 的資料夾吗？**  
可以。把資料夾作為工作區開啟即可，仍是同一批 `.md` 檔案。

**能和 Obsidian 一起用吗？**  
可以。指向同一資料夾即可，Lunote 不會锁死你的数据。

**能完全替代 Obsidian 或 Notion 吗？**  
不一定。Lunote 側重桌面寫作與內建雙向連結；若強依賴行動端或大型外掛生態，可與其他工具搭配。

**如何反饋问題或想法？**  
歡迎 [提 Issue](https://github.com/lunote-code/lunote/issues) 或参與 [討論](https://github.com/lunote-code/lunote/discussions)——遷移经驗也能帮助更多人發現 Lunote。

---

<a id="license"></a>

## 許可證

開源軟體。条款見倉庫中的許可證檔案。

<a id="sponsor"></a>

## 支援專案

如果 Lunote 對你有幫助，歡迎透過 Tron 網路上的 **TRC20 USDT** 自願贊助開發。

| | |
|---|---|
| **網路** | Tron（TRC20）· USDT |
| **地址** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |

<sub>轉帳前務必核對地址。鏈上轉帳不可撤銷。贊助為自願行為，不構成服務購買。</sub>

---