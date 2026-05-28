<div align="center">

# Lunote

**Uno workspace Markdown local-first per scrivere, collegare idee e costruire una base di conoscenza personale**

**Scrittura in stile Typora + collegamenti in stile Obsidian — integrato, senza plugin.**
*Scrivi in un editor curato, collega le idee con link wiki e mantieni ogni nota come file `.md` locale. Gratuito, open source e pensato per il lavoro offline.*

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**Documentazione:** [Tutte le lingue](README.md) · [English](README.en.md)

**Guida (inglese):** [Temi](guide/themes.md) · [Scorciatoie & comandi `/`](guide/shortcuts-and-menus.md) · [Indice](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[Anteprima](#preview) · [Perché Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [Download](#download) · [Avvio rapido](#quick-start) · [Guida](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — demo 10 s: scrittura, wiki link, grafo e temi" width="720" />
  </a>
</p>
<p align="center"><sub>Tour 10 s · Markdown locale · wiki link · grafo · temi · senza plugin</sub></p>

</div>

---

## Cos’è Lunote?

Lunote è uno workspace Markdown desktop per chi vuole tre cose insieme:

- **File Markdown locali e semplici**
- **Una forte esperienza di scrittura**
- **Workflow di conoscenza integrati**

Puoi aprire qualsiasi cartella come workspace e continuare a usare normali file `.md` che restano tuoi. Scrivi in modalità visuale quando vuoi fluidità, passa alla modalità sorgente Markdown quando vuoi pieno controllo e usa wiki link, backlink, grafo e ricerca senza dipendere da plugin.

| | |
|---|---|
| **Piattaforme** | macOS, Windows, Linux |
| **Lingue dell’interfaccia** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Esportazione** | PDF, Word (DOCX), HTML, PNG |
| **Tecnologia** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## Anteprima


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Workspace principale di Lunote" width="720" />
</p>

| Editor visuale | Grafo della conoscenza | Tema |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="Editor visuale" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="Grafo della conoscenza" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="Temi" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Perché Lunote

- **Local-first**: le tue note restano normali file Markdown nelle tue cartelle.
- **Editor-first**: editing visuale e sorgente Markdown sono entrambi di primo livello.
- **Pronto per la conoscenza**: wiki link, backlink, grafo, outline e ricerca sono integrati.
- **Pratico**: esporta quando serve, sincronizza con i tuoi strumenti e lavora offline.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| Punto di confronto | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Ideale per** | Scrittura pulita in un singolo documento | PKM ricco di plugin e personalizzazione del vault | Scrittura + conoscenza collegata in una sola app |
| **Stile di editing** | Editor Markdown minimale | Piattaforma Markdown estensibile | Editing visuale + sorgente Markdown |
| **Funzioni di conoscenza** | Limitate | Forti, spesso guidate da plugin | Wiki link, backlink, grafo e ricerca integrati |
| **Complessità di configurazione** | Bassa | Media o alta | Bassa o media |
| **Dipendenza dai plugin** | Bassa | Alta | Bassa |
| **Sceglilo se...** | Vuoi soprattutto un’app di scrittura | Vuoi soprattutto un ecosistema | Vuoi bilanciare scrittura e workflow di conoscenza |

---

<a id="download"></a>

## Download

**[Ultima release →](https://github.com/lunote-code/lunote/releases)**

L’attuale GitHub release workflow pubblica questi pacchetti:

| Piattaforma | Pacchetto | Riferimento workflow |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

Primo avvio su macOS:

1. Sposta **Lunote** in **Applications**
2. **Click destro → Open → Open**
3. Se necessario, esegui `xattr -cr /Applications/Lunote.app`

---

<a id="quick-start"></a>

## Avvio rapido

1. Installa Lunote per la tua piattaforma.
2. Apri una cartella con note Markdown oppure crea un nuovo workspace.
3. Scrivi, collega note con `[[`, cerca con `Ctrl+Shift+F` / `Cmd+Shift+F` ed esporta quando serve.

Se hai già una libreria Markdown di Obsidian, Logseq o Typora, apri semplicemente la cartella. Non serve alcuna importazione.

---

<a id="user-guide"></a>

## Guida (inglese)

Guide pratiche in inglese (temi, scorciatoie ed elenco completo dei comandi **`/`**):

- [Temi](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [Scorciatoie e menu rapidi](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Indice guida](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**Serve un account o Internet?**  
No. Lunote funziona offline e mantiene le note in locale finché non decidi tu di sincronizzarle.

**Posso usare una libreria Markdown esistente?**  
Sì. Basta aprire una cartella con file `.md` / `.markdown`.

**È compatibile con altri strumenti?**  
Sì. Lunote usa Markdown standard, quindi la stessa cartella può continuare a essere usata con Obsidian, VS Code, Typora o Git.

**Sostituisce completamente Obsidian o Notion?**  
Lunote si concentra su Markdown locale, forte esperienza di editing e collegamenti integrati. Se ti servono app mobili o un grande ecosistema di plugin, puoi comunque affiancarlo ad altri strumenti.

**Come segnalo bug o richiedo funzionalità?**  
[Apri una issue](https://github.com/lunote-code/lunote/issues) o avvia una [discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Licenza

Software open source. Consulta il file di licenza del repository per i dettagli.

---

<a id="sponsor"></a>

## Sostieni il progetto

Se Lunote ti è utile:

- **[Metti una stella al repo](https://github.com/lunote-code/lunote)** — aiuta altre persone a scoprirlo
- **[Condividi feedback](https://github.com/lunote-code/lunote/discussions)** — idee e casi d'uso contano quanto il codice

Se Lunote ti è utile, puoi sostenere volontariamente lo sviluppo tramite **USDT TRC20** sulla rete Tron.

| | |
|---|---|
| **Rete** | Tron (TRC20) · USDT |
| **Indirizzo** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>Verifica l'indirizzo prima di inviare. I trasferimenti on-chain sono irreversibili. Il sostegno è volontario e non costituisce l'acquisto di un servizio.</sub>

---