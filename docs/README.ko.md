<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>AI로 연결된 지식 체계를 구축하세요.</strong><br />
  <em>Lunote는 Markdown 노트, 위키 링크, 지식 그래프 시각화, AI 지식 발견을 결합해 더 효과적으로 생각하고 학습하고 창작합니다.</em><br />
  <em>흩어진 노트를 연결된 지식으로 — local-first, 선택적 AES-256 작업 공간 암호화, 데이터는 완전히 사용자 통제.</em>
</p>

<p align="center">
  <strong>macOS</strong>, <strong>Windows</strong>, <strong>Linux</strong> 지원.
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
  <a href="#key-features"><img src="https://img.shields.io/badge/workspace%20encryption-AES--256--GCM-green" alt="AES-256 workspace encryption" /></a>
</p>

<h3 align=
>
  <a href=
>선택 이유</a> &nbsp;|&nbsp;
  <a href=
>기능</a> &nbsp;|&nbsp;
  <a href=
>시작하기</a> &nbsp;|&nbsp;
  <a href=
>다운로드</a> &nbsp;|&nbsp;
  <a href=
>기여</a>
</h3>

<p align="center">
  <strong>문서:</strong> <a href="README.md">모든 언어</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>번역:</strong>
  <a href="../README.md">🇬🇧</a>
  <a href="README.zh-CN.md">🇨🇳</a>
  <a href="README.zh-TW.md">🇹🇼</a>
  <a href="README.ja.md">🇯🇵</a>
  <a href="README.de.md">🇩🇪</a>
  <a href="README.fr.md">🇫🇷</a>
  <a href="README.es.md">🇪🇸</a>
  <a href="README.pt.md">🇵🇹</a>
  <a href="README.it.md">🇮🇹</a>
  <a href="README.ru.md">🇷🇺</a>
</p>

<p align="center">
  <strong>가이드:</strong> <a href="guide/themes.md">테마</a> · <a href="guide/shortcuts-and-menus.md">단축키 및 / 명령</a> · <a href="guide/README.md">전체 가이드</a>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">스크린샷</a> · <a href="#why-lunote">이유</a> · <a href="#key-features">기능</a> · <a href="#compare">비교</a> · <a href="#download">다운로드</a> · <a href="#getting-started">빠른 시작</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <img src="assets/demo/lunote-demo.gif" alt="Lunote — 데모: 연결된 지식, 위키 링크, AI, 지식 그래프" width="720" />
</p>
<p align="center"><sub>연결된 지식 · `[[위키 링크]]` · AI 발견 · 그래프 · local-first · 선택적 암호화</sub></p>

---

Lunote는 **AI 네이티브 지식 관리 워크스페이스** — 아이디어가 연결되고 성장하며 AI가 진정으로 이해할 수 있는 개인 지식 베이스입니다. `.md` 폴더를 열고 노트 더미가 아닌 시스템을 구축하세요.

| | |
|---|---|
| **Platforms** | macOS, Windows, Linux |
| **UI languages** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG · print |
| **Security** | Optional workspace encryption (AES-256-GCM) · passwords never saved on disk |

**v1.0.4**: 작업 공간을 열 때 로딩 오버레이에서 멈추지 않습니다. 시각 편집기는 TipTap 3.23.1을 유지합니다(3.30/3.31은 편집을 깨뜨립니다).

---

<a id="why-lunote"></a>

## Lunote를 선택하는 이유

대부분의 노트 앱은 정보 **기록**에는 도움이 됩니다. **지식 구축**까지 돕는 앱은 드뭅니다.

- **일반 노트는 사일로가 되기 쉽습니다** — 아이디어는 폴더에 쌓이지만 관계는 보이지 않습니다. 무엇을 썼는지는 기억해도, 무엇과 연결되는지는 기억하지 못합니다.
- **연결이 지식을 복리로 키웁니다** — 위키 링크, 백링크, 관련 노트가 고립된 페이지를 탐색 가능한 네트워크로 만듭니다.
- **AI는 전체 지식 베이스를 이해해야 합니다** — 열린 문서만이 아니라. 워크스페이스 맥락, 연결된 노트, 검색 결과를 읽을 때 AI가 종합하고 링크를 제안하며 공백을 드러낼 수 있습니다.
- **노트를 저장 시 암호화할 수 있습니다** — 선택적 AES-256-GCM 작업 공간 암호화로 Markdown을 보호；세션마다 비밀번호로 잠금 해제；비밀번호는 디스크에 저장되지 않습니다.

Lunote는 이를 위해 만들어졌습니다: **로컬 우선 개인 지식 베이스**에 **선택적 작업 공간 암호화**를 더해, 연결된 사고와 AI 이해가 함께 작동 — 클라우드 종속, 계정, 플러그인 미로 없이.
---

<a id="key-features"></a>

## 주요 기능

<!-- readme-body-start -->

### AI 기반 지식 베이스

노트를 이해하고 함께 작업하는 AI — 별도의 채팅 창이 아닙니다.

- **워크스페이스 인식 대화** — 현재 노트, 선택 영역, `@` 멘션, 연결된 이웃, 워크스페이스 검색 맥락
- **AI 검색** — 질문 시 전체 vault에서 관련 스니펫 검색
- **요약 및 종합** — 노트, 선택 영역, 주제를 명확한 핵심으로 압축
- **작성 지원** — Lunote Markdown에서 이어 쓰기, 다시 쓰기, 번역, 구조화
- **지식 종합** — 노트 간 분석, 워크스페이스 개요, 주제별 인사이트

**환경 설정 → AI**에서 API 키를 설정하세요 (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama 등).

### 연결된 지식

아이디어 간 관계 구축 — 살아 있는 지식 시스템의 기반.

- **위키 링크** — `[[노트 연결]]`을 자연스럽게 입력; 이름 변경 시 vault 전체 링크 자동 업데이트
- **백링크** — 현재 노트를 가리키는 노트 확인
- **관련 노트** — 맥락을 잃지 않고 스레드 따라가기
- **양방향 연결** — 자동으로 양방향 작동

### 지식 발견

워크스페이스 전체에서 관련 아이디어, 패턴, 숨은 연결 찾기.

- **링크 제안** — AI가 기존 노트를 바탕으로 `[[위키 링크]]` 제안
- **관계 발견** — 주제가 어떻게 클러스터되고 연결되는지 파악
- **주제 탐색** — 알고 있는 것, 부족한 것, 다음에 쓸 내용 정리
- **누락 연결 감지** — 공백, 고아 노트, 링크 부족 아이디어 발견

### 지식 그래프 시각화

그래프는 **지식 네트워크의 뷰** — 지금 생각하는 것 주변의 아이디어 연결.

- 열린 노트 중심의 **로컬 서브그래프** — 깊이와 필터 선택
- **연결로 탐색** — 그래프에서 연결된 노트로 이동
- **지식의 성장 관찰** — 링크가 늘수록 클러스터 형성

> 기본 보기는 활성 노트 주변 **로컬 서브그래프**입니다. **전역** 또는 전체 화면으로 작업 공간 링크 그래프를 봅니다. 성능 한도: **확장**(기본) 400 노드 / 700 에지, **표준** 250 / 400, **컴팩트** 120 / 200 — Obsidian처럼 무제한 vault 그래프는 아닙니다.

### Markdown 네이티브

개방적이고 이식 가능한 미래 지향적 형식.

- **Markdown 우선** — 시각/소스 모드; 집중 모드로 깊이 있게 작성
- **개방 형식** — 디스크의 plain `.md` 파일; 독점 DB 없음
- **이식 가능한 노트** — Obsidian, Typora 등 동일 폴더 사용
- **풍부한 콘텐츠** — 코드 블록, 표, 수식, Mermaid, 콜아웃; PDF, Word, HTML, PNG보내기

### 작업 공간 암호화

저장 시 민감한 노트를 보호 — 내장, 플러그인 불필요.

- **AES-256-GCM** — Markdown 노트 본문을 디스크에서 암호화
- **세션마다 비밀번호** — 작업 공간을 열 때 잠금 해제；디스크에 저장되지 않음
- **작업 공간별 선택** — **환경 설정 → 보안**에서 활성화
- **이미지는 선택** — 첨부 파일은 기본적으로 평문; **이미지 암호화**로 일반 이미지(PNG, JPEG, WebP, GIF, HEIC, SVG 등)를 암호화
- **유휴 자동 잠금** — 입력 없이 일정 시간(기본 5분) 후 저장한 다음, 잠금 해제된 암호화 작업 공간을 잠급니다. 남은 더티 작업이 있으면 잠금을 건너뜁니다

### Local First

지식은 항상 사용자 통제 하에.

- **데이터 소유** — 워크스페이스 폴더에 로컬 저장
- **워크스페이스 기반** — 임의의 vault 열기; Git, Syncthing, iCloud로 원하는 방식 동기화
- **프라이버시** — 오프라인 우선, 계정 불필요; 설정한 AI만 호출
- **필요 시 암호화** — 위 **작업 공간 암호화** 참고；비밀번호는 디스크에 저장되지 않음
- **경량** — 핵심 지식 도구 내장; [테마 팩](https://github.com/lunote-code/lunote-theme) 선택 사항

### 생산성 필수 기능

- 탭, 아웃라인, 명령 팔레트(`Cmd+Shift+P`), 노트별 스냅샷
- 전역 검색(`Cmd+Shift+F` / `Ctrl+Shift+F`), `/` 슬래시 메뉴
- 라이트/다크 테마, **환경 설정 → 플러그인**에서 선택적 팩

<!-- readme-body-end -->

---

<a id="preview"></a>

## 스크린샷

<p align="center">
  <img src="assets/screenshots/ai+code-view.png" alt="AI + 코드 보기 — 워크스페이스 인식 작성" width="720" />
</p>
<p align="center"><sub>AI + 코드 보기 — 워크스페이스 인식 작성</sub></p>

<p align="center">
  <img src="assets/screenshots/graph.png" alt="지식 그래프 — 연결된 아이디어 탐색" width="720" />
</p>
<p align="center"><sub>지식 그래프 — 연결된 아이디어 탐색</sub></p>

### 더 보기

| AI 어시스턴트 | 코드 편집 | 소스 보기 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/AI.png" alt="AI 어시스턴트" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/code-view.png" alt="코드 편집" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="소스 보기" width="240" style="max-width: 100%; height: auto;" /> |

| Mermaid 다이어그램 | 전역 검색 | 테마 설정 |
| :---: | :---: | :---: |
| <img src="assets/screenshots/mermaid.png" alt="Mermaid 다이어그램" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="전역 검색" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="테마 설정" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="getting-started"></a>

## 시작하기

1. **[다운로드](#download)** macOS, Windows 또는 Linux용 Lunote.
2. **워크스페이스 열기** — Obsidian vault, Notion보내기, Typora 폴더 또는 임의의 `.md` 폴더. 가져오기 불필요.
3. **연결 만들기** — `[[`로 노트 연결; 백링크와 현재 노트 주변 지식 그래프 확인.
4. **AI 활성화** — **환경 설정 → AI**에서 API 키 추가 후 노트 또는 전체 workspace에 질문.
5. **발견하고 성장** — AI 링크 제안, workspace 개요, 검색으로 패턴과 공백 찾기.
6. **선택: 작업 공간 암호화** — **환경 설정 → 보안**에서 작업 공간 암호화를 켜 Markdown 노트를 저장 시 보호합니다. 열 때마다 비밀번호를 입력하세요. 필요하면 **이미지 암호화**와 유휴 자동 잠금도 설정하세요.

> **도구를 바꾸나요?** 파일은 그대로입니다. 어떤 Markdown 앱이든 같은 폴더를 읽을 수 있습니다.

---

<a id="download"></a>

## 다운로드

**[최신 릴리스 다운로드 →](https://github.com/lunote-code/lunote/releases)**

가입 불필요 · 로컬 `.md` 파일 · 오프라인 작동 · **선택적 작업 공간 암호화**

<details>
<summary><strong>macOS 첫 실행 (Gatekeeper)</strong></summary>

1. **Lunote**를 **응용 프로그램**으로 이동
2. **우클릭 → 열기 → 열기**
3. 필요 시: `xattr -cr /Applications/Lunote.app`

</details>

| 플랫폼 | 패키지 |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ 선택적 `.deb.asc`) |

---

<a id="compare"></a>

## Lunote vs Notion vs Obsidian

| | Notion | Obsidian | Lunote |
|---|---|---|---|
| **데이터** | 클라우드 계정 | 로컬 `.md` 파일 | 로컬 `.md` 파일 |
| **지식 모델** | workspace 내 페이지 | Vault + 플러그인 | 연결된 workspace, 내장 |
| **AI** | 클라우드 AI (상대 데이터) | 플러그인 의존 | workspace 인식 AI (본인 API 키) |
| **위키 링크 & 그래프** | 기본 | 전체 vault 그래프 (종종 플러그인) | **로컬 서브그래프** + 발견, 내장 |
| **첫 노트까지** | 가입 후 작성 | 플러그인 조정 (선택) | 폴더 열기 → 아이디어 연결 |
| **작업 공간 암호화** | 없음 | 플러그인 / OS | **내장**（AES-256-GCM, 선택） |
| **오프라인 & 프라이버시** | 부분 | 완전 오프라인 | 완전 오프라인, 계정 불필요 |

---

<a id="use-cases"></a>

## 사용 사례

- **개인 지식 베이스** — 위키 링크, 백링크, AI 종합으로 두 번째 뇌 구축
- **연구 & 학습** — 주제 간 읽기, 요약, 인사이트 연결
- **개발자 문서** — ADR, 런북, 스니펫과 코드 블록, PDF보내기
- **Notion·Obsidian 이탈** — 동일 Markdown 폴더, 더 적은 마찰, 업로드 없음
- **민감한 노트와 일기** — 선택적 작업 공간 암호화로 Markdown 본문 보호
- **팀 비동기 문서** — Git으로 workspace 공유; 모두 plain `.md` 유지

---

<a id="roadmap"></a>

## 로드맵

Lunote는 더 깊은 **AI 네이티브 지식 관리** 경험을 향해 발전 중입니다. 방향:

- 더 풍부한 **지식 발견** — 더 똑똑한 링크 제안, 주제 맵, 공백 감지
- 더 깊은 **AI workspace 이해** — 더 나은 맥락, 종합, 노트 간 추론
- 확장된 **그래프 시각화** — 지식 연결 탐색 방법 확대
- 지속적인 **local-first** 다듬기 — 성능,보내기, 크로스 플랫폼 안정성

진행 상황은 [GitHub Discussions](https://github.com/lunote-code/lunote/discussions)와 [Issues](https://github.com/lunote-code/lunote/issues)에서.

---

<a id="star"></a>

## GitHub에서 Lunote에 Star

Lunote가 연결된 지식 구축에 도움이 되었다면 **[저장소에 Star](https://github.com/lunote-code/lunote)**를 — AI 기반 개인 지식 베이스를 찾는 이들에게 도움이 됩니다. 아이디어는 [Discussions](https://github.com/lunote-code/lunote/discussions).

---

<a id="user-guide"></a>

## 사용자 가이드 (영어)

영어 실용 가이드 (테마, 단축키, 전체 **`/`** 명령 목록):

- [테마](guide/themes.md) — 내장 테마, Theme 폴더, 외부 CSS, 스니펫,보내기, **환경 설정 → 플러그인**
- [단축키 & 빠른 메뉴](guide/shortcuts-and-menus.md) — 명령 팔레트, 키보드 단축키, **`/`** 명령
- [작업 공간 암호화](guide/workspace-encryption.md) — AES-256-GCM, 선택적 이미지 암호화, 유휴 자동 잠금
- [지식 그래프](guide/knowledge-graph.md) — 로컬 서브그래프, 전역 / 전체 화면, 성능 한도
- [플랫폼 차이](guide/platform-differences.md) — PDF, 인쇄, 파일 관리자에서 표시
- [가이드 색인](guide/README.md) — 모든 가이드 페이지

---

<a id="development"></a>

## 개발

Lunote를 직접 빌드하려면:

- **요구 사항:** Node.js, Rust, [Tauri](https://tauri.app/) 플랫폼 도구
- **Dev:** `npm install` 후 `npm run tauri:dev`
- **Bundle:** `npm run tauri:bundle` (또는 `tauri:bundle:dmg` / `msi` / `deb`)
- **Docs:** [문서 색인](README.md) · [Packaging](packaging-strategy.md) · [스크립트](../scripts/README.md)

질문? [이슈 열기](https://github.com/lunote-code/lunote/issues). Pull request 환영.

---

<a id="contributing"></a>

## 기여

Pull request 전:

- locale 및 릴리스 도구는 [스크립트 & 유지보수](../scripts/README.md) 참고
- 에디터·보내기 변경 시 `npm run lint` 및 관련 테스트 실행
- [현지화 README](README.md) 메시지 일관성 유지

아이디어와 마이그레이션 이야기: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## FAQ

**계정이나 인터넷이 필요한가요?**  
아니요. Lunote는 offline-first입니다. 폴더를 직접 동기화할 때까지 노트는 로컬에 있습니다. AI는 사용 시 본인 API 키와 네트워크가 필요합니다.

**Lunote는 AI 노트 앱인가요, Markdown 편집기인가요?**  
Lunote는 **개인 지식 베이스**입니다 — Markdown은 노트 저장 방식이고, AI는 workspace를 이해 가능하고 발견 가능하게 만듭니다. 편집기는 지식 시스템을 위해 존재합니다.

**Obsidian vault를 열 수 있나요?**  
예. Lunote를 같은 폴더에 지정하면 됩니다. 마이그레이션 불필요.

**Obsidian이나 Notion을 완전히 대체하나요?**  
항상은 아닙니다. Lunote는 연결된 지식, workspace 인식 AI, local-first 데스크톱 워크플로에 집중합니다. 필요하면 모바일이나 전문 플러그인과 병행하세요.

**Obsidian Graph view처럼 전체 vault 그래프?**  
부분적으로. Lunote는 기본적으로 열린 노트 중심의 **로컬 서브그래프**를 표시합니다. 지식 레일에서 **전역** 또는 전체 화면으로 전환할 수 있습니다(한도: 기본 **확장** 400 노드 / 700 에지, **표준** 250 / 400, **컴팩트** 120 / 200). Obsidian처럼 무제한 vault 그래프는 아닙니다.

**AI는 내 노트를 어떻게 사용하나요?**  
맥락에는 현재 노트, 선택, `@` 멘션, 연결된 이웃, 검색 스니펫이 포함됩니다 — 대화에서 보내는 것만. **환경 설정 → AI**에서 제공자를 설정하세요.

**작업 공간을 암호화할 수 있나요?**  
네. **환경 설정 → 보안**에서 선택적으로 **작업 공간 암호화**를 켤 수 있습니다. Markdown 노트는 암호화되어 저장되며, 열 때 비밀번호가 필요합니다. 이미지는 **이미지 암호화**를 켜기 전까지 평문입니다. **유휴 자동 잠금**은 일정 시간 입력이 없으면 잠금 해제된 세션을 잠글 수 있습니다. 비밀번호는 메모리에만 유지됩니다 — 분실 시 복구할 수 없습니다.

**플러그인이 있나요?**  
테마만 — [lunote-theme](https://github.com/lunote-code/lunote-theme)의 선택 팩을 **환경 설정 → 플러그인**에서. 위키 링크, 지식 그래프, AI,보내기는 설치 없이 작동.

**피드백?**  
[이슈 열기](https://github.com/lunote-code/lunote/issues) 또는 [토론 시작](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## 라이선스

오픈 소스 소프트웨어. 저장소 라이선스 파일을 참고하세요.

---
