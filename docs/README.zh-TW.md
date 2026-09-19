<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>用 AI 构建彼此連接的知識體系。</strong><br />
  <em>Lunote 将 Markdown 筆記、雙向連結、知識圖譜可視化與 AI 知識發現结合在一起，帮助你更高效地思考、学習與創作。</em><br />
  <em>把零散的筆記变成可生長的知識系统——本地優先、可選 AES-256 工作區加密、数据完全由你掌控。</em>
</p>

<p align="center">
  支持 <strong>macOS</strong>、<strong>Windows</strong>、<strong>Linux</strong>。
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
  <a href="#key-features"><img src="https://img.shields.io/badge/workspace%20encryption-AES--256--GCM-green" alt="AES-256 workspace encryption" /></a>
</p>

<h3 align="center">
  <a href="#preview">截圖</a> &nbsp;|&nbsp;
  <a href="#why-lunote">為什麼選 Lunote</a> &nbsp;|&nbsp;
  <a href="#key-features">核心功能</a> &nbsp;|&nbsp;
  <a href="#getting-started">快速開始</a> &nbsp;|&nbsp;
  <a href="#download">下載</a> &nbsp;|&nbsp;
  <a href="#contributing">參與貢獻</a>
</h3>

<p align="center">
  <strong>文件：</strong> <a href="README.md">全部語言</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>其他語言：</strong>
  <a href="../README.md">🇬🇧</a>
  <a href="README.zh-CN.md">🇨🇳</a>
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
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下載-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下載-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下載-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">截圖</a> · <a href="#why-lunote">為什麼</a> · <a href="#key-features">功能</a> · <a href="#compare">對比</a> · <a href="#download">下載</a> · <a href="#getting-started">快速開始</a> · <a href="#faq">常見問題</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <img src="assets/demo/lunote-demo.gif" alt="Lunote — 示範：互联知識、雙向連結、AI、知識圖譜可視化" width="720" />
</p>
<p align="center"><sub>互联知識 · `[[雙向連結]]` · AI 發現 · 圖譜可視化 · 本地優先 · 可選加密</sub></p>

---

Lunote 是一款 **AI 原生的知識管理工作區**——面向個人知識庫，讓想法彼此連接、持續生長，並讓 AI 真正理解你的知識體系。開啟任意 `.md` 資料夾，开始构建系统，而不只是堆积筆記。

| | |
|---|---|
| **平臺** | macOS、Windows、Linux |
| **介面語言** | English、繁體中文、繁體中文、日本語、한국어、Deutsch、Français、Español、Русский、Português (Brasil)、Italiano |
| **匯出** | PDF、Word (DOCX)、HTML、PNG · 列印 |
| **安全** | 可選工作區加密（AES-256-GCM）· 密碼不儲存到磁碟 |

發布說明見 [CHANGELOG.md](../CHANGELOG.md)。**v1.0.4** 補丁：開啟工作區不再卡在載入遮罩；視覺編輯器維持 TipTap 3.23.1（3.30/3.31 會導致編輯失效）。

---

<a id="why-lunote"></a>

## 為什麼選 Lunote

大多数筆記應用程式帮你 **记錄** 資訊，却很少帮你 **构建知識**。

- **普通筆記容易变成資訊孤岛** — 想法堆在資料夾裡，彼此的关系却看不見。你记得寫過什麼，却不记得它和什麼有关。
- **連接讓知識產生復利** — 雙向連結、反向連結與相关筆記，把孤立頁面变成可导航、可回顾、可扩展的網路。
- **AI 應該理解整個知識庫** — 而不只是当前開啟的文件。当 AI 讀取工作區上下文、連結筆記與搜尋结果时，才能综合归纳、建议連結、發現缺口、催生新見解。
- **筆記可在磁碟上加密儲存** — 可選 AES-256-GCM 工作區加密保護 Markdown 正文；圖片附件預設明文，可開啟 **加密圖片**；每次開啟工作區輸入密碼解鎖；空閒可自動鎖定；密碼從不寫入磁碟。

Lunote 為此而生：**本地優先的個人知識庫**，支持**可選工作區加密**，讓互联思考與 AI 理解协同工作——無需上云、無需帳號、無需外掛堆砌。
---

<a id="key-features"></a>

## 核心功能

<!-- readme-body-start -->

### AI 驅動的知識庫

AI 理解並协同你的筆記工作——不是旁挂的聊天視窗。

- **工作區感知对话** — 结合当前筆記、選中內容、`@` 引用的筆記、連結邻居與工作區搜尋進行对话
- **AI 搜尋** — 提问时从整個筆記庫检索相关片段
- **摘要與综合** — 将筆記、選区或主題凝练為清晰要點
- **寫作辅助** — 續寫、改寫、翻译與结构化输出，原生支持 Lunote Markdown
- **知識综合** — 跨筆記分析、工作區概覽與主題级洞察

在 **偏好設定 → AI** 中配置你自己的 API 密钥（OpenAI、Anthropic、Google、DeepSeek、OpenRouter、Ollama 等）。

### 互联知識

在想法之間建立关系——可生長知識系统的基础。

- **雙向連結** — 寫作时自然輸入 `[[連結筆記]]`；重新命名筆記后，庫內連結自動更新
- **反向連結** — 查看有哪些筆記指向当前頁面
- **相关筆記** — 沿线索跳轉，不丢失上下文
- **雙向關聯** — 連接自動雙向生效

### 知識發現

在工作區中發現相关想法、模式與隱藏關聯。

- **連結建议** — AI 根据已有筆記建议 `[[雙向連結]]`
- **关系發現** — 呈現主題如何聚类與關聯
- **主題探索** — 梳理已知、缺失與下一步該寫什麼
- **缺失連接偵測** — 發現缺口、孤立筆記與連結不足之处

### 知識圖譜可視化

圖譜是 **知識網路的視圖**——展示你此刻正在思考的內容如何與周围想法相連。

- 以当前筆記為中心的 **局部子圖** — 可調节深度與筛選
- **沿連接导航** — 从圖譜跳轉到連結筆記
- **看見知識演化** — 隨着連結增多，观察主題簇如何形成

> 預設是当前筆記周围的 **局部子圖**。可切換 **全局** 或全屏查看工作區連結圖譜。效能上限：**扩展**（預設）400 节點 / 700 邊，**標準** 250 / 400，**紧凑** 120 / 200——不是 Obsidian 那種无限全庫圖譜。

### Markdown 原生

开放、可攜、面向未来的筆記格式。

- **Markdown 優先** — 可視化與原始碼模式；專注模式助你沉浸寫作
- **开放格式** — 磁碟上的纯 `.md` 檔案，无专有数据庫
- **可攜筆記** — 同一資料夾可在 Obsidian、Typora 或任意 Markdown 工具中開啟
- **豐富內容** — 程式碼區塊、表格、公式、Mermaid、标注框；可匯出 PDF、Word、HTML、PNG

### 工作區加密

保護磁碟上的敏感筆記——內建能力，無需外掛。

- **AES-256-GCM** — Markdown 筆記正文加密存儲
- **每次會話輸入密碼** — 開啟工作區时解鎖；密碼不會寫入磁碟
- **按工作區可選開啟** — 在 **偏好設定 → 安全** 中啟用
- **圖片可選加密** — 附件預設明文；開啟 **加密圖片** 后，常見圖片（PNG、JPEG、WebP、GIF、HEIC、SVG 等）也會加密
- **空閒自動鎖定** — 一段时間无键鼠操作后（預設 5 分鐘）先儲存再鎖定已解鎖的加密工作區；仍有未儲存髒資料时會跳過鎖定

### 本地優先

知識始终在你掌控之中。

- **数据归你所有** — 筆記以工作區資料夾形式儲存在本机
- **以工作區為中心** — 開啟任意筆記庫；用 Git、Syncthing 或 iCloud 按你的方式同步
- **隱私友好** — 離線優先、無需帳號；AI 僅在你配置后按需調用
- **需要時可加密** — 見上文 **工作區加密**；密碼從不儲存到磁碟
- **輕量內建** — 核心知識能力开箱即用；[主題包](https://github.com/lunote-code/lunote-theme) 可選

### 效率工具

- 多分頁、大綱、命令面板（`Cmd+Shift+P`）、单篇快照與版本歷史
- 全域搜尋（`Cmd+Shift+F` / `Ctrl+Shift+F`）、`/` 斜線選單（AI 續寫 / 摘要 / 润色、手绘畫布、思維导圖）
- 每日筆記、可選新增筆記模板、系统托盤快速记錄
- 明暗主題；**偏好設定 → 外掛** 可安裝可選主題包

<!-- readme-body-end -->

---

<a id="preview"></a>

## 截圖

<p align="center">
  <img src="assets/screenshots/ai+code-view.png" alt="AI + 程式碼檢視 — 工作區感知寫作" width="720" />
</p>
<p align="center"><sub>AI + 程式碼檢視 — 工作區感知寫作</sub></p>

<p align="center">
  <img src="assets/screenshots/graph.png" alt="知識圖譜 — 探索彼此連結的想法" width="720" />
</p>
<p align="center"><sub>知識圖譜 — 探索彼此連結的想法</sub></p>

### 更多功能

| AI 助手 | 程式碼編輯 | 原始碼檢視 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/AI.png" alt="AI 助手" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/code-view.png" alt="程式碼編輯" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="原始碼檢視" width="240" style="max-width: 100%; height: auto;" /> |

| Mermaid 圖表 | 全域搜尋 | 主題設定 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/mermaid.png" alt="Mermaid 圖表" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="全域搜尋" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="主題設定" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="getting-started"></a>

## 快速開始

1. 在 **[下載](#download)** 区安裝 macOS / Windows / Linux 版本。
2. **開啟工作區** — Obsidian 筆記庫、Notion 匯出資料夾、Typora 目錄或任意 `.md` 資料夾，無需匯入。
3. **建立連接** — 輸入 `[[` 連結筆記；查看反向連結與当前筆記周围的知識圖譜。
4. **啟用 AI** — 在 **偏好設定 → AI** 添加 API 密钥，即可就单篇筆記或整個工作區提问。
5. **發現與生長** — 用 AI 連結建议、工作區概覽與搜尋，發現模式與知識缺口。
6. **可選：加密工作區** — 在 **偏好設定 → 安全** 中啟用工作區加密，保護磁碟上的 Markdown 筆記；開啟工作區时需輸入密碼。需要時開啟 **加密圖片**，並設定空閒自動鎖定。

> **從別的工具遷過來？** 檔案仍在原处，任何 Markdown 工具都能讀寫同一資料夾。

---

<a id="download"></a>

## 下載

**[下載最新版本 →](https://github.com/lunote-code/lunote/releases)**

無需注册 · 本地 `.md` 檔案 · 可離線使用 · **可選工作區加密**

<details>
<summary><strong>macOS 首次開啟（Gatekeeper）</strong></summary>

1. 将 **Lunote** 拖入 **應用程式**
2. **右鍵 → 開啟 → 開啟**
3. 若仍被拦截，在终端執行：`xattr -cr /Applications/Lunote.app`

</details>

| 平臺 | 安裝套件 |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb`（可選 `.deb.asc`） |

---

<a id="compare"></a>

## Lunote vs Notion vs Obsidian

| | Notion | Obsidian | Lunote |
|---|---|---|---|
| **数据归属** | 雲端帳號 | 本地 `.md` | 本地 `.md` |
| **知識模型** | 工作區頁面 | 筆記庫 + 外掛 | 互联工作區，內建 |
| **AI** | 雲端 AI，数据在对方 | 依賴外掛 | 工作區感知 AI（你的 API 密钥） |
| **雙向連結與圖譜** | 較弱 | 全庫圖譜（常靠外掛） | **局部子圖** + 知識發現，內建 |
| **上手成本** | 註冊帳號 | 常需折騰外掛 | 開啟檔案夹 → 連接想法 |
| **工作區加密** | 无 | 外掛 / 系统级 | **內建**（AES-256-GCM，可選） |
| **離線與隱私** | 受限 | 完全離線 | 完全離線，無需帳號 |

---

<a id="use-cases"></a>

## 適用場景

- **個人知識庫** — 用雙向連結、反向連結與 AI 综合，搭建第二大腦
- **研究與学習** — 跨主題連接閱讀、摘要與見解
- **开發文件** — ADR、運維手册、程式碼片段；支持程式碼區塊與 PDF 匯出
- **从 Notion / Obsidian 遷出** — 同一批 Markdown 資料夾，更少折騰、不上傳
- **敏感筆記與日记** — 可選工作區加密，保護磁碟上的 Markdown 正文；圖片附件需另行開啟 **加密圖片**
- **团队异步文件** — 用 Git 共享工作區；人人保留纯 `.md` 檔案

---

<a id="roadmap"></a>

## 路线圖

Lunote 正持續演進為更深度的 **AI 原生知識管理** 體驗。方向包括：

- 更豐富的 **知識發現** — 更智能的連結建议、主題地圖與缺口偵測
- 更深的 **AI 工作區理解** — 更好的上下文、综合與跨筆記推理
- 扩展的 **圖譜可視化** — 更多探索知識連結的方式
- 持續的 **本地優先** 打磨 — 性能、匯出與跨平臺稳定性

進展與想法請关注 [GitHub 討論区](https://github.com/lunote-code/lunote/discussions) 與 [Issues](https://github.com/lunote-code/lunote/issues)。

---

<a id="star"></a>

## 在 GitHub 上 Star Lunote

如果 Lunote 帮你构建了互联知識，歡迎 **[给倉庫點 Star](https://github.com/lunote-code/lunote)**——帮助更多人發現这款 AI 驅動的個人知識庫。遷移故事與想法見 [討論区](https://github.com/lunote-code/lunote/discussions)。

---

<a id="user-guide"></a>

## 使用指南（英文）

英文分步說明（主題、快捷鍵、加密、圖譜與完整 **`/`** 斜線命令清單）：

- [主題](guide/themes.md) — 內建外觀、Theme 資料夾、external CSS、程式碼片段、匯出樣式與**偏好設定 → 外掛**目錄
- [快捷鍵與快捷選單](guide/shortcuts-and-menus.md) — 命令面板、鍵盤快捷鍵與完整 **`/`** 斜線命令清單
- [工作區加密](guide/workspace-encryption.md) — AES-256-GCM、可選圖片加密、空閒自動鎖定
- [知識圖譜](guide/knowledge-graph.md) — 局部子圖、全局 / 全屏、效能上限
- [平臺差异](guide/platform-differences.md) — 各系统 PDF、列印、在檔案管理器中显示與排错
- [指南目錄](guide/README.md) — 全部指南頁面

---

<a id="development"></a>

## 开發

自行构建 Lunote：

- **環境：** Node.js、Rust 與 [Tauri](https://tauri.app/) 平臺依賴
- **开發：** `npm install` 后執行 `npm run tauri:dev`
- **打包：** `npm run tauri:bundle`（或 `tauri:bundle:dmg` / `msi` / `deb`）
- **文件：** [文件索引](README.md) · [打包說明](packaging-strategy.md) · [脚本說明](../scripts/README.md)

问題反饋：[提 Issue](https://github.com/lunote-code/lunote/issues)，歡迎 PR。

---

<a id="contributing"></a>

## 参與贡献

提交 PR 前建议：

- 閱讀 [脚本與維護](../scripts/README.md) 了解多語言與發布流程
- 修改編輯器或匯出相关代码时運行 `npm run lint` 與相关测試
- 調整產品文案时同步 [多語言 README](README.md)

想法與遷移经驗：[討論区](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## 常見問題

**需要帳號或連網吗？**  
不需要。Lunote 以離線為先；筆記在本地，除非你自行同步資料夾。AI 功能需配置 API 密钥，使用时需要網路。

**Lunote 是 AI 筆記應用程式還是 Markdown 編輯器？**  
Lunote 是 **個人知識庫**——Markdown 是筆記的存儲方式，AI 讓工作區变得可理解與可發現。編輯器服務于知識體系，而非反過来。

**能開啟 Obsidian 筆記庫吗？**  
可以。指向同一資料夾即可，無需遷移。

**能完全替代 Obsidian 或 Notion 吗？**  
不一定。Lunote 側重互联知識、工作區感知 AI 與本地優先的桌面工作流；若強依賴行動端或大型外掛生態，可與其他工具搭配。

**和 Obsidian 的全庫圖譜一样吗？**  
尚不完全一样。Lunote 預設展示以当前開啟筆記為中心的 **局部子圖**。可在知識栏切換 **全局** 或全屏查看工作區連結圖譜，並受效能上限约束（預設 **扩展**：400 节點 / 700 邊；**標準**：250 / 400；**紧凑**：120 / 200）。不是 Obsidian Graph 那種无限全庫圖譜。

**AI 如何使用我的筆記？**  
AI 上下文包括当前筆記、選中內容、`@` 引用的筆記、連結邻居與工作區搜尋片段——僅限你在对话中傳送的內容。在 **偏好設定 → AI** 配置你的服務商。

**可以加密工作區吗？**  
可以。在 **偏好設定 → 安全** 中可**可選**啟用**工作區加密**。Markdown 筆記會以加密形式儲存在磁碟上；開啟工作區时需輸入密碼。圖片附件預設明文，可開啟 **加密圖片**。空閒 **自動鎖定** 可在一段时間無操作后鎖定已解鎖會話。密碼僅保留在記憶體中，從不寫入磁碟——遺失密碼將無法恢復已加密筆記。

**有外掛吗？**  
主題类外掛可選——在 **偏好設定 → 外掛** 浏覽 [lunote-theme](https://github.com/lunote-code/lunote-theme)。雙向連結、知識圖譜、AI 與匯出無需安裝外掛。

**如何反饋？**  
歡迎 [提 Issue](https://github.com/lunote-code/lunote/issues) 或参與 [討論](https://github.com/lunote-code/lunote/discussions)。

---

<a id="license"></a>

## 許可證

開源軟體。条款見倉庫中的許可證檔案。

---
