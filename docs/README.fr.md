<div align="center">

# Lunote

**Un espace de travail Markdown local-first pour écrire, relier ses idées et construire une base de connaissances personnelle**

**Écriture façon Typora + liens façon Obsidian — intégré, sans plugins.**
*Écrivez dans un éditeur soigné, reliez vos idées avec des liens wiki et conservez chaque note comme fichier `.md` local. Gratuit, open source et pensé pour le travail hors ligne.*

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**Documentation :** [Toutes les langues](README.md) · [English](README.en.md)

**Guide (anglais) :** [Thèmes](guide/themes.md) · [Raccourcis & commandes `/`](guide/shortcuts-and-menus.md) · [Index](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[Aperçu](#preview) · [Pourquoi Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [Téléchargement](#download) · [Démarrage rapide](#quick-start) · [Guide](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — démo 10 s : écriture, liens wiki, graphe et thèmes" width="720" />
  </a>
</p>
<p align="center"><sub>Visite 10 s · Markdown local · liens wiki · graphe · thèmes · sans plugins</sub></p>

</div>

---

## Qu’est-ce que Lunote ?

Lunote est un espace de travail Markdown de bureau pour les personnes qui veulent réunir trois choses :

- **Des fichiers Markdown locaux et simples**
- **Une vraie expérience d’écriture**
- **Des workflows de connaissances intégrés**

Vous pouvez ouvrir n’importe quel dossier comme espace de travail et continuer à utiliser des fichiers `.md` classiques que vous possédez. Écrivez en mode visuel quand vous voulez rester fluide, passez au mode source Markdown quand vous voulez plus de contrôle, et utilisez liens wiki, backlinks, graphe et recherche sans dépendre de plugins.

| | |
|---|---|
| **Plateformes** | macOS, Windows, Linux |
| **Langues de l’interface** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG |
| **Technologie** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## Aperçu


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Espace principal Lunote" width="720" />
</p>

| Éditeur visuel | Graphe de connaissances | Thème |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="Éditeur visuel" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="Graphe de connaissances" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="Thèmes" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Pourquoi Lunote

- **Local-first** : vos notes restent des fichiers Markdown normaux dans vos propres dossiers.
- **Editor-first** : l’édition visuelle et la source Markdown sont toutes deux de première classe.
- **Prêt pour la connaissance** : liens wiki, backlinks, graphe, plan et recherche sont intégrés.
- **Pratique** : exportez si besoin, synchronisez avec vos outils et travaillez hors ligne.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| Point de comparaison | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Idéal pour** | Une écriture claire en document unique | Un PKM riche en plugins et en personnalisation | L’écriture + les connaissances liées dans une seule app |
| **Style d’édition** | Éditeur Markdown minimaliste | Plateforme Markdown extensible | Édition visuelle + source Markdown |
| **Fonctions de connaissance** | Limitées | Fortes, souvent pilotées par plugins | Liens wiki, backlinks, graphe et recherche intégrés |
| **Complexité de mise en place** | Faible | Moyenne à élevée | Faible à moyenne |
| **Dépendance aux plugins** | Faible | Élevée | Faible |
| **Choisissez-le si...** | Vous voulez surtout une app d’écriture | Vous voulez surtout un écosystème | Vous voulez équilibrer écriture et workflows de connaissances |

---

<a id="download"></a>

## Téléchargement

**[Dernière version →](https://github.com/lunote-code/lunote/releases)**

Le GitHub release workflow publie actuellement ces paquets :

| Plateforme | Paquet | Référence workflow |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

Premier lancement sur macOS :

1. Déplacez **Lunote** dans **Applications**
2. **Clic droit → Open → Open**
3. Si nécessaire, exécutez `xattr -cr /Applications/Lunote.app`

---

<a id="quick-start"></a>

## Démarrage rapide

1. Installez Lunote pour votre plateforme.
2. Ouvrez un dossier contenant des notes Markdown, ou créez un nouvel espace de travail.
3. Écrivez, liez vos notes avec `[[`, recherchez avec `Ctrl+Shift+F` / `Cmd+Shift+F`, puis exportez si nécessaire.

Si vous avez déjà une bibliothèque Markdown venant d’Obsidian, Logseq ou Typora, ouvrez simplement le dossier. Aucun import n’est nécessaire.

---

<a id="user-guide"></a>

## Guide (anglais)

Guides pratiques en anglais (thèmes, raccourcis et liste complète des commandes **`/`**) :

- [Thèmes](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [Raccourcis & menus rapides](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Index du guide](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**Ai-je besoin d’un compte ou d’internet ?**  
Non. Lunote fonctionne hors ligne et garde vos notes en local sauf si vous les synchronisez vous-même.

**Puis-je utiliser une bibliothèque Markdown existante ?**  
Oui. Ouvrez simplement un dossier contenant des fichiers `.md` / `.markdown`.

**Est-ce compatible avec d’autres outils ?**  
Oui. Lunote utilise du Markdown standard, donc le même dossier peut continuer à être utilisé avec Obsidian, VS Code, Typora ou Git.

**Remplace-t-il complètement Obsidian ou Notion ?**  
Lunote se concentre sur le Markdown local, une forte expérience d’édition et les liens intégrés. Si vous avez besoin d’une app mobile ou d’un grand écosystème de plugins, vous pouvez le combiner avec d’autres outils.

**Comment signaler un bug ou demander une fonctionnalité ?**  
[Ouvrez une issue](https://github.com/lunote-code/lunote/issues) ou lancez une [discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Licence

Logiciel open source. Consultez le fichier de licence du dépôt pour les détails.

---

<a id="sponsor"></a>

## Soutenir le projet

Si Lunote vous aide :

- **[Mettez une étoile au dépôt](https://github.com/lunote-code/lunote)** — cela aide d'autres personnes à le découvrir
- **[Partagez vos retours](https://github.com/lunote-code/lunote/discussions)** — idées et cas d'usage comptent autant que le code

Si Lunote vous aide, vous pouvez soutenir volontairement le développement via **USDT TRC20** sur le réseau Tron.

| | |
|---|---|
| **Réseau** | Tron (TRC20) · USDT |
| **Adresse** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>Vérifiez l'adresse avant d'envoyer. Les transferts on-chain sont irréversibles. Le soutien est volontaire et ne constitue pas l'achat d'un service.</sub>

---