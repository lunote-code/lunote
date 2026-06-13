<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>Apri la cartella Markdown—scrivi, collega ed esplora un grafo. Strumenti integrati e plugin tema opzionali.</strong><br />
  <em>Gratuito, open source, offline. Ogni nota resta un file <code>.md</code> sul disco.</em><br />
  <em>Le note restano sul computer. Nessun account, nessun upload—sincronizza la cartella tu (Git, Syncthing, iCloud, ecc.).</em>
</p>

<p align="center">
  Disponibile per <strong>macOS</strong>, <strong>Windows</strong> e <strong>Linux</strong>.
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
</p>

<h3 align="center">
  <a href="#preview">Screenshot</a> &nbsp;|&nbsp;
  <a href="#overview">Panoramica</a> &nbsp;|&nbsp;
  <a href="#capabilities">Funzioni</a> &nbsp;|&nbsp;
  <a href="#download">Download</a> &nbsp;|&nbsp;
  <a href="#development">Sviluppo</a> &nbsp;|&nbsp;
  <a href="#contribution">Contribuire</a>
</h3>

<p align="center">
  <strong>Docs:</strong> <a href="README.md">All languages</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>Traduzioni:</strong>
  <a href="../README.md">🇬🇧</a>
  <a href="README.zh-CN.md">🇨🇳</a>
  <a href="README.zh-TW.md">🇹🇼</a>
  <a href="README.ja.md">🇯🇵</a>
  <a href="README.ko.md">🇰🇷</a>
  <a href="README.de.md">🇩🇪</a>
  <a href="README.fr.md">🇫🇷</a>
  <a href="README.es.md">🇪🇸</a>
  <a href="README.pt.md">🇵🇹</a>
  <a href="README.ru.md">🇷🇺</a>
</p>

<p align="center">
  <strong>Guida (inglese):</strong> <a href="guide/themes.md">Temi</a> · <a href="guide/shortcuts-and-menus.md">Scorciatoie & comandi <code>/</code></a> · <a href="guide/README.md">Indice</a>
</p>

<p align="center">
  <strong>Scrittura stile Typora + collegamenti stile Obsidian — integrato, con catalogo plugin tema.</strong>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">Screenshot</a> · <a href="#overview">Panoramica</a> · <a href="#capabilities">Funzioni</a> · <a href="#download">Download</a> · <a href="#quick-start">Avvio rapido</a> · <a href="#user-guide">Guida</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — demo: scrittura, wiki link, grafo, temi, plugin" width="720" />
  </a>
</p>
<p align="center"><sub>Scrivere · `[[wiki link]]` · backlink · grafo · export · temi · plugin</sub></p>

---

<a id="preview"></a>

## Screenshot

<p align="center">
  <img src="assets/screenshots/language/it.png" alt="Lunote — primo avvio" width="720" />
</p>

| Editor di codice | Vista sorgente | Grafo della conoscenza |
| :---: | :---: | :---: |
| <img src="assets/screenshots/code-view.png" alt="Editor di codice" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="Vista sorgente" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/graph.png" alt="Grafo della conoscenza" width="240" style="max-width: 100%; height: auto;" /> |

| Ricerca globale | Snapshot cronologia | Impostazioni tema |
| :---: | :---: | :---: |
| <img src="assets/screenshots/search.png" alt="Ricerca globale" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/snipaste.png" alt="Snapshot cronologia" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="Impostazioni tema" width="240" style="max-width: 100%; height: auto;" /> |

---

<!-- readme-body-start -->
<a id="overview"></a>

## Panoramica

Apri una cartella di **file `.md`** e scrivi. Lunote aggiunge `[[wiki link]]`, backlink e grafo—**senza account; pack temi opzionali in Preferenze → Plugin**.

- Apri una **cartella `.md`**
- **Visuale e sorgente** con una scorciatoia
- **Wiki link**, backlink, grafo, outline e ricerca integrati
- **Preferenze → Plugin**: sfoglia pack temi (CSS, snippet, token) dal catalogo [lunote-theme](https://github.com/lunote-code/lunote-theme)

| | |
|---|---|
| **Piattaforme** | macOS, Windows, Linux |
| **Lingue dell'interfaccia** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG · print |

---

<a id="capabilities"></a>

## Funzioni

Scegli il tuo flusso—tutto quanto segue è nell'app:

### Scrivere

*Saggi, documenti e note quotidiane—testo formattato o Markdown grezzo.*

- Editor visuale e **sorgente Markdown**; `Cmd+/` / `Ctrl+/`
- Menu **`/`** per blocchi, tabelle, Mermaid, wiki link
- Tabelle, formule, immagini, **focus**, palette comandi
- **Blocchi di codice** con numeri di riga, evidenziazione, lingua, piega e copia
- **Barra di formattazione** (callout, colori, ecc.); nascondi in **File → Preferenze → Tipografia**
- **Larghezza colonna**, font e dimensione in **Preferenze → Tipografia**

### Collegare

*Secondo cervello: `[[collegamenti]]`, backlink e grafo—integrati.*

- `[[wiki link]]` con autocompletamento
- **Pannello conoscenza**: backlink, grafo locale, embed, tag e **frontmatter YAML**
- Rinomina aggiorna i `[[link]]`

### Organizzare

*Quando il vault cresce: schede, outline e ricerca in ogni nota.*

- Albero file, schede, **ricerca globale**
- **Outline** e modifiche esterne
- Salvataggio, conflitti, mostra nel file manager

### Export e aspetto

*Condividi o stampa: PDF, Word, HTML—più temi e pack opzionali.*

- **PDF, HTML, DOCX, PNG** e **stampa**
- Temi, cartella **Theme**, CSS esterno
- Preset **larghezza colonna** (Stretta / Standard / Larga) per modalità visuale e anteprima
- **Preferenze → Plugin**: installa pack dal catalogo [lunote-theme](https://github.com/lunote-code/lunote-theme)

### Cronologia

*Modifica con sicurezza—gli snapshot mostrano l'anteprima prima di salvare su disco.*

- **Snapshot**; ripristino senza sovrascrivere fino al salvataggio

<!-- readme-body-end -->

---

<a id="download"></a>

## Download

**[Scarica ultima versione →](https://github.com/lunote-code/lunote/releases)**

Nessuna registrazione · solo `.md` locali · offline

<details>
<summary><strong>Primo avvio macOS (Gatekeeper)</strong></summary>

1. Sposta **Lunote** in **Applicazioni**
2. **Tasto destro → Apri → Apri**
3. Se serve: `xattr -cr /Applications/Lunote.app`

</details>

| Platform | Package |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) |

---

<a id="quick-start"></a>

## Avvio rapido

1. Installa Lunote da **[Download](#download)**.
2. **Apri il vault esistente**—Obsidian, Logseq, Typora o qualsiasi cartella `.md`. Nessuna importazione.
3. Scrivi, digita `[[` per collegare, `Cmd+Shift+F` / `Ctrl+Shift+F` per cercare, esporta in PDF o Word quando serve.

> **Migrazione?** I file restano dove sono. Altri strumenti possono usare lo stesso Markdown.

---

<a id="why-lunote"></a>

## Perché Lunote

- **I tuoi file**: `.md` normali nelle cartelle che controlli.
- **Un'app sola**: scrittura comoda, wiki link e grafo integrati—pack opzionali.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Confronto

Usi Typora o Obsidian? Lunote è per chi vuole **scrittura comoda e wiki link in un'app desktop**, con catalogo temi opzionale.

| | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Scrittura** | Eccellente | Buona | Eccellente, integrata |
| **Wiki link e grafo** | Limitato | Forte (spesso plugin) | Forte, integrato |
| **Plugin per iniziare** | Pochi | Molti | **Opzionali** (catalogo) |

<a id="user-guide"></a>

## Guida (inglese)

Guide pratiche in inglese (temi, scorciatoie ed elenco completo dei comandi **`/`**):

- [Temi](guide/themes.md) — temi integrati, cartella Theme, CSS esterno, snippet, stili export, catalogo **Preferenze → Plugin**
- [Scorciatoie e menu rapidi](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Differenze tra piattaforme](guide/platform-differences.md) — PDF, stampa, mostra nel file manager e risoluzione problemi per OS
- [Indice guida](guide/README.md) — all guide pages

---

<a id="development"></a>

## Sviluppo

Compilare Lunote da soli:

- **Prerequisiti:** Node.js, Rust e tooling [Tauri](https://tauri.app/)
- **Dev:** `npm install` poi `npm run tauri:dev`
- **Build:** `npm run tauri:bundle` (o `tauri:bundle:dmg` / `msi` / `deb`)
- **Documentazione:** [Indice documentazione](README.md) · [Packaging](packaging-strategy.md) · [Script](../scripts/README.md)

Domande? [Apri un issue](https://github.com/lunote-code/lunote/issues). PR benvenute.

---

<a id="contribution"></a>

## Contribuire

Prima di una pull request:

- Leggere [Script e manutenzione](../scripts/README.md) (locale e release)
- Eseguire `npm run lint` e i test pertinenti per editor o export
- Allineare i testi nei [README localizzati](README.md)

Idee: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="development"></a>

## Sviluppo

Compilare Lunote da soli:

- **Prerequisiti:** Node.js, Rust e tooling [Tauri](https://tauri.app/)
- **Dev:** `npm install` poi `npm run tauri:dev`
- **Build:** `npm run tauri:bundle` (o `tauri:bundle:dmg` / `msi` / `deb`)
- **Documentazione:** [Indice documentazione](README.md) · [Packaging](packaging-strategy.md) · [Script](../scripts/README.md)

Domande? [Apri un issue](https://github.com/lunote-code/lunote/issues). PR benvenute.

---

<a id="contribution"></a>

## Contribuire

Prima di una pull request:

- Leggere [Script e manutenzione](../scripts/README.md) (locale e release)
- Eseguire `npm run lint` e i test pertinenti per editor o export
- Allineare i testi nei [README localizzati](README.md)

Idee: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="development"></a>

## Sviluppo

Compilare Lunote da soli:

- **Prerequisiti:** Node.js, Rust e tooling [Tauri](https://tauri.app/)
- **Dev:** `npm install` poi `npm run tauri:dev`
- **Build:** `npm run tauri:bundle` (o `tauri:bundle:dmg` / `msi` / `deb`)
- **Documentazione:** [Indice documentazione](README.md) · [Packaging](packaging-strategy.md) · [Script](../scripts/README.md)

Domande? [Apri un issue](https://github.com/lunote-code/lunote/issues). PR benvenute.

---

<a id="contribution"></a>

## Contribuire

Prima di una pull request:

- Leggere [Script e manutenzione](../scripts/README.md) (locale e release)
- Eseguire `npm run lint` e i test pertinenti per editor o export
- Allineare i testi nei [README localizzati](README.md)

Idee: [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## FAQ

**Serve account o Internet?**  
No. Funziona offline; note locali salvo sincronizzazione della cartella.

**Aprire cartella Obsidian o Typora?**  
Sì. Apri la cartella come workspace—stessi file `.md`.

**Usare insieme a Obsidian?**  
Sì. Stessa cartella per entrambi. Lunote non blocca i dati.

**Sostituisce Obsidian o Notion?**  
Non sempre. Focus: scrittura desktop + collegamenti integrati.

**Bug o idee?**  
[Apri issue](https://github.com/lunote-code/lunote/issues) o [discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Licenza

Software open source. Termini nel file di licenza del repository.

---
