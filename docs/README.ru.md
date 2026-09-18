<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>Создайте связанную систему знаний с ИИ.</strong><br />
  <em>Lunote объединяет Markdown-заметки, wiki-ссылки, визуализацию графа знаний и ИИ-поиск идей — для более эффективного мышления, обучения и творчества.</em><br />
  <em>Превратите разрозненные заметки в связанные знания — local-first, опциональное шифрование workspace AES-256 и полностью под вашим контролем.</em>
</p>

<p align="center">
  Доступно для <strong>macOS</strong>, <strong>Windows</strong> и <strong>Linux</strong>.
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
>Почему Lunote</a> &nbsp;|&nbsp;
  <a href=
>Возможности</a> &nbsp;|&nbsp;
  <a href=
>Быстрый старт</a> &nbsp;|&nbsp;
  <a href=
>Скачать</a> &nbsp;|&nbsp;
  <a href=
>Участие</a>
</h3>

<p align="center">
  <strong>Документация:</strong> <a href="README.md">Все языки</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>Переводы:</strong>
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
</p>

<p align="center">
  <strong>Руководство:</strong> <a href="guide/themes.md">Темы</a> · <a href="guide/shortcuts-and-menus.md">Горячие клавиши и команды /</a> · <a href="guide/README.md">Все руководства</a>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">Скриншоты</a> · <a href="#why-lunote">Почему</a> · <a href="#key-features">Функции</a> · <a href="#compare">Сравнение</a> · <a href="#download">Скачать</a> · <a href="#getting-started">Старт</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <img src="assets/demo/lunote-demo.gif" alt="Lunote — демо: связанные знания, wiki-ссылки, ИИ, граф" width="720" />
</p>
<p align="center"><sub>Связанные знания · `[[wiki‑ссылки]]` · ИИ-поиск · граф · local-first · опциональное шифрование</sub></p>

---

Lunote — **рабочее пространство управления знаниями с ИИ** — персональная база знаний, где идеи связываются, растут и становятся понятными для ИИ. Откройте папку `.md` и стройте систему, а не просто кучу заметок.

| | |
|---|---|
| **Platforms** | macOS, Windows, Linux |
| **UI languages** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG · print |
| **Security** | Optional workspace encryption (AES-256-GCM) · passwords never saved on disk |

Заметки о релизах в [CHANGELOG.md](../CHANGELOG.md). **v1.0.3**: автоблокировка по бездействию, опциональные шаблоны новой заметки, исправления каретки / режима исходника / истории версий.

---

<a id="why-lunote"></a>

## Почему Lunote

Большинство приложений для заметок помогают **сохранять** информацию. Мало кто помогает **строить знания**.

- **Обычные заметки становятся «силосами»** — идеи копятся в папках, но связи остаются невидимыми. Вы помните, что писали, но не как это связано с остальным.
- **Связи умножают знания** — wiki-ссылки, обратные ссылки и связанные заметки превращают изолированные страницы в навигируемую сеть.
- **ИИ должен понимать всю базу знаний** — не только открытый документ. Читая контекст workspace, связанные заметки и результаты поиска, ИИ может синтезировать, предлагать ссылки и находить пробелы.
- **Заметки могут храниться зашифрованными** — опциональное шифрование workspace AES-256-GCM защищает Markdown на диске; пароль на каждую сессию; пароли не сохраняются на диске.

Lunote создан для этого: **local-first персональная база знаний** с опциональным **шифрованием workspace**, где связанное мышление и понимание ИИ работают вместе — без облачной привязки, аккаунтов и лабиринта плагинов.
---

<a id="key-features"></a>

## Ключевые возможности

<!-- readme-body-start -->

### База знаний с ИИ

ИИ, который понимает и работает с вашими заметками — не отдельное окно чата.

- **Диалоги с учётом workspace** — контекст текущей заметки, выделения, упоминаний `@`, связанных соседей и поиска
- **ИИ-поиск** — релевантные фрагменты по всему vault при запросе
- **Резюме и синтез** — сжатие заметок, выделений или тем в ясные выводы
- **Помощь в написании** — продолжение, переписывание, перевод и структурирование в Lunote Markdown
- **Синтез знаний** — межзаметочный анализ, обзоры workspace и инсайты по темам

Свой API-ключ в **Настройки → ИИ** (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama и др.).

### Связанные знания

Стройте связи между идеями — основа живой системы знаний.

- **Wiki-ссылки** — `[[связать заметки]]` при написании; переименование обновляет ссылки во vault
- **Обратные ссылки** — что указывает на читаемую заметку
- **Связанные заметки** — следуйте нитям без потери контекста
- **Двунаправленные связи** — автоматически в обе стороны

### Обнаружение знаний

Находите связанные идеи, паттерны и скрытые связи в workspace.

- **Предложения ссылок** — ИИ предлагает `[[wiki-ссылки]]` на основе ваших заметок
- **Обнаружение связей** — как темы группируются и соотносятся
- **Исследование тем** — что вы знаете, чего не хватает и что писать дальше
- **Поиск пробелов** — лакуны, сироты и слабо связанные идеи

### Визуализация графа знаний

Граф — это **вид сети знаний** — как идеи связаны вокруг вашего текущего фокуса.

- **Локальный подграф** вокруг открытой заметки — глубина и фильтры
- **Навигация по связям** — переход между связанными заметками с графа
- **Наблюдайте рост знаний** — кластеры формируются по мере связывания идей

> По умолчанию — **локальный подграф** вокруг активной заметки. **Глобальный** или полноэкранный режим показывает граф ссылок workspace. Лимиты: **расширенный** (по умолчанию) 400 узлов / 700 рёбер, **стандарт** 250 / 400, **компактный** 120 / 200 — это не безлимитный граф vault как в Obsidian.

### Markdown-нативность

Заметки в открытом, переносимом формате с запасом на будущее.

- **Markdown в приоритете** — визуальный или исходный режим; режим фокуса
- **Открытый формат** — plain `.md` на диске; без проприетарной БД
- **Переносимые заметки** — та же папка в Obsidian, Typora или любом Markdown-редакторе
- **Богатый контент** — блоки кода, таблицы, формулы, Mermaid, callouts; экспорт в PDF, Word, HTML, PNG

### Шифрование workspace

Защита конфиденциальных заметок на диске — встроено, без плагинов.

- **AES-256-GCM** — тела Markdown-заметок зашифрованы на диске
- **Пароль на сессию** — разблокировка при открытии workspace; не сохраняется на диске
- **Опционально для каждого workspace** — включить в **Настройки → Безопасность**
- **Изображения по желанию** — вложения по умолчанию в открытом виде; **Шифровать изображения** шифрует распространённые форматы (PNG, JPEG, WebP, GIF, HEIC, SVG и т. д.)
- **Автоблокировка** — после бездействия (по умолчанию 5 минут) сохраняет, затем блокирует разблокированный зашифрованный workspace; оставшаяся грязная работа пропускает блокировку

### Local First

Ваши знания остаются под вашим контролем.

- **Вы владеете данными** — заметки на вашей машине в папке workspace
- **На основе workspace** — откройте любой vault; синхронизируйте через Git, Syncthing или iCloud на своих условиях
- **Конфиденциальность** — offline-first, без аккаунта; ИИ только по вашей настройке
- **Шифрование по необходимости** — см. **Шифрование workspace** выше; пароли не сохраняются на диске
- **Легковесность** — основные инструменты встроены; [пакеты тем](https://github.com/lunote-code/lunote-theme) опциональны

### Базовая продуктивность

- Вкладки, структура, палитра команд (`Cmd+Shift+P`), снимки заметок
- Глобальный поиск (`Cmd+Shift+F` / `Ctrl+Shift+F`), меню `/`
- Светлая/тёмная тема и опциональные пакеты в **Настройки → Плагины**

<!-- readme-body-end -->

---

<a id="preview"></a>

## Скриншоты

<p align="center">
  <img src="assets/screenshots/ai+code-view.png" alt="ИИ + режим кода — письмо с учётом рабочей области" width="720" />
</p>
<p align="center"><sub>ИИ + режим кода — письмо с учётом рабочей области</sub></p>

<p align="center">
  <img src="assets/screenshots/graph.png" alt="Граф знаний — исследуйте связанные идеи" width="720" />
</p>
<p align="center"><sub>Граф знаний — исследуйте связанные идеи</sub></p>

### Ещё

| ИИ-ассистент | Редактор кода | Режим исходного кода |
| :---: | :---: | :---: |
| <img src="assets/screenshots/AI.png" alt="ИИ-ассистент" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/code-view.png" alt="Редактор кода" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="Режим исходного кода" width="240" style="max-width: 100%; height: auto;" /> |

| Диаграммы Mermaid | Глобальный поиск | Настройки темы |
| :---: | :---: | :---: |
| <img src="assets/screenshots/mermaid.png" alt="Диаграммы Mermaid" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="Глобальный поиск" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="Настройки темы" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="getting-started"></a>

## Быстрый старт

1. **[Скачать](#download)** Lunote для macOS, Windows или Linux.
2. **Откройте workspace** — vault Obsidian, экспорт Notion, папка Typora или любая папка `.md`. Импорт не нужен.
3. **Создавайте связи** — введите `[[` для ссылок; смотрите обратные ссылки и граф вокруг текущей заметки.
4. **Включите ИИ** — добавьте API-ключ в **Настройки → ИИ**, затем спрашивайте о заметке или всём workspace.
5. **Открывайте и развивайте** — предложения ссылок ИИ, обзоры workspace и поиск для паттернов и пробелов.
6. **Необязательно: шифрование workspace** — в **Настройки → Безопасность** включите шифрование, чтобы защитить Markdown-заметки на диске. Вводите пароль при открытии. При необходимости включите **Шифровать изображения** и автоблокировку.

> **Меняете инструмент?** Файлы не переезжают. Любое Markdown-приложение читает ту же папку.

---

<a id="download"></a>

## Скачать

**[Скачать последний релиз →](https://github.com/lunote-code/lunote/releases)**

Без регистрации · локальные `.md` файлы · работает офлайн · **опциональное шифрование workspace**

<details>
<summary><strong>Первый запуск macOS (Gatekeeper)</strong></summary>

1. Переместите **Lunote** в **Программы**
2. **Правый клик → Открыть → Открыть**
3. При необходимости: `xattr -cr /Applications/Lunote.app`

</details>

| Платформа | Пакет |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ опционально `.deb.asc`) |

---

<a id="compare"></a>

## Lunote vs Notion vs Obsidian

| | Notion | Obsidian | Lunote |
|---|---|---|---|
| **Ваши данные** | Облачный аккаунт | Локальные `.md` | Локальные `.md` |
| **Модель знаний** | Страницы в workspace | Vault + плагины | Связанный workspace, встроено |
| **ИИ** | Облачный ИИ на их данных | Зависит от плагинов | ИИ с учётом workspace (ваш API-ключ) |
| **Wiki-ссылки и граф** | Базово | Граф vault (часто плагин) | **Локальный подграф** + обнаружение, встроено |
| **До первой заметки** | Регистрация и письмо | Настройка плагинов (опционально) | Открыть папку → связать идеи |
| **Шифрование workspace** | Нет | Плагин / ОС | **Встроено** (AES-256-GCM, опционально) |
| **Офлайн и приватность** | Частично | Полный офлайн | Полный офлайн, без аккаунта |

---

<a id="use-cases"></a>

## Сценарии использования

- **Персональная база знаний** — второй мозг с wiki-ссылками, обратными ссылками и синтезом ИИ
- **Исследования и обучение** — связывайте чтения, резюме и инсайты между темами
- **Документация разработчика** — ADR, runbook и сниппеты с блоками кода и экспортом PDF
- **Уход с Notion или Obsidian** — те же папки Markdown, меньше трения, без загрузки
- **Конфиденциальные заметки и дневники** — опциональное шифрование workspace защищает Markdown на диске
- **Асинхронные командные docs** — делитесь workspace через Git; у всех plain `.md`

---

<a id="roadmap"></a>

## Дорожная карта

Lunote развивается к более глубокому **ИИ-нативному управлению знаниями**. Направления:

- Более богатое **обнаружение знаний** — умные предложения ссылок, карты тем, поиск пробелов
- Более глубокое **понимание workspace ИИ** — лучший контекст, синтез и рассуждение между заметками
- Расширенная **визуализация графа** — больше способов исследовать связи
- Продолжающаяся **local-first** полировка — производительность, экспорт и кроссплатформенная надёжность

Следите за прогрессом в [GitHub Discussions](https://github.com/lunote-code/lunote/discussions) и [Issues](https://github.com/lunote-code/lunote/issues).

---

<a id="star"></a>

## Поставьте Star Lunote на GitHub

Если Lunote помогает строить связанные знания, **[поставьте Star репозиторию](https://github.com/lunote-code/lunote)** — так другие найдут персональную базу знаний с ИИ. Идеи — в [Discussions](https://github.com/lunote-code/lunote/discussions).

---

<a id="user-guide"></a>

## Руководство пользователя (английский)

Практические руководства на английском (темы, горячие клавиши и полный список команд **`/`**):

- [Темы](guide/themes.md) — встроенные темы, папка Theme, внешний CSS, сниппеты, экспорт, **Настройки → Плагины**
- [Горячие клавиши и быстрые меню](guide/shortcuts-and-menus.md) — палитра команд, сочетания клавиш, команды **`/`**
- [Шифрование workspace](guide/workspace-encryption.md) — AES-256-GCM, опциональное шифрование изображений, автоблокировка
- [Граф знаний](guide/knowledge-graph.md) — локальный подграф, глобальный / полный экран, лимиты
- [Различия платформ](guide/platform-differences.md) — PDF, печать, показать в файловом менеджере
- [Указатель руководств](guide/README.md) — все страницы

---

<a id="development"></a>

## Разработка

Чтобы собрать Lunote самостоятельно:

- **Требования:** Node.js, Rust и инструменты [Tauri](https://tauri.app/)
- **Dev:** `npm install`, затем `npm run tauri:dev`
- **Bundle:** `npm run tauri:bundle` (или `tauri:bundle:dmg` / `msi` / `deb`)
- **Docs:** [Указатель документации](README.md) · [Packaging](packaging-strategy.md) · [Скрипты](../scripts/README.md)

Вопросы? [Откройте issue](https://github.com/lunote-code/lunote/issues). Pull request приветствуются.

---

<a id="contributing"></a>

## Участие

Перед pull request:

- Прочитайте [Скрипты и обслуживание](../scripts/README.md) для locale и релизов
- Запустите `npm run lint` и релевантные тесты при изменении редактора или экспорта
- Держите сообщения согласованными в [локализованных README](README.md)

Идеи и истории миграции: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## FAQ

**Нужен ли аккаунт или интернет?**  
Нет. Lunote — offline-first. Заметки локальны, пока вы сами не синхронизируете папку. ИИ требует ваш API-ключ и сеть при использовании.

**Lunote — ИИ-приложение для заметок или Markdown-редактор?**  
Lunote — **персональная база знаний**: Markdown хранит заметки, ИИ делает workspace понятным и обнаруживаемым. Редактор служит системе знаний.

**Можно открыть vault Obsidian?**  
Да. Укажите Lunote на ту же папку. Миграция не нужна.

**Полностью заменяет Obsidian или Notion?**  
Не всегда. Lunote фокусируется на связанных знаниях, ИИ workspace и local-first desktop. Дополняйте мобильными или спецплагинами при необходимости.

**Граф всего vault как Obsidian Graph view?**  
Частично. По умолчанию Lunote показывает **локальный подграф** вокруг открытой заметки. В панели знаний можно включить **глобальный** или полноэкранный режим — связанные заметки workspace, с лимитами (по умолчанию **расширенный**: 400 узлов / 700 рёбер; **стандарт**: 250 / 400; **компактный**: 120 / 200). Это не безлимитный граф vault как в Obsidian.

**Как ИИ использует мои заметки?**  
Контекст включает текущую заметку, выделение, упоминания `@`, связанных соседей и фрагменты поиска — только то, что вы отправляете. Настройте провайдера в **Настройки → ИИ**.

**Можно ли шифровать workspace?**  
Да. В **Настройки → Безопасность** можно включить **шифрование workspace**. Markdown-заметки хранятся зашифрованными; пароль при открытии. Изображения остаются открытым текстом, пока не включите **Шифровать изображения**. **Автоблокировка** может заблокировать разблокированную сессию после бездействия. Пароли только в памяти — при потере восстановить заметки нельзя.

**Есть ли плагины?**  
Только для тем — опциональные пакеты в **Настройки → Плагины** из [lunote-theme](https://github.com/lunote-code/lunote-theme). Wiki-ссылки, граф, ИИ и экспорт без установки.

**Обратная связь?**  
[Откройте issue](https://github.com/lunote-code/lunote/issues) или [начните discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Лицензия

Программное обеспечение с открытым исходным кодом. См. файл лицензии в репозитории.

---
