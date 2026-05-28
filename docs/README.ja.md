<div align="center">

# Lunote

**ローカルファーストな Markdown ワークスペース。執筆、リンク、個人ナレッジベース構築を 1 つで**

*洗練されたエディタで書き、Wiki リンクでアイデアをつなぎ、すべてのノートをローカルの `.md` ファイルとして保持できます。無料・オープンソース・オフライン対応です。*

**Typora 風の執筆 + Obsidian 風のリンク — プラグイン不要で内蔵。**

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**ドキュメント:** [全言語](README.md) · [English](README.en.md)

**ガイド（英語）:** [テーマ](guide/themes.md) · [ショートカットと `/` コマンド](guide/shortcuts-and-menus.md) · [一覧](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[プレビュー](#preview) · [Lunote を選ぶ理由](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [ダウンロード](#download) · [クイックスタート](#quick-start) · [ガイド](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — 10秒デモ：執筆、Wikiリンク、ナレッジグラフ、テーマ" width="720" />
  </a>
</p>
<p align="center"><sub>10秒ツアー · ローカル Markdown · Wikiリンク · グラフ · テーマ · プラグイン不要</sub></p>

</div>

---

## Lunote とは？

Lunote は、次の 3 つを同時に求める人のためのデスクトップ Markdown ワークスペースです。

- **ローカルのプレーンな Markdown ファイル**
- **強力な執筆体験**
- **組み込みのナレッジリンク機能**

任意のフォルダをワークスペースとして開き、自分で管理する通常の `.md` ファイルのまま作業できます。流れよく書きたいときはビジュアルモード、細かく制御したいときは Markdown ソースモードに切り替え、Wiki リンク、バックリンク、グラフ、検索をプラグインなしで使えます。

| | |
|---|---|
| **対応プラットフォーム** | macOS、Windows、Linux |
| **UI 言語** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **エクスポート** | PDF、Word (DOCX)、HTML、PNG |
| **技術** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## プレビュー


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Lunote メイン画面" width="720" />
</p>

| ビジュアルエディタ | ナレッジグラフ | テーマ |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="ビジュアルエディタ" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="ナレッジグラフ" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="テーマ" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Lunote を選ぶ理由

- **ローカルファースト**: ノートは自分で管理するフォルダ内の普通の Markdown ファイルです。
- **エディタ中心**: ビジュアル編集と Markdown ソースのどちらも主役です。
- **ナレッジ向け**: Wiki リンク、バックリンク、グラフ、アウトライン、検索を標準搭載しています。
- **実用的**: 必要なときにエクスポートでき、自分のツールで同期でき、オフラインでも使えます。

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| 比較項目 | Typora | Obsidian | Lunote |
|---|---|---|---|
| **向いている人** | シンプルな単一文書の執筆を重視する人 | プラグイン重視の PKM と保管庫カスタマイズを求める人 | 執筆とナレッジリンクを 1 つで行いたい人 |
| **編集スタイル** | ミニマルな Markdown エディタ | 拡張可能な Markdown プラットフォーム | ビジュアル編集 + Markdown ソース |
| **ナレッジ機能** | 限定的 | 強力だがプラグイン依存が多い | Wiki リンク、バックリンク、グラフ、検索を標準搭載 |
| **導入の複雑さ** | 低い | 中〜高 | 低〜中 |
| **プラグイン依存** | 低い | 高い | 低い |
| **選ぶならこんな人** | 主に執筆アプリが欲しい | 主に拡張性とエコシステムが欲しい | 執筆体験とナレッジワークフローを両立したい |

---

<a id="download"></a>

## ダウンロード

**[最新リリース →](https://github.com/lunote-code/lunote/releases)**

現在の GitHub release workflow で配布される成果物:

| プラットフォーム | パッケージ | workflow 参照 |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

macOS 初回起動:

1. **Lunote** を **Applications** に移動する
2. **右クリック → 開く → 開く** を選ぶ
3. 必要なら `xattr -cr /Applications/Lunote.app` を実行する

---

<a id="quick-start"></a>

## クイックスタート

1. 自分の環境に合った Lunote をインストールします。
2. Markdown ノートを含むフォルダを開くか、新しいワークスペースを作成します。
3. 書き始め、`[[` でノートをリンクし、`Ctrl+Shift+F` / `Cmd+Shift+F` で検索し、必要に応じてエクスポートします。

すでに Obsidian、Logseq、Typora ベースの Markdown ライブラリがある場合は、そのフォルダをそのまま開けば使えます。インポートは不要です。

---

<a id="user-guide"></a>

## ガイド（英語）

英語の使い方ガイド（テーマ、ショートカット、**`/`** スラッシュコマンド一覧）:

- [テーマ](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [ショートカットとクイックメニュー](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [ガイド一覧](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**アカウントやインターネット接続は必要ですか？**  
不要です。Lunote はオフラインで動作し、自分で同期しない限りノートはローカルに保存されます。

**既存の Markdown ライブラリを使えますか？**  
はい。`.md` / `.markdown` ファイルを含むフォルダを開くだけです。

**他のツールとの互換性はありますか？**  
あります。Lunote は標準 Markdown を使うため、同じフォルダを Obsidian、VS Code、Typora、Git と併用できます。

**Obsidian や Notion を完全に置き換えられますか？**  
Lunote はローカル Markdown、強い編集体験、組み込みリンク機能に特化しています。モバイルアプリや大規模なプラグインエコシステムが必要なら、他のツールと併用することもできます。

**バグ報告や機能要望はどこから送れますか？**  
[issue を作成](https://github.com/lunote-code/lunote/issues)するか、[discussion を開始](https://github.com/lunote-code/lunote/discussions)してください。

---

<a id="license"></a>

## ライセンス

オープンソースソフトウェアです。詳細はリポジトリ内のライセンスファイルを参照してください。

---

<a id="sponsor"></a>

## プロジェクトを支援

Lunote が役に立った場合：

- **[リポジトリに Star](https://github.com/lunote-code/lunote)** — より多くの人に届きます
- **[フィードバックを共有](https://github.com/lunote-code/lunote/discussions)** — アイデアや使い方もコードと同じくらい大切です

Lunote が役に立った場合、Tron ネットワーク上の **TRC20 USDT** で開発を任意に支援できます。

| | |
|---|---|
| **ネットワーク** | Tron（TRC20）· USDT |
| **アドレス** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>送金前にアドレスを必ず確認してください。オンチェーン送金は取り消せません。支援は任意であり、サービスの購入を意味しません。</sub>

---