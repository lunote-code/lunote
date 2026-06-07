<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>Откройте папку Markdown—пишите, связывайте, исследуйте граф знаний. Без плагинов.</strong><br />
  <em>Бесплатно, open source, офлайн. Каждая заметка — файл <code>.md</code> на диске.</em><br />
  <em>Заметки остаются на вашем компьютере. Без аккаунта и загрузки—синхронизируйте папку сами (Git, Syncthing, iCloud и т. п.).</em>
</p>

<p align="center">
  Доступно для <strong>macOS</strong>, <strong>Windows</strong> и <strong>Linux</strong>.
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
</p>

<h3 align="center">
  <a href="#preview">Скриншот</a> &nbsp;|&nbsp;
  <a href="#overview">О проекте</a> &nbsp;|&nbsp;
  <a href="#capabilities">Возможности</a> &nbsp;|&nbsp;
  <a href="#download">Скачать</a> &nbsp;|&nbsp;
  <a href="#development">Разработка</a> &nbsp;|&nbsp;
  <a href="#contribution">Участие</a>
</h3>

<p align="center">
  <strong>Docs:</strong> <a href="README.md">All languages</a> · <a href="../README.md">English</a>
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
  <strong>Руководство (англ.):</strong> <a href="guide/themes.md">Темы</a> · <a href="guide/shortcuts-and-menus.md">Горячие клавиши и <code>/</code></a> · <a href="guide/README.md">Оглавление</a>
</p>

<p align="center">
  <strong>Письмо в духе Typora + связи в духе Obsidian — встроено.</strong>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Скачать-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Скачать-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Скачать-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Скачать-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Скачать-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Скачать-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">Скриншот</a> · <a href="#overview">О проекте</a> · <a href="#capabilities">Возможности</a> · <a href="#download">Скачать</a> · <a href="#quick-start">Быстрый старт</a> · <a href="#user-guide">Руководство</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — демо: письмо, wiki‑ссылки, граф, темы" width="720" />
  </a>
</p>
<p align="center"><sub>Письмо · `[[wiki‑ссылки]]` · обратные ссылки · граф · экспорт · темы</sub></p>

---

<a id="preview"></a>

## Скриншот

<p align="center">
  <img src="assets/screenshots/head-view.png" alt="Lunote — первый запуск" width="720" />
</p>

| Редактор кода | Граф знаний | Глобальный поиск |
| :---: | :---: | :---: |
| <img src="assets/screenshots/code-view.png" alt="Редактор кода" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/graph.png" alt="Граф знаний" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="Глобальный поиск" width="240" style="max-width: 100%; height: auto;" /> |

| Снимки истории | Настройки темы |
| :---: | :---: |
| <img src="assets/screenshots/snipaste.png" alt="Снимки истории" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="Настройки темы" width="240" style="max-width: 100%; height: auto;" /> |

### Другие превью тем

Доп. скриншоты: `assets/screenshots/theme/`. Готовые CSS, JSON-токены и сниппеты: **[Примеры тем](theme-example/README.md)**.

| GitHub Light | GitHub Dark | IDEA Light | IDEA Dark | Dim Light |
| :---: | :---: | :---: | :---: | :---: |
| <img src="assets/screenshots/theme/github-light.png" alt="GitHub Light" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/github-dark.png" alt="GitHub Dark" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/idea-light.png" alt="IDEA Light" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/idea-dark.png" alt="IDEA Dark" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/dim-light.png" alt="Dim Light" width="200" style="max-width: 100%; height: auto;" /> |

| Dim Dark | Forest Dawn | Ember Glow | Graphite Noir | Lavender Haze |
| :---: | :---: | :---: | :---: | :---: |
| <img src="assets/screenshots/theme/dim-dark.png" alt="Dim Dark" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/forest-dawn.png" alt="Forest Dawn" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/ember-glow.png" alt="Ember Glow" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/graphite-noir.png" alt="Graphite Noir" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/lavender-haze.png" alt="Lavender Haze" width="200" style="max-width: 100%; height: auto;" /> |

---

<!-- readme-body-start -->
<a id="overview"></a>

## Обзор

Откройте папку с **файлами `.md`** и пишите. Lunote добавляет `[[wiki‑ссылки]]`, обратные ссылки и граф—**без аккаунта и магазина плагинов**.

- Откройте **папку `.md`** как workspace
- **Визуальный и исходный** режим по горячей клавише
- Встроенные **wiki‑ссылки**, обратные ссылки, граф, структура и поиск

| | |
|---|---|
| **Платформы** | macOS, Windows, Linux |
| **Языки интерфейса** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Экспорт** | PDF, Word (DOCX), HTML, PNG · print |

---

<a id="capabilities"></a>

## Возможности

Выберите свой сценарий—всё ниже уже в приложении:

### Письмо

*Эссе, документы, дневник—форматированный текст или сырой Markdown.*

- Визуальный редактор и **исходник**; `Cmd+/` / `Ctrl+/`
- Меню **`/`**: заголовки, таблицы, Mermaid, wiki‑ссылки
- Таблицы, формулы, **фокус**, палитра команд
- **Блоки кода**: номера строк, подсветка, язык, сворачивание и копирование
- **Панель форматирования** (callout, цвета и т.д.); скрыть в **Файл → Настройки → Типографика**
- **Ширина колонки**, шрифт и размер в **Настройки → Типографика**

### Связи

*Второй мозг: `[[ссылки]]`, обратные ссылки и граф без плагинов.*

- `[[wiki‑ссылки]]` с автодополнением
- **Панель знаний**: обратные ссылки, локальный граф, встраивания, теги и **YAML frontmatter**
- Переименование обновляет `[[ссылки]]`

### Порядок

*Когда хранилище растёт: вкладки, ежедневные заметки, структура и поиск по всем заметкам.*

- Дерево файлов, вкладки, **глобальный поиск**
- **Структура** и внешние изменения
- Сохранение, конфликты, показать в проводнике
- **Ежедневные заметки**: сегодня, вчера или завтра—из шаблона (`Cmd+Shift+D` / `Ctrl+Shift+D`)
- **Шаблоны заметок** с переменными (`{{date:…}}`, `{{title}}`, …) в **Файл → Шаблоны**
- **Быстрый захват**: системный трей + глобальное сочетание открывают сегодняшнюю заметку в фоне

### Экспорт и темы

*Поделиться или печать: PDF, Word, HTML—и темы под вашим контролем.*

- **PDF, HTML, DOCX, PNG**, **печать**
- Темы, папка **Theme**, внешний CSS
- Пресеты **ширины колонки** (Узкая / Стандарт / Широкая) для визуального режима и предпросмотра

### История

*Смелые правки—снимки показывают превью до записи на диск.*

- **Снимки**; восстановление без перезаписи до сохранения

<!-- readme-body-end -->

---

<a id="download"></a>

## Скачать

**[Скачать последний релиз →](https://github.com/lunote-code/lunote/releases)**

Без регистрации · только локальные `.md` · работает офлайн

<details>
<summary><strong>Первый запуск macOS (Gatekeeper)</strong></summary>

1. Переместите **Lunote** в **Программы**
2. **ПКМ → Открыть → Открыть**
3. При необходимости: `xattr -cr /Applications/Lunote.app`

</details>

| Platform | Package |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) |

---

<a id="quick-start"></a>

## Быстрый старт

1. Установите Lunote в разделе **[Скачать](#download)**.
2. **Откройте существующее хранилище**—Obsidian, Logseq, Typora или любую папку `.md`. Импорт не нужен.
3. Пишите, `[[` для ссылок, `Cmd+Shift+F` / `Ctrl+Shift+F` для поиска, экспорт в PDF или Word при необходимости.

> **Переход с другого приложения?** Файлы остаются на месте. Другие программы читают тот же Markdown.

---

<a id="why-lunote"></a>

## Почему Lunote

- **Ваши файлы**: обычные `.md` в ваших папках.
- **Одно приложение**: удобное письмо, wiki‑ссылки и граф встроены—без плагинов.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Сравнение

Уже пользуетесь Typora или Obsidian? Lunote для тех, кому нужны **удобное письмо и wiki‑ссылки в одном десктоп‑приложении** без настройки плагинов.

| | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Письмо** | Отлично | Хорошо | Отлично, встроено |
| **Wiki‑ссылки и граф** | Слабо | Сильно (часто плагины) | Сильно, встроено |
| **Плагины для старта** | Мало | Много | Не нужны |


---


<a id="user-guide"></a>

## Руководство (англ.)

Пошаговые инструкции на английском (темы, сочетания клавиш и полный список команд **`/`**):

- [Темы](guide/themes.md) — built-in themes, Theme folder, external CSS, snippets, export styles
- [Горячие клавиши и меню](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Templates](Templates/README.md) — default and daily note templates, variables
- [Различия платформ](guide/platform-differences.md) — PDF, печать, показать в файловом менеджере, заметки по ОС
- [Оглавление](guide/README.md) — all guide pages

---


<a id="development"></a>

## Разработка

Собрать Lunote самостоятельно:

- **Требования:** Node.js, Rust и инструменты [Tauri](https://tauri.app/)
- **Разработка:** `npm install`, затем `npm run tauri:dev`
- **Сборка:** `npm run tauri:bundle` (или `tauri:bundle:dmg` / `msi` / `deb`)
- **Документация:** [Указатель документации](README.md) · [Packaging](packaging-strategy.md) · [Скрипты](../scripts/README.md)

Вопросы: [Issue](https://github.com/lunote-code/lunote/issues). PR приветствуются.

---

<a id="contribution"></a>

## Участие

Перед pull request:

- Прочитать [Скрипты и сопровождение](../scripts/README.md) (локали и релизы)
- При изменениях редактора или экспорта — `npm run lint` и нужные тесты
- Согласовывать тексты в [локализованных README](README.md)

Идеи: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

---

<a id="faq"></a>

## FAQ

**Нужен аккаунт или интернет?**  
Нет. Работает офлайн; заметки локальны, пока вы сами не синхронизируете папку.

**Открыть папку Obsidian или Typora?**  
Да. Откройте папку как workspace—те же `.md`.

**Использовать вместе с Obsidian?**  
Да. Одна папка для обоих. Lunote не блокирует данные.

**Заменяет Obsidian или Notion полностью?**  
Не всегда. Фокус: письмо на десктопе и встроенные связи.

**Сообщить об ошибке или идее?**  
[Issue](https://github.com/lunote-code/lunote/issues) или [Discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Лицензия

ПО с открытым исходным кодом. Условия — в файле лицензии репозитория.

<a id="sponsor"></a>

## Поддержать проект

Если Lunote вам помогает, вы можете добровольно поддержать разработку через **USDT TRC20** в сети Tron.

| | |
|---|---|
| **Сеть** | Tron (TRC20) · USDT |
| **Адрес** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |

<sub>Проверьте адрес перед отправкой. On-chain переводы необратимы. Поддержка добровольна и не является покупкой услуги.</sub>

---