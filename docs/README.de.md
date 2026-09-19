<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>Mit KI ein vernetztes Wissenssystem aufbauen.</strong><br />
  <em>Lunote verbindet Markdown-Notizen, Wiki-Links, Wissensgraph-Visualisierung und KI-gestützte Wissensentdeckung — für effektiveres Denken, Lernen und Gestalten.</em><br />
  <em>Verstreute Notizen werden zu verbundenem Wissen — local-first, optionale AES-256-Workspace-Verschlüsselung und vollständig unter Ihrer Kontrolle.</em>
</p>

<p align="center">
  Verfügbar für <strong>macOS</strong>, <strong>Windows</strong> und <strong>Linux</strong>.
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
  <a href="#key-features"><img src="https://img.shields.io/badge/workspace%20encryption-AES--256--GCM-green" alt="AES-256 workspace encryption" /></a>
</p>

<h3 align="center">
  <a href="#preview">Screenshots</a> &nbsp;|&nbsp;
  <a href="#why-lunote">Warum Lunote</a> &nbsp;|&nbsp;
  <a href="#key-features">Funktionen</a> &nbsp;|&nbsp;
  <a href="#getting-started">Schnellstart</a> &nbsp;|&nbsp;
  <a href="#download">Download</a> &nbsp;|&nbsp;
  <a href="#contributing">Mitwirken</a>
</h3>

<p align="center">
  <strong>Dokumentation:</strong> <a href="README.md">Alle Sprachen</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>Übersetzungen:</strong>
  <a href="../README.md">🇬🇧</a>
  <a href="README.zh-CN.md">🇨🇳</a>
  <a href="README.zh-TW.md">🇹🇼</a>
  <a href="README.ja.md">🇯🇵</a>
  <a href="README.ko.md">🇰🇷</a>
  <a href="README.fr.md">🇫🇷</a>
  <a href="README.es.md">🇪🇸</a>
  <a href="README.pt.md">🇵🇹</a>
  <a href="README.it.md">🇮🇹</a>
  <a href="README.ru.md">🇷🇺</a>
</p>

<p align="center">
  <strong>Anleitung:</strong> <a href="guide/themes.md">Themes</a> · <a href="guide/shortcuts-and-menus.md">Shortcuts &amp; /-Befehle</a> · <a href="guide/README.md">Alle Anleitungen</a>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">Screenshots</a> · <a href="#why-lunote">Warum</a> · <a href="#key-features">Funktionen</a> · <a href="#compare">Vergleich</a> · <a href="#download">Download</a> · <a href="#getting-started">Schnellstart</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <img src="assets/demo/lunote-demo.gif" alt="Lunote — Demo: vernetztes Wissen, Wiki-Links, KI, Wissensgraph" width="720" />
</p>
<p align="center"><sub>Vernetztes Wissen · `[[Wiki-Links]]` · KI-Entdeckung · Graph · local-first · optionale Verschlüsselung</sub></p>

---

Lunote ist ein **KI-nativer Wissensmanagement-Workspace** — eine persönliche Wissensbasis, in der Ideen sich verbinden, wachsen und für KI wirklich verständlich werden. Öffnen Sie einen `.md`-Ordner und bauen Sie ein System — nicht nur einen Notizenstapel.

| | |
|---|---|
| **Platforms** | macOS, Windows, Linux |
| **UI languages** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG · print |
| **Security** | Optional workspace encryption (AES-256-GCM) · passwords never saved on disk |

Versionshinweise in [CHANGELOG.md](../CHANGELOG.md). **v1.0.4**: Workspace öffnet nicht mehr hängend am Lade-Overlay; der visuelle Editor bleibt bei TipTap 3.23.1 (3.30/3.31 störte die Bearbeitung).

---

<a id="why-lunote"></a>

## Warum Lunote

Die meisten Notiz-Apps helfen beim **Erfassen** von Informationen. Wenige helfen beim **Aufbau von Wissen**.

- **Gewöhnliche Notizen werden zu Silos** — Ideen stapeln sich in Ordnern, Beziehungen bleiben unsichtbar.
- **Verbindungen lassen Wissen wachsen** — Wiki-Links, Backlinks und verwandte Notizen werden zu einem navigierbaren Netzwerk.
- **KI sollte Ihre gesamte Wissensbasis verstehen** — nicht nur das geöffnete Dokument. Mit Workspace-Kontext, verlinkten Notizen und Suche kann KI synthetisieren, Links vorschlagen und Lücken aufdecken.
- **Ihre Notizen können im Ruhezustand verschlüsselt bleiben** — optionale AES-256-GCM Workspace-Verschlüsselung schützt Markdown auf der Festplatte; Passwort pro Sitzung; Passwörter werden nie gespeichert.

Lunote ist dafür gebaut: eine **local-first persönliche Wissensbasis** mit optionaler **Workspace-Verschlüsselung**, in der vernetztes Denken und KI-Verständnis zusammenwirken — ohne Cloud-Lock-in, Konten oder Plugin-Dschungel.
---

<a id="key-features"></a>

## Hauptfunktionen

<!-- readme-body-start -->

### KI-gestützte Wissensbasis

KI, die Ihre Notizen versteht und mit ihnen arbeitet — kein separates Chat-Fenster.

- **Workspace-bewusste Gespräche** — Kontext aus aktueller Notiz, Auswahl, `@`-Erwähnungen, verlinkten Nachbarn und Workspace-Suche
- **KI-Suche** — relevante Snippets aus Ihrem Vault abrufen
- **Zusammenfassungen & Synthese** — Notizen, Auswahl oder Themen verdichten
- **Schreibhilfe** — fortsetzen, umschreiben, übersetzen und strukturieren in Lunote Markdown
- **Wissenssynthese** — Analyse über Notizen hinweg, Workspace-Überblicke, Themen-Insights

Eigenen API-Schlüssel in **Einstellungen → KI** hinterlegen (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama u. a.).

### Vernetztes Wissen

Beziehungen zwischen Ideen aufbauen — Grundlage eines lebendigen Wissenssystems.

- **Wiki-Links** — `[[Notizen verlinken]]` beim Schreiben; Umbenennen aktualisiert Links im Vault
- **Backlinks** — sehen, was auf die aktuelle Notiz verweist
- **Verwandte Notizen** — Fäden verfolgen ohne Kontextverlust
- **Bidirektionale Verknüpfung** — automatisch in beide Richtungen

### Wissensentdeckung

Verwandte Ideen, Muster und verborgene Zusammenhänge im Workspace finden.

- **Link-Vorschläge** — KI schlägt `[[Wiki-Links]]` basierend auf vorhandenen Notizen vor
- **Beziehungsentdeckung** — wie Themen clustern und zusammenhängen
- **Themen-Exploration** — was Sie wissen, was fehlt, was als Nächstes kommt
- **Fehlende Verbindungen** — Lücken, Waisen und unterverlinkte Ideen erkennen

### Wissensgraph-Visualisierung

Der Graph ist eine **Ansicht Ihres Wissensnetzwerks** — wie Ideen um Ihren aktuellen Fokus herum verbunden sind.

- **Lokaler Subgraph** um die geöffnete Notiz — Tiefe und Filter wählbar
- **Navigation per Verbindung** — zwischen verlinkten Notizen springen
- **Wissen wachsen sehen** — Cluster bilden sich beim Verlinken

> Standard ist ein **lokaler Subgraph** um die aktive Notiz. **Global** oder Vollbild zeigen einen workspace-weiten Link-Graph. Leistungsgrenzen: **erweitert** (Standard) 400 Knoten / 700 Kanten, **standard** 250 / 400, **kompakt** 120 / 200 — kein unbegrenzter Vault-Graph wie bei Obsidian.

### Markdown-nativ

Zukunftssichere Notizen in offenem, portablem Format.

- **Markdown zuerst** — visuell oder Quelltext; Fokusmodus für Tiefe
- **Offenes Format** — plain `.md` auf der Festplatte; keine proprietäre Datenbank
- **Portable Notizen** — denselben Ordner in Obsidian, Typora oder jedem Markdown-Tool öffnen
- **Reicher Inhalt** — Codeblöcke, Tabellen, Mathe, Mermaid, Callouts; Export nach PDF, Word, HTML, PNG

### Workspace-Verschlüsselung

Schützen Sie sensible Notizen im Ruhezustand — eingebaut, kein Plugin nötig.

- **AES-256-GCM** — Markdown-Notiztexte verschlüsselt auf der Festplatte
- **Passwort pro Sitzung** — beim Öffnen des Workspace entsperren; nie auf der Festplatte gespeichert
- **Optional pro Workspace** — unter **Einstellungen → Sicherheit** aktivieren
- **Bilder optional** — Anhänge bleiben standardmäßig Klartext; **Bilder verschlüsseln** schützt gängige Bilddateien (PNG, JPEG, WebP, GIF, HEIC, SVG usw.)
- **Auto-Sperre im Leerlauf** — nach Inaktivität (Standard 5 Minuten) speichern, dann den entsperrten verschlüsselten Workspace sperren; restliche ungespeicherte Änderungen überspringen die Sperre

### Local First

Ihr Wissen bleibt unter Ihrer Kontrolle.

- **Sie besitzen die Daten** — Notizen in einem Workspace-Ordner auf Ihrem Rechner
- **Workspace-basiert** — beliebigen Vault öffnen; Sync mit Git, Syncthing oder iCloud nach Ihren Regeln
- **Datenschutzfreundlich** — offline-first, kein Konto; KI nur nach Ihrer Konfiguration
- **Verschlüsselung bei Bedarf** — siehe **Workspace-Verschlüsselung** oben; Passwörter werden nie gespeichert
- **Leichtgewichtig** — Kern-Werkzeuge eingebaut; [Theme-Packs](https://github.com/lunote-code/lunote-theme) optional

### Produktivitäts-Basics

- Tabs, Gliederung, Command Palette (`Cmd+Shift+P`), Snapshots pro Notiz
- Globale Suche (`Cmd+Shift+F` / `Ctrl+Shift+F`), `/`-Menü
- Hell/Dunkel und optionale Packs unter **Einstellungen → Plugins**

<!-- readme-body-end -->

---

<a id="preview"></a>

## Screenshots

<p align="center">
  <img src="assets/screenshots/ai+code-view.png" alt="KI + Code-Ansicht — workspace-bewusstes Schreiben" width="720" />
</p>
<p align="center"><sub>KI + Code-Ansicht — workspace-bewusstes Schreiben</sub></p>

<p align="center">
  <img src="assets/screenshots/graph.png" alt="Wissensgraph — verbundene Ideen erkunden" width="720" />
</p>
<p align="center"><sub>Wissensgraph — verbundene Ideen erkunden</sub></p>

### Mehr

| KI-Assistent | Code-Editor | Quelltext-Ansicht |
| :---: | :---: | :---: |
| <img src="assets/screenshots/AI.png" alt="KI-Assistent" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/code-view.png" alt="Code-Editor" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="Quelltext-Ansicht" width="240" style="max-width: 100%; height: auto;" /> |

| Mermaid-Diagramme | Globale Suche | Theme-Einstellungen |
| :---: | :---: | :---: |
| <img src="assets/screenshots/mermaid.png" alt="Mermaid-Diagramme" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="Globale Suche" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="Theme-Einstellungen" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="getting-started"></a>

## Schnellstart

1. **[Download](#download)** — Lunote für macOS, Windows oder Linux installieren.
2. **Workspace öffnen** — Obsidian-Vault, Notion-Export, Typora-Ordner oder beliebigen `.md`-Ordner. Kein Import.
3. **Verbindungen aufbauen** — `[[` zum Verlinken; Backlinks und Wissensgraph um die aktuelle Notiz prüfen.
4. **KI aktivieren** — API-Schlüssel unter **Einstellungen → KI** hinterlegen, dann Notiz oder ganzen Workspace befragen.
5. **Entdecken & wachsen** — KI-Link-Vorschläge, Workspace-Überblicke und Suche für Muster und Lücken nutzen.
6. **Optional: Workspace verschlüsseln** — unter **Einstellungen → Sicherheit** Workspace-Verschlüsselung aktivieren, um Markdown-Notizen ruhend zu schützen. Passwort beim Öffnen eingeben. Optional **Bilder verschlüsseln** und Auto-Sperre im Leerlauf.

> **Tool-Wechsel?** Ihre Dateien bleiben am Ort. Jedes Markdown-Tool kann denselben Ordner lesen.

---

<a id="download"></a>

## Download

**[Neueste Version herunterladen →](https://github.com/lunote-code/lunote/releases)**

Keine Anmeldung · lokale `.md`-Dateien · offline nutzbar · **optionale Workspace-Verschlüsselung**

<details>
<summary><strong>macOS Erststart (Gatekeeper)</strong></summary>

1. **Lunote** nach **Programme** verschieben
2. **Rechtsklick → Öffnen → Öffnen**
3. Falls nötig: `xattr -cr /Applications/Lunote.app`

</details>

| Plattform | Paket |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) |

---

<a id="compare"></a>

## Lunote vs Notion vs Obsidian

| | Notion | Obsidian | Lunote |
|---|---|---|---|
| **Ihre Daten** | Cloud-Konto | Lokale `.md` | Lokale `.md` |
| **Wissensmodell** | Seiten im Workspace | Vault + Plugins | Vernetzter Workspace, eingebaut |
| **KI** | Cloud-KI auf deren Daten | Plugin-abhängig | Workspace-bewusste KI (Ihr API-Schlüssel) |
| **Wiki-Links & Graph** | Basis | Vault-weiter Graph (oft Plugin) | **Lokaler Subgraph** + Entdeckung, eingebaut |
| **Zeit bis zur ersten Notiz** | Anmelden, dann schreiben | Plugins einrichten (optional) | Ordner öffnen → Ideen verbinden |
| **Workspace-Verschlüsselung** | Nein | Plugin / OS-Ebene | **Eingebaut** (AES-256-GCM, optional) |
| **Offline & Datenschutz** | Teilweise | Voll offline | Voll offline, kein Konto |

---

<a id="use-cases"></a>

## Anwendungsfälle

- **Persönliche Wissensbasis** — Second Brain mit Wiki-Links, Backlinks und KI-Synthese
- **Forschung & Lernen** — Lesungen, Zusammenfassungen und Erkenntnisse über Themen verbinden
- **Entwickler-Dokumentation** — ADRs, Runbooks und Snippets mit Codeblöcken und PDF-Export
- **Wechsel von Notion oder Obsidian** — dieselben Markdown-Ordner, weniger Aufwand, kein Upload
- **Sensible Notizen & Tagebücher** — optionale Workspace-Verschlüsselung schützt Markdown-Texte im Ruhezustand
- **Team-Async-Docs** — Workspace per Git teilen; alle behalten plain `.md`-Dateien

---

<a id="roadmap"></a>

## Roadmap

Lunote entwickelt sich zu einem tieferen **KI-nativen Wissensmanagement**. Richtung:

- Reichere **Wissensentdeckung** — intelligentere Link-Vorschläge, Themenkarten und Lückenerkennung
- Tieferes **KI-Workspace-Verständnis** — besserer Kontext, Synthese und reasoning über Notizen
- Erweiterte **Graph-Visualisierung** — mehr Wege, Wissensverbindungen zu erkunden
- Fortgesetzte **Local-first**-Politur — Performance, Export und plattformübergreifende Zuverlässigkeit

Fortschritt und Ideen in [GitHub Discussions](https://github.com/lunote-code/lunote/discussions) und [Issues](https://github.com/lunote-code/lunote/issues).

---

<a id="star"></a>

## Lunote auf GitHub mit Stern versehen

Hilft Ihnen Lunote beim Aufbau vernetzten Wissens, **[vergeben Sie dem Repository einen Stern](https://github.com/lunote-code/lunote)** — so entdecken andere eine KI-gestützte persönliche Wissensbasis. Geschichten und Ideen in [Discussions](https://github.com/lunote-code/lunote/discussions).

---

<a id="user-guide"></a>

## Benutzerhandbuch (Englisch)

Englische Anleitungen (Themes, Shortcuts und vollständige **`/`**-Befehlsliste):

- [Themes](guide/themes.md) — eingebaute Themes, Theme-Ordner, externes CSS, Snippets, Export-Stile, **Einstellungen → Plugins**
- [Shortcuts & Schnellmenüs](guide/shortcuts-and-menus.md) — Command Palette, Tastenkürzel, vollständige **`/`**-Befehlsliste
- [Workspace-Verschlüsselung](guide/workspace-encryption.md) — AES-256-GCM, optionale Bildverschlüsselung, Auto-Sperre
- [Wissensgraph](guide/knowledge-graph.md) — lokaler Subgraph, Global / Vollbild, Leistungsgrenzen
- [Plattformunterschiede](guide/platform-differences.md) — PDF, Druck, Anzeigen im Dateimanager, OS-spezifische Hinweise
- [Handbuch-Index](guide/README.md) — alle Anleitungsseiten

---

<a id="development"></a>

## Entwicklung

Lunote selbst bauen:

- **Voraussetzungen:** Node.js, Rust und [Tauri](https://tauri.app/)-Plattform-Tools
- **Dev:** `npm install`, dann `npm run tauri:dev`
- **Bundle:** `npm run tauri:bundle` (oder `tauri:bundle:dmg` / `msi` / `deb`)
- **Docs:** [Dokumentationsindex](README.md) · [Packaging](packaging-strategy.md) · [Skripte](../scripts/README.md)

Fragen? [Issue eröffnen](https://github.com/lunote-code/lunote/issues). Pull Requests willkommen.

---

<a id="contributing"></a>

## Mitwirken

Vor einem Pull Request:

- [Skripte & Wartung](../scripts/README.md) für Locale- und Release-Tooling lesen
- `npm run lint` und relevante Tests bei Editor- oder Export-Änderungen ausführen
- Botschaften über [lokalisierte READMEs](README.md) konsistent halten

Ideen und Migrationsgeschichten: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## FAQ

**Brauche ich ein Konto oder Internet?**  
Nein. Lunote ist offline-first. Notizen bleiben lokal, bis Sie den Ordner selbst synchronisieren. KI-Funktionen benötigen Ihren API-Schlüssel und Netzwerk bei Nutzung.

**Ist Lunote eine KI-Notiz-App oder ein Markdown-Editor?**  
Lunote ist eine **persönliche Wissensbasis** — Markdown speichert Ihre Notizen, KI macht den Workspace verständlich und auffindbar. Der Editor dient dem Wissenssystem, nicht umgekehrt.

**Kann ich meinen Obsidian-Vault öffnen?**  
Ja. Lunote auf denselben Ordner zeigen. Kein Migrationsschritt.

**Ersetzt es Obsidian oder Notion vollständig?**  
Nicht immer. Lunote fokussiert auf vernetztes Wissen, workspace-bewusste KI und local-first Desktop-Workflows. Kombinieren Sie bei Bedarf mit Mobile oder Spezial-Plugins.

**Vault-weiter Graph wie Obsidian Graph View?**  
Teilweise. Lunote zeigt standardmäßig einen **lokalen Subgraphen** um die geöffnete Notiz. Im Knowledge-Bereich können Sie auf **Global** oder Vollbild wechseln — verknüpfte Notizen im Workspace, begrenzt durch Leistungsstufen (Standard **erweitert**: 400 Knoten / 700 Kanten; **standard**: 250 / 400; **kompakt**: 120 / 200). Kein unbegrenzter Vault-Graph wie bei Obsidian.

**Wie nutzt KI meine Notizen?**  
KI-Kontext umfasst aktuelle Notiz, Auswahl, `@`-Erwähnungen, verlinkte Nachbarn und Such-Snippets — nur was Sie in einer Unterhaltung senden. Anbieter unter **Einstellungen → KI** konfigurieren.

**Kann ich meinen Workspace verschlüsseln?**  
Ja. Unter **Einstellungen → Sicherheit** können Sie optional die **Workspace-Verschlüsselung** aktivieren. Markdown-Notizen werden verschlüsselt gespeichert; Passwort beim Öffnen eingeben. Bilder bleiben Klartext, bis Sie **Bilder verschlüsseln** einschalten. Die **Auto-Sperre** kann eine entsperrte Sitzung nach Inaktivität sperren. Passwörter bleiben nur im Speicher — bei Verlust sind verschlüsselte Notizen nicht wiederherstellbar.

**Gibt es Plugins?**  
Nur für Themes — optionale Packs unter **Einstellungen → Plugins** von [lunote-theme](https://github.com/lunote-code/lunote-theme). Wiki-Links, Wissensgraph, KI und Export ohne Installation.

**Feedback?**  
[Issue eröffnen](https://github.com/lunote-code/lunote/issues) oder [Discussion starten](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Lizenz

Open-Source-Software. Bedingungen siehe Lizenzdatei im Repository.

---
