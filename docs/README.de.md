<div align="center">

# Lunote

**Ein local-first Markdown-Workspace zum Schreiben, Verknüpfen und Aufbauen einer persönlichen Wissensbasis**

*Schreibe in einem modernen Editor, verbinde Ideen mit Wiki-Links und speichere alle Notizen als lokale `.md`-Dateien. Kostenlos, Open Source und für Offline-Arbeit gemacht.*

**Typora-artiges Schreiben + Obsidian-artige Verknüpfung — eingebaut, ohne Plugins.**

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**Dokumentation:** [Alle Sprachen](README.md) · [English](README.en.md)

**Anleitung (Englisch):** [Design](guide/themes.md) · [Shortcuts & `/`-Befehle](guide/shortcuts-and-menus.md) · [Übersicht](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[Vorschau](#preview) · [Warum Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [Download](#download) · [Schnellstart](#quick-start) · [Anleitung](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — 10s-Demo: Schreiben, Wiki-Links, Wissensgraph und Themes" width="720" />
  </a>
</p>
<p align="center"><sub>10s Tour · lokales Markdown · Wiki-Links · Graph · Themes · keine Plugins</sub></p>

</div>

---

## Was ist Lunote?

Lunote ist ein Desktop-Markdown-Workspace für Menschen, die drei Dinge gleichzeitig wollen:

- **Lokale, einfache Markdown-Dateien**
- **Ein starkes Schreiberlebnis**
- **Integrierte Wissensverknüpfung**

Du kannst jeden Ordner direkt als Workspace öffnen und weiter mit normalen `.md`-Dateien arbeiten, die dir gehören. Schreibe im visuellen Modus, wenn du im Flow bleiben willst, wechsle in den Markdown-Quellmodus, wenn du volle Kontrolle brauchst, und nutze Wiki-Links, Backlinks, Graph und Suche ohne Plugins.

| | |
|---|---|
| **Plattformen** | macOS, Windows, Linux |
| **UI-Sprachen** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG |
| **Technik** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## Vorschau


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Lunote Hauptansicht" width="720" />
</p>

| Visueller Editor | Wissensgraph | Theme |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="Visueller Editor" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="Wissensgraph" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="Themes" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Warum Lunote

- **Local-first**: Deine Notizen bleiben normale Markdown-Dateien in deinen eigenen Ordnern.
- **Editor-first**: Visuelles Bearbeiten und roher Markdown-Quelltext sind beide gleich wichtig.
- **Wissensbereit**: Wiki-Links, Backlinks, Graph, Gliederung und Suche sind integriert.
- **Praktisch**: Exportiere bei Bedarf, synchronisiere mit deinen eigenen Tools und arbeite offline.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| Vergleichspunkt | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Am besten für** | Klares Schreiben in einem einzelnen Dokument | Plugin-lastiges PKM und Vault-Anpassung | Schreiben + Wissensverknüpfung in einer App |
| **Bearbeitungsstil** | Minimalistischer Markdown-Editor | Erweiterbare Markdown-Plattform | Visuelles Editieren + Markdown-Quelle |
| **Wissensfunktionen** | Begrenzt | Stark, oft pluginbasiert | Integrierte Wiki-Links, Backlinks, Graph, Suche |
| **Einrichtungsaufwand** | Niedrig | Mittel bis hoch | Niedrig bis mittel |
| **Plugin-Abhängigkeit** | Niedrig | Hoch | Niedrig |
| **Wähle es, wenn...** | Du vor allem eine Schreib-App willst | Du vor allem ein Ökosystem willst | Du Schreiben und Wissens-Workflows ausbalancieren willst |

---

<a id="download"></a>

## Download

**[Neueste Version →](https://github.com/lunote-code/lunote/releases)**

Der aktuelle GitHub release workflow veröffentlicht diese Pakete:

| Plattform | Paket | Workflow-Referenz |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

Erster Start auf macOS:

1. Verschiebe **Lunote** nach **Applications**
2. **Rechtsklick → Open → Open**
3. Falls nötig, führe `xattr -cr /Applications/Lunote.app` aus

---

<a id="quick-start"></a>

## Schnellstart

1. Installiere Lunote für deine Plattform.
2. Öffne einen Ordner mit Markdown-Notizen oder erstelle einen neuen Workspace.
3. Schreibe, verknüpfe Notizen mit `[[`, suche mit `Ctrl+Shift+F` / `Cmd+Shift+F` und exportiere bei Bedarf.

Wenn du bereits eine Markdown-Bibliothek aus Obsidian, Logseq oder Typora hast, öffne einfach den Ordner. Ein Import ist nicht nötig.

---

<a id="user-guide"></a>

## Anleitung (Englisch)

Englische Schritt-für-Schritt-Hilfe (Themes, Shortcuts und die vollständige **`/`**-Befehlsliste):

- [Themes](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [Shortcuts & Schnellmenüs](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Anleitungsindex](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**Brauche ich ein Konto oder Internet?**  
Nein. Lunote funktioniert offline und speichert Notizen lokal, solange du sie nicht selbst synchronisierst.

**Kann ich eine bestehende Markdown-Bibliothek verwenden?**  
Ja. Öffne einfach einen Ordner mit `.md` / `.markdown` Dateien.

**Ist es mit anderen Tools kompatibel?**  
Ja. Lunote nutzt Standard-Markdown, daher kann derselbe Ordner weiter mit Obsidian, VS Code, Typora oder Git verwendet werden.

**Ersetzt es Obsidian oder Notion vollständig?**  
Lunote konzentriert sich auf lokales Markdown, starkes Editieren und integrierte Verlinkung. Wenn du mobile Apps oder ein großes Plugin-Ökosystem brauchst, kannst du es weiterhin mit anderen Tools kombinieren.

**Wie melde ich Bugs oder wünsche Funktionen?**  
[Erstelle ein Issue](https://github.com/lunote-code/lunote/issues) oder starte eine [Discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Lizenz

Open-Source-Software. Details stehen in der Lizenzdatei des Repositories.

---

<a id="sponsor"></a>

## Projekt unterstützen

Wenn Lunote dir hilft:

- **[Gib dem Repo einen Star](https://github.com/lunote-code/lunote)** — so finden es mehr Menschen
- **[Feedback teilen](https://github.com/lunote-code/lunote/discussions)** — Ideen und Use Cases zählen genauso wie Code

Wenn Lunote dir hilft, kannst du die Entwicklung freiwillig per **TRC20 USDT** im Tron-Netzwerk unterstützen.

| | |
|---|---|
| **Netzwerk** | Tron (TRC20) · USDT |
| **Adresse** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>Adresse vor dem Senden prüfen. On-Chain-Überweisungen sind unwiderruflich. Spenden sind freiwillig und stellen keinen Kauf von Leistungen dar.</sub>

---