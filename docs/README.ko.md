<div align="center">

# Lunote

**로컬 우선 Markdown 워크스페이스. 글쓰기, 연결, 개인 지식 베이스를 한곳에서**

*세련된 에디터에서 글을 쓰고, Wiki 링크로 아이디어를 연결하며, 모든 노트를 로컬 `.md` 파일로 보관하세요. 무료, 오픈소스, 오프라인 작업에 최적화되어 있습니다.*

**Typora 스타일 작성 + Obsidian 스타일 링크 — 플러그인 없이 내장.**

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**문서:** [모든 언어](README.md) · [English](README.en.md)

**가이드(영문):** [테마](guide/themes.md) · [단축키 & `/` 명령](guide/shortcuts-and-menus.md) · [목록](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[미리보기](#preview) · [왜 Lunote인가](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [다운로드](#download) · [빠른 시작](#quick-start) · [가이드](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — 10초 데모: 작성, 위키 링크, 지식 그래프, 테마" width="720" />
  </a>
</p>
<p align="center"><sub>10초 둘러보기 · 로컬 Markdown · 위키 링크 · 그래프 · 테마 · 플러그인 불필요</sub></p>

</div>

---

## Lunote는 무엇인가요?

Lunote는 다음 3가지를 동시에 원하는 사람을 위한 데스크톱 Markdown 워크스페이스입니다.

- **로컬의 순수 Markdown 파일**
- **강력한 글쓰기 경험**
- **내장된 지식 연결 워크플로**

어떤 폴더든 워크스페이스로 열어 직접 관리하는 일반 `.md` 파일 그대로 작업할 수 있습니다. 흐름 있게 쓰고 싶을 때는 시각 모드, 세밀하게 제어하고 싶을 때는 Markdown 소스 모드로 전환하고, Wiki 링크, 백링크, 그래프, 검색을 플러그인 없이 사용할 수 있습니다.

| | |
|---|---|
| **플랫폼** | macOS, Windows, Linux |
| **UI 언어** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **내보내기** | PDF, Word (DOCX), HTML, PNG |
| **기술 스택** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## 미리보기


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Lunote 메인 워크스페이스" width="720" />
</p>

| 비주얼 에디터 | 지식 그래프 | 테마 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="비주얼 에디터" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="지식 그래프" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="테마 프리셋" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## 왜 Lunote인가

- **로컬 우선**: 노트는 내가 관리하는 폴더 안의 일반 Markdown 파일로 남습니다.
- **에디터 중심**: 시각 편집과 원본 Markdown 소스가 모두 핵심 기능입니다.
- **지식 작업에 적합**: Wiki 링크, 백링크, 그래프, 아웃라인, 검색이 기본 내장되어 있습니다.
- **실용적**: 필요할 때 내보내고, 원하는 도구로 동기화하며, 오프라인에서도 작업할 수 있습니다.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| 비교 항목 | Typora | Obsidian | Lunote |
|---|---|---|---|
| **가장 잘 맞는 사용자** | 깔끔한 단일 문서 글쓰기를 원하는 사용자 | 플러그인 중심 PKM과 볼트 커스터마이징을 원하는 사용자 | 글쓰기와 지식 연결을 한 앱에서 처리하고 싶은 사용자 |
| **편집 방식** | 미니멀 Markdown 에디터 | 확장형 Markdown 플랫폼 | 비주얼 편집 + Markdown 소스 |
| **지식 기능** | 제한적 | 강력하지만 플러그인 의존이 많음 | Wiki 링크, 백링크, 그래프, 검색 기본 내장 |
| **설정 복잡도** | 낮음 | 중간~높음 | 낮음~중간 |
| **플러그인 의존도** | 낮음 | 높음 | 낮음 |
| **이런 경우 적합** | 주로 글쓰기 앱이 필요할 때 | 주로 생태계와 확장성이 필요할 때 | 글쓰기 경험과 지식 워크플로를 균형 있게 원할 때 |

---

<a id="download"></a>

## 다운로드

**[최신 릴리스 →](https://github.com/lunote-code/lunote/releases)**

현재 GitHub release workflow에서 제공하는 패키지:

| 플랫폼 | 패키지 | workflow 기준 |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

macOS 첫 실행:

1. **Lunote**를 **Applications**로 이동합니다.
2. **우클릭 → Open → Open**을 선택합니다.
3. 필요하면 `xattr -cr /Applications/Lunote.app` 를 실행합니다.

---

<a id="quick-start"></a>

## 빠른 시작

1. 내 환경에 맞는 Lunote를 설치합니다.
2. Markdown 노트가 들어 있는 폴더를 열거나 새 워크스페이스를 만듭니다.
3. 글을 쓰고, `[[` 로 노트를 연결하고, `Ctrl+Shift+F` / `Cmd+Shift+F` 로 검색하고, 필요하면 내보냅니다.

이미 Obsidian, Logseq, Typora 기반 Markdown 라이브러리가 있다면 폴더를 그대로 열면 됩니다. 별도의 가져오기는 필요하지 않습니다.

---

<a id="user-guide"></a>

## 가이드(영문)

영문 사용 가이드(테마, 단축키, **`/`** 슬래시 명령 전체 목록):

- [테마](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [단축키 및 빠른 메뉴](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [가이드 목록](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**계정이나 인터넷 연결이 필요한가요?**  
아니요. Lunote는 오프라인으로 동작하며, 직접 동기화하지 않는 한 노트는 로컬에 남습니다.

**기존 Markdown 라이브러리를 사용할 수 있나요?**  
네. `.md` / `.markdown` 파일이 있는 폴더를 바로 열면 됩니다.

**다른 도구와 호환되나요?**  
네. Lunote는 표준 Markdown을 사용하므로 같은 폴더를 Obsidian, VS Code, Typora, Git과 함께 사용할 수 있습니다.

**Obsidian이나 Notion을 완전히 대체하나요?**  
Lunote는 로컬 Markdown, 강한 편집 경험, 내장 링크 기능에 집중합니다. 모바일 앱이나 대형 플러그인 생태계가 필요하다면 다른 도구와 함께 사용할 수 있습니다.

**버그 제보나 기능 요청은 어디서 하나요?**  
[issue를 등록](https://github.com/lunote-code/lunote/issues)하거나 [discussion을 시작](https://github.com/lunote-code/lunote/discussions)하세요.

---

<a id="license"></a>

## 라이선스

오픈소스 소프트웨어입니다. 자세한 내용은 저장소의 라이선스 파일을 확인하세요.

---

<a id="sponsor"></a>

## 프로젝트 지원

Lunote가 도움이 되었다면:

- **[저장소에 Star](https://github.com/lunote-code/lunote)** — 더 많은 사람이 발견할 수 있습니다
- **[피드백 공유](https://github.com/lunote-code/lunote/discussions)** — 아이디어와 사용 사례도 코드만큼 중요합니다

Lunote가 도움이 되었다면 Tron 네트워크의 **TRC20 USDT**로 개발을 자발적으로 후원할 수 있습니다.

| | |
|---|---|
| **네트워크** | Tron(TRC20) · USDT |
| **주소** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>전송 전 주소를 반드시 확인하세요. 온체인 전송은 취소할 수 없습니다. 후원은 자발적이며 서비스 구매를 의미하지 않습니다.</sub>

---