<div align="center">

# Lunote

**Локальный Markdown-воркспейс для письма, связывания идей и построения личной базы знаний**

**Письмо в духе Typora + связи в духе Obsidian — встроено, без плагинов.**
*Пишите в удобном редакторе, связывайте идеи через wiki-ссылки и храните каждую заметку как локальный файл `.md`. Бесплатно, с открытым исходным кодом и удобно для офлайн-работы.*

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**Документация:** [Все языки](README.md) · [English](README.en.md)

**Руководство (англ.):** [Темы](guide/themes.md) · [Горячие клавиши и `/`](guide/shortcuts-and-menus.md) · [Оглавление](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[Превью](#preview) · [Почему Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [Скачать](#download) · [Быстрый старт](#quick-start) · [Руководство](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — 10‑сек. демо: письмо, wiki‑ссылки, граф знаний и темы" width="720" />
  </a>
</p>
<p align="center"><sub>10‑сек. обзор · локальный Markdown · wiki‑ссылки · граф · темы · без плагинов</sub></p>

</div>

---

## Что такое Lunote?

Lunote — это desktop Markdown-воркспейс для тех, кто хочет объединить три вещи:

- **Обычные локальные Markdown-файлы**
- **Сильный опыт письма**
- **Встроенные рабочие процессы для связанного знания**

Вы можете открыть любую папку как рабочее пространство и продолжать работать с обычными `.md` файлами, которые принадлежат вам. Пишите в визуальном режиме, когда нужен поток, переключайтесь в Markdown source, когда нужен полный контроль, и используйте wiki-ссылки, обратные ссылки, граф и поиск без плагинов.

| | |
|---|---|
| **Платформы** | macOS, Windows, Linux |
| **Языки интерфейса** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Экспорт** | PDF, Word (DOCX), HTML, PNG |
| **Технологии** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## Превью


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Основное окно Lunote" width="720" />
</p>

| Визуальный редактор | Граф знаний | Тема |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="Визуальный редактор" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="Граф знаний" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="Темы" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Почему Lunote

- **Local-first**: заметки остаются обычными Markdown-файлами в ваших папках.
- **Editor-first**: визуальное редактирование и исходный Markdown одинаково важны.
- **Готово для базы знаний**: wiki-ссылки, обратные ссылки, граф, outline и поиск встроены.
- **Практично**: экспортируйте при необходимости, синхронизируйте своими инструментами и работайте офлайн.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| Пункт сравнения | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Лучше всего подходит для** | Чистого письма в одном документе | PKM с большим количеством плагинов и настройкой хранилища | Письма и связанных знаний в одном приложении |
| **Стиль редактирования** | Минималистичный Markdown-редактор | Расширяемая Markdown-платформа | Визуальное редактирование + Markdown source |
| **Функции базы знаний** | Ограничены | Сильные, часто зависят от плагинов | Встроены wiki-ссылки, обратные ссылки, граф и поиск |
| **Сложность настройки** | Низкая | Средняя или высокая | Низкая или средняя |
| **Зависимость от плагинов** | Низкая | Высокая | Низкая |
| **Выбирайте, если...** | Вам в основном нужен инструмент для письма | Вам в основном нужна экосистема | Вам нужен баланс между письмом и knowledge-workflows |

---

<a id="download"></a>

## Скачать

**[Последний релиз →](https://github.com/lunote-code/lunote/releases)**

Текущий GitHub release workflow публикует такие пакеты:

| Платформа | Пакет | Ссылка на workflow |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

Первый запуск на macOS:

1. Переместите **Lunote** в **Applications**
2. **Правый клик → Open → Open**
3. При необходимости выполните `xattr -cr /Applications/Lunote.app`

---

<a id="quick-start"></a>

## Быстрый старт

1. Установите Lunote для своей платформы.
2. Откройте папку с Markdown-заметками или создайте новый workspace.
3. Пишите, связывайте заметки через `[[`, ищите через `Ctrl+Shift+F` / `Cmd+Shift+F` и экспортируйте при необходимости.

Если у вас уже есть Markdown-библиотека из Obsidian, Logseq или Typora, просто откройте папку. Импорт не нужен.

---

<a id="user-guide"></a>

## Руководство (англ.)

Пошаговые инструкции на английском (темы, сочетания клавиш и полный список команд **`/`**):

- [Темы](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [Горячие клавиши и меню](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Оглавление](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**Нужен ли аккаунт или интернет?**  
Нет. Lunote работает офлайн и хранит заметки локально, если вы сами не настраиваете синхронизацию.

**Можно ли использовать существующую Markdown-библиотеку?**  
Да. Просто откройте любую папку с файлами `.md` / `.markdown`.

**Совместимо ли это с другими инструментами?**  
Да. Lunote использует стандартный Markdown, поэтому ту же папку можно использовать с Obsidian, VS Code, Typora или Git.

**Полностью ли это заменяет Obsidian или Notion?**  
Lunote сосредоточен на локальном Markdown, сильном редактировании и встроенных ссылках. Если вам нужны мобильное приложение или большая экосистема плагинов, вы можете сочетать его с другими инструментами.

**Как сообщить об ошибке или предложить функцию?**  
[Откройте issue](https://github.com/lunote-code/lunote/issues) или начните [discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Лицензия

Программа с открытым исходным кодом. Подробности смотрите в файле лицензии в репозитории.

---

<a id="sponsor"></a>

## Поддержать проект

Если Lunote вам помогает:

- **[Поставьте Star репозиторию](https://github.com/lunote-code/lunote)** — так проект увидят больше людей
- **[Поделитесь отзывом](https://github.com/lunote-code/lunote/discussions)** — идеи и сценарии использования так же важны, как код

Если Lunote вам помогает, вы можете добровольно поддержать разработку через **USDT TRC20** в сети Tron.

| | |
|---|---|
| **Сеть** | Tron (TRC20) · USDT |
| **Адрес** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>Проверьте адрес перед отправкой. On-chain переводы необратимы. Поддержка добровольна и не является покупкой услуги.</sub>

---