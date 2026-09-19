<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>用 AI 构建彼此连接的知识体系。</strong><br />
  <em>Lunote 将 Markdown 笔记、双向链接、知识图谱可视化与 AI 知识发现结合在一起，帮助你更高效地思考、学习与创作。</em><br />
  <em>把零散的笔记变成可生长的知识系统——本地优先、可选 AES-256 工作区加密、数据完全由你掌控。</em>
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
  <a href="#preview">截图</a> &nbsp;|&nbsp;
  <a href="#why-lunote">为什么选 Lunote</a> &nbsp;|&nbsp;
  <a href="#key-features">核心功能</a> &nbsp;|&nbsp;
  <a href="#getting-started">快速开始</a> &nbsp;|&nbsp;
  <a href="#download">下载</a> &nbsp;|&nbsp;
  <a href="#contributing">参与贡献</a>
</h3>

<p align="center">
  <strong>文档：</strong> <a href="README.md">全部语言</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>其他语言：</strong>
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
  <strong>使用指南（英文）：</strong> <a href="guide/themes.md">主题</a> · <a href="guide/shortcuts-and-menus.md">快捷键与斜杠（/）命令</a> · <a href="guide/README.md">目录</a>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下载-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下载-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/下载-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">截图</a> · <a href="#why-lunote">为什么</a> · <a href="#key-features">功能</a> · <a href="#compare">对比</a> · <a href="#download">下载</a> · <a href="#getting-started">快速开始</a> · <a href="#faq">常见问题</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <img src="assets/demo/lunote-demo.gif" alt="Lunote — 演示：互联知识、双向链接、AI、知识图谱可视化" width="720" />
</p>
<p align="center"><sub>互联知识 · `[[双向链接]]` · AI 发现 · 图谱可视化 · 本地优先 · 可选加密</sub></p>

---

Lunote 是一款 **AI 原生的知识管理工作区**——面向个人知识库，让想法彼此连接、持续生长，并让 AI 真正理解你的知识体系。打开任意 `.md` 文件夹，开始构建系统，而不只是堆积笔记。

| | |
|---|---|
| **平台** | macOS、Windows、Linux |
| **界面语言** | English、简体中文、繁體中文、日本語、한국어、Deutsch、Français、Español、Русский、Português (Brasil)、Italiano |
| **导出** | PDF、Word (DOCX)、HTML、PNG · 打印 |
| **安全** | 可选工作区加密（AES-256-GCM）· 密码不保存到磁盘 |

**v1.0.4** 补丁：打开工作区不再卡在加载遮罩；视觉编辑器保持 TipTap 3.23.1（3.30/3.31 会导致编辑失效）。

---

<a id="why-lunote"></a>

## 为什么选 Lunote

大多数笔记应用帮你 **记录** 信息，却很少帮你 **构建知识**。

- **普通笔记容易变成信息孤岛** — 想法堆在文件夹里，彼此的关系却看不见。你记得写过什么，却不记得它和什么有关。
- **连接让知识产生复利** — 双向链接、反向链接与相关笔记，把孤立页面变成可导航、可回顾、可扩展的网络。
- **AI 应该理解整个知识库** — 而不只是当前打开的文档。当 AI 读取工作区上下文、链接笔记与搜索结果时，才能综合归纳、建议链接、发现缺口、催生新见解。
- **笔记可在磁盘上加密保存** — 可选 AES-256-GCM 工作区加密保护 Markdown 正文；图片附件默认明文，可开启 **加密图片**；每次打开工作区输入密码解锁；空闲可自动锁定；密码从不写入磁盘。

Lunote 为此而生：**本地优先的个人知识库**，支持**可选工作区加密**，让互联思考与 AI 理解协同工作——无需上云、无需账号、无需插件堆砌。
---

<a id="key-features"></a>

## 核心功能

<!-- readme-body-start -->

### AI 驱动的知识库

AI 理解并协同你的笔记工作——不是旁挂的聊天窗口。

- **工作区感知对话** — 结合当前笔记、选中内容、`@` 引用的笔记、链接邻居与工作区搜索进行对话
- **AI 搜索** — 提问时从整个笔记库检索相关片段
- **摘要与综合** — 将笔记、选区或主题凝练为清晰要点
- **写作辅助** — 续写、改写、翻译与结构化输出，原生支持 Lunote Markdown
- **知识综合** — 跨笔记分析、工作区概览与主题级洞察

在 **偏好设置 → AI** 中配置你自己的 API 密钥（OpenAI、Anthropic、Google、DeepSeek、OpenRouter、Ollama 等）。

### 互联知识

在想法之间建立关系——可生长知识系统的基础。

- **双向链接** — 写作时自然输入 `[[链接笔记]]`；重命名笔记后，库内链接自动更新
- **反向链接** — 查看有哪些笔记指向当前页面
- **相关笔记** — 沿线索跳转，不丢失上下文
- **双向关联** — 连接自动双向生效

### 知识发现

在工作区中发现相关想法、模式与隐藏关联。

- **链接建议** — AI 根据已有笔记建议 `[[双向链接]]`
- **关系发现** — 呈现主题如何聚类与关联
- **主题探索** — 梳理已知、缺失与下一步该写什么
- **缺失连接检测** — 发现缺口、孤立笔记与链接不足之处

### 知识图谱可视化

图谱是 **知识网络的视图**——展示你此刻正在思考的内容如何与周围想法相连。

- 以当前笔记为中心的 **局部子图** — 可调节深度与筛选
- **沿连接导航** — 从图谱跳转到链接笔记
- **看见知识演化** — 随着链接增多，观察主题簇如何形成

> 默认是当前笔记周围的 **局部子图**。可切换 **全局** 或全屏查看工作区链接图谱。性能上限：**扩展**（默认）400 节点 / 700 边，**标准** 250 / 400，**紧凑** 120 / 200——不是 Obsidian 那种无限全库图谱。

### Markdown 原生

开放、可移植、面向未来的笔记格式。

- **Markdown 优先** — 可视化与源码模式；专注模式助你沉浸写作
- **开放格式** — 磁盘上的纯 `.md` 文件，无专有数据库
- **可移植笔记** — 同一文件夹可在 Obsidian、Typora 或任意 Markdown 工具中打开
- **丰富内容** — 代码块、表格、公式、Mermaid、标注框；可导出 PDF、Word、HTML、PNG

### 工作区加密

保护磁盘上的敏感笔记——内建能力，无需插件。

- **AES-256-GCM** — Markdown 笔记正文加密存储
- **每次会话输入密码** — 打开工作区时解锁；密码不会写入磁盘
- **按工作区可选开启** — 在 **偏好设置 → 安全** 中启用
- **图片可选加密** — 附件默认明文；开启 **加密图片** 后，常见图片（PNG、JPEG、WebP、GIF、HEIC、SVG 等）也会加密
- **空闲自动锁定** — 一段时间无键鼠操作后（默认 5 分钟）先保存再锁定已解锁的加密工作区；仍有未保存脏数据时会跳过锁定

### 本地优先

知识始终在你掌控之中。

- **数据归你所有** — 笔记以工作区文件夹形式保存在本机
- **以工作区为中心** — 打开任意笔记库；用 Git、Syncthing 或 iCloud 按你的方式同步
- **隐私友好** — 离线优先、无需账号；AI 仅在你配置后按需调用
- **需要时可加密** — 见上文 **工作区加密**；密码从不保存到磁盘
- **轻量内建** — 核心知识能力开箱即用；[主题包](https://github.com/lunote-code/lunote-theme) 可选

### 效率工具

- 多标签、大纲、命令面板（`Cmd+Shift+P`）、单篇快照与版本历史
- 全局搜索（`Cmd+Shift+F` / `Ctrl+Shift+F`）、`/` 斜杠菜单（AI 续写 / 摘要 / 润色、手绘画布、思维导图）
- 每日笔记、可选新建笔记模板、系统托盘快速记录
- 明暗主题；**偏好设置 → 插件** 可安装可选主题包

<!-- readme-body-end -->

---

<a id="preview"></a>

## 截图

<p align="center">
  <img src="assets/screenshots/ai+code-view.png" alt="AI + 代码视图 — 工作区感知写作" width="720" />
</p>
<p align="center"><sub>AI + 代码视图 — 工作区感知写作</sub></p>

<p align="center">
  <img src="assets/screenshots/graph.png" alt="知识图谱 — 探索彼此连接的想法" width="720" />
</p>
<p align="center"><sub>知识图谱 — 探索彼此连接的想法</sub></p>

### 更多功能

| AI 助手 | 代码编辑 | 源码视图 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/AI.png" alt="AI 助手" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/code-view.png" alt="代码编辑" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="源码视图" width="240" style="max-width: 100%; height: auto;" /> |

| Mermaid 图表 | 全局搜索 | 主题设置 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/mermaid.png" alt="Mermaid 图表" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="全局搜索" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="主题设置" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="getting-started"></a>

## 快速开始

1. 在 **[下载](#download)** 区安装 macOS / Windows / Linux 版本。
2. **打开工作区** — Obsidian 笔记库、Notion 导出文件夹、Typora 目录或任意 `.md` 文件夹，无需导入。
3. **建立连接** — 输入 `[[` 链接笔记；查看反向链接与当前笔记周围的知识图谱。
4. **启用 AI** — 在 **偏好设置 → AI** 添加 API 密钥，即可就单篇笔记或整个工作区提问。
5. **发现与生长** — 用 AI 链接建议、工作区概览与搜索，发现模式与知识缺口。
6. **可选：加密工作区** — 在 **偏好设置 → 安全** 中启用工作区加密，保护磁盘上的 Markdown 笔记；打开工作区时需输入密码。需要时开启 **加密图片**，并设置空闲自动锁定。

> **从别的工具迁过来？** 文件仍在原处，任何 Markdown 工具都能读写同一文件夹。

---

<a id="download"></a>

## 下载

**[下载最新版本 →](https://github.com/lunote-code/lunote/releases)**

无需注册 · 本地 `.md` 文件 · 可离线使用 · **可选工作区加密**

<details>
<summary><strong>macOS 首次打开（Gatekeeper）</strong></summary>

1. 将 **Lunote** 拖入 **应用程序**
2. **右键 → 打开 → 打开**
3. 若仍被拦截，在终端执行：`xattr -cr /Applications/Lunote.app`

</details>

| 平台 | 安装包 |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb`（可选 `.deb.asc`） |

---

<a id="compare"></a>

## Lunote vs Notion vs Obsidian

| | Notion | Obsidian | Lunote |
|---|---|---|---|
| **数据归属** | 云端账号 | 本地 `.md` | 本地 `.md` |
| **知识模型** | 工作区页面 | 笔记库 + 插件 | 互联工作区，内建 |
| **AI** | 云端 AI，数据在对方 | 依赖插件 | 工作区感知 AI（你的 API 密钥） |
| **双向链接与图谱** | 较弱 | 全库图谱（常靠插件） | **局部子图** + 知识发现，内建 |
| **上手成本** | 注册账号 | 常需折腾插件 | 打开文件夹 → 连接想法 |
| **工作区加密** | 无 | 插件 / 系统级 | **内建**（AES-256-GCM，可选） |
| **离线与隐私** | 受限 | 完全离线 | 完全离线，无需账号 |

---

<a id="use-cases"></a>

## 适用场景

- **个人知识库** — 用双向链接、反向链接与 AI 综合，搭建第二大脑
- **研究与学习** — 跨主题连接阅读、摘要与见解
- **开发文档** — ADR、运维手册、代码片段；支持代码块与 PDF 导出
- **从 Notion / Obsidian 迁出** — 同一批 Markdown 文件夹，更少折腾、不上传
- **敏感笔记与日记** — 可选工作区加密，保护磁盘上的 Markdown 正文；图片附件需另行开启 **加密图片**
- **团队异步文档** — 用 Git 共享工作区；人人保留纯 `.md` 文件

---

<a id="roadmap"></a>

## 路线图

Lunote 正持续演进为更深度的 **AI 原生知识管理** 体验。方向包括：

- 更丰富的 **知识发现** — 更智能的链接建议、主题地图与缺口检测
- 更深的 **AI 工作区理解** — 更好的上下文、综合与跨笔记推理
- 扩展的 **图谱可视化** — 更多探索知识连接的方式
- 持续的 **本地优先** 打磨 — 性能、导出与跨平台稳定性

进展与想法请关注 [GitHub 讨论区](https://github.com/lunote-code/lunote/discussions) 与 [Issues](https://github.com/lunote-code/lunote/issues)。

---

<a id="star"></a>

## 在 GitHub 上 Star Lunote

如果 Lunote 帮你构建了互联知识，欢迎 **[给仓库点 Star](https://github.com/lunote-code/lunote)**——帮助更多人发现这款 AI 驱动的个人知识库。迁移故事与想法见 [讨论区](https://github.com/lunote-code/lunote/discussions)。

---

<a id="user-guide"></a>

## 使用指南（英文）

英文分步说明（主题、快捷键、加密、图谱与完整 **`/`** 斜杠命令列表）：

- [主题](guide/themes.md) — 内置外观、Theme 文件夹、external CSS、代码片段、导出样式与**偏好设置 → 插件**目录
- [快捷键与快捷菜单](guide/shortcuts-and-menus.md) — 命令面板、键盘快捷键与完整 **`/`** 斜杠命令列表
- [工作区加密](guide/workspace-encryption.md) — AES-256-GCM、可选图片加密、空闲自动锁定
- [知识图谱](guide/knowledge-graph.md) — 局部子图、全局 / 全屏、性能上限
- [平台差异](guide/platform-differences.md) — 各系统 PDF、打印、在文件管理器中显示与排错
- [指南目录](guide/README.md) — 全部指南页面

---

<a id="development"></a>

## 开发

自行构建 Lunote：

- **环境：** Node.js、Rust 与 [Tauri](https://tauri.app/) 平台依赖
- **开发：** `npm install` 后执行 `npm run tauri:dev`
- **打包：** `npm run tauri:bundle`（或 `tauri:bundle:dmg` / `msi` / `deb`）
- **文档：** [文档索引](README.md) · [打包说明](packaging-strategy.md) · [脚本说明](../scripts/README.md)

问题反馈：[提 Issue](https://github.com/lunote-code/lunote/issues)，欢迎 PR。

---

<a id="contributing"></a>

## 参与贡献

提交 PR 前建议：

- 阅读 [脚本与维护](../scripts/README.md) 了解多语言与发布流程
- 修改编辑器或导出相关代码时运行 `npm run lint` 与相关测试
- 调整产品文案时同步 [多语言 README](README.md)

想法与迁移经验：[讨论区](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## 常见问题

**需要账号或联网吗？**  
不需要。Lunote 以离线为先；笔记在本地，除非你自行同步文件夹。AI 功能需配置 API 密钥，使用时需要网络。

**Lunote 是 AI 笔记应用还是 Markdown 编辑器？**  
Lunote 是 **个人知识库**——Markdown 是笔记的存储方式，AI 让工作区变得可理解与可发现。编辑器服务于知识体系，而非反过来。

**能打开 Obsidian 笔记库吗？**  
可以。指向同一文件夹即可，无需迁移。

**能完全替代 Obsidian 或 Notion 吗？**  
不一定。Lunote 侧重互联知识、工作区感知 AI 与本地优先的桌面工作流；若强依赖移动端或大型插件生态，可与其他工具搭配。

**和 Obsidian 的全库图谱一样吗？**  
尚不完全一样。Lunote 默认展示以当前打开笔记为中心的 **局部子图**。可在知识栏切换 **全局** 或全屏查看工作区链接图谱，并受性能上限约束（默认 **扩展**：400 节点 / 700 边；**标准**：250 / 400；**紧凑**：120 / 200）。不是 Obsidian Graph 那种无限全库图谱。

**AI 如何使用我的笔记？**  
AI 上下文包括当前笔记、选中内容、`@` 引用的笔记、链接邻居与工作区搜索片段——仅限你在对话中发送的内容。在 **偏好设置 → AI** 配置你的服务商。

**可以加密工作区吗？**  
可以。在 **偏好设置 → 安全** 中可**可选**启用**工作区加密**。Markdown 笔记会以加密形式保存在磁盘上；打开工作区时需输入密码。图片附件默认明文，可开启 **加密图片**。空闲 **自动锁定** 可在一段时间无操作后锁定已解锁会话。密码仅保留在内存中，从不写入磁盘——遗失密码将无法恢复已加密笔记。

**有插件吗？**  
主题类插件可选——在 **偏好设置 → 插件** 浏览 [lunote-theme](https://github.com/lunote-code/lunote-theme)。双向链接、知识图谱、AI 与导出无需安装插件。

**如何反馈？**  
欢迎 [提 Issue](https://github.com/lunote-code/lunote/issues) 或参与 [讨论](https://github.com/lunote-code/lunote/discussions)。

---

<a id="license"></a>

## 许可证

开源软件。条款见仓库中的许可证文件。

---
