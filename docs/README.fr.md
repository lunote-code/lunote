<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>Ouvrez votre dossier Markdown—écrivez, reliez, explorez un graphe. Sans plugins.</strong><br />
  <em>Gratuit, open source, hors ligne. Chaque note reste un fichier <code>.md</code> sur votre disque.</em><br />
  <em>Les notes restent sur votre ordinateur. Pas de compte, pas d'envoi—synchronisez le dossier vous-même (Git, Syncthing, iCloud, etc.).</em>
</p>

<p align="center">
  Disponible sur <strong>macOS</strong>, <strong>Windows</strong> et <strong>Linux</strong>.
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/stargazers"><img src="https://img.shields.io/github/stars/lunote-code/lunote?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases" alt="latest release" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="platform" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Open%20Source-lightgrey" alt="license" /></a>
</p>

<h3 align="center">
  <a href="#preview">Capture</a> &nbsp;|&nbsp;
  <a href="#overview">Présentation</a> &nbsp;|&nbsp;
  <a href="#capabilities">Fonctionnalités</a> &nbsp;|&nbsp;
  <a href="#download">Télécharger</a> &nbsp;|&nbsp;
  <a href="#development">Développement</a> &nbsp;|&nbsp;
  <a href="#contribution">Contribution</a>
</h3>

<p align="center">
  <strong>Docs:</strong> <a href="README.md">All languages</a> · <a href="../README.md">English</a>
</p>

<p align="center">
  <strong>Traductions :</strong>
  <a href="../README.md">🇬🇧</a>
  <a href="README.zh-CN.md">🇨🇳</a>
  <a href="README.zh-TW.md">🇹🇼</a>
  <a href="README.ja.md">🇯🇵</a>
  <a href="README.ko.md">🇰🇷</a>
  <a href="README.de.md">🇩🇪</a>
  <a href="README.es.md">🇪🇸</a>
  <a href="README.pt.md">🇵🇹</a>
  <a href="README.it.md">🇮🇹</a>
  <a href="README.ru.md">🇷🇺</a>
</p>

<p align="center">
  <strong>Guide (anglais) :</strong> <a href="guide/themes.md">Thèmes</a> · <a href="guide/shortcuts-and-menus.md">Raccourcis & commandes <code>/</code></a> · <a href="guide/README.md">Index</a>
</p>

<p align="center">
  <strong>Écriture façon Typora + liens façon Obsidian — intégré.</strong>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Télécharger-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Télécharger-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Télécharger-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Télécharger-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Télécharger-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Télécharger-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">Capture</a> · <a href="#overview">Présentation</a> · <a href="#capabilities">Fonctionnalités</a> · <a href="#download">Télécharger</a> · <a href="#quick-start">Démarrage rapide</a> · <a href="#user-guide">Guide</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — démo : écriture, liens wiki, graphe, thèmes" width="720" />
  </a>
</p>
<p align="center"><sub>Écriture · `[[liens wiki]]` · backlinks · graphe · export · thèmes</sub></p>

---

<a id="preview"></a>

## Capture

<p align="center">
  <img src="assets/screenshots/language/fr.png" alt="Lunote — premier lancement" width="720" />
</p>

| Éditeur de code | Vue source | Graphe de connaissances |
| :---: | :---: | :---: |
| <img src="assets/screenshots/code-view.png" alt="Éditeur de code" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="Vue source" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/graph.png" alt="Graphe de connaissances" width="240" style="max-width: 100%; height: auto;" /> |

| Recherche globale | Instantanés d'historique | Réglages du thème |
| :---: | :---: | :---: |
| <img src="assets/screenshots/search.png" alt="Recherche globale" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/snipaste.png" alt="Instantanés d'historique" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="Réglages du thème" width="240" style="max-width: 100%; height: auto;" /> |

### Autres aperçus de thèmes

Captures supplémentaires : `assets/screenshots/theme/`. Fichiers CSS, jetons JSON et snippets prêts à l'emploi : **[Exemples de thèmes](theme-example/README.md)**.

| GitHub Light | GitHub Dark | IDEA Light | IDEA Dark | Dim Light |
| :---: | :---: | :---: | :---: | :---: |
| <img src="assets/screenshots/theme/github-light.png" alt="GitHub Light" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/github-dark.png" alt="GitHub Dark" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/idea-light.png" alt="IDEA Light" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/idea-dark.png" alt="IDEA Dark" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/dim-light.png" alt="Dim Light" width="200" style="max-width: 100%; height: auto;" /> |

| Dim Dark | Forest Dawn | Ember Glow | Graphite Noir | Lavender Haze |
| :---: | :---: | :---: | :---: | :---: |
| <img src="assets/screenshots/theme/dim-dark.png" alt="Dim Dark" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/forest-dawn.png" alt="Forest Dawn" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/ember-glow.png" alt="Ember Glow" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/graphite-noir.png" alt="Graphite Noir" width="200" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme/lavender-haze.png" alt="Lavender Haze" width="200" style="max-width: 100%; height: auto;" /> |

---

<!-- readme-body-start -->
<a id="overview"></a>

## Présentation

Ouvrez un dossier de **fichiers `.md`** et écrivez. Lunote ajoute `[[liens wiki]]`, backlinks et graphe—**sans compte ni boutique de plugins**.

- Ouvrir un **dossier `.md`** comme espace de travail
- **Visuel et source** en un raccourci
- **Liens wiki**, backlinks, graphe, plan et recherche intégrés

| | |
|---|---|
| **Plateformes** | macOS, Windows, Linux |
| **Langues de l'interface** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG · print |

---

<a id="capabilities"></a>

## Fonctions

Choisissez votre flux—tout ce qui suit est dans l'app :

### Rédiger

*Essais, docs, notes du jour—texte formaté ou Markdown brut.*

- Éditeur visuel et **source Markdown** ; `Cmd+/` / `Ctrl+/`
- Menu **`/`** : titres, listes, tableaux, Mermaid, liens wiki
- Tableaux, maths, images, **mode focus**, palette de commandes
- **Blocs de code** : numéros de ligne, coloration syntaxique, langue, repli et copie
- **Barre de formatage** (callouts, couleurs, etc.) ; masquable dans **Fichier → Préférences → Typographie**
- **Largeur de colonne**, police et taille dans **Préférences → Typographie**

### Relier

*Second cerveau : `[[liens]]`, backlinks et graphe sans plugins.*

- `[[liens wiki]]` avec autocomplétion
- **Panneau connaissance** : backlinks, graphe local, intégrations, tags et **frontmatter YAML**
- Renommage met à jour les `[[liens]]`

### Organiser

*Quand le coffre grossit : onglets, plan et recherche dans toutes les notes.*

- Arborescence, onglets, **recherche globale**
- **Plan** et détection des changements externes
- Sauvegarde, conflits, révéler dans le gestionnaire

### Export & apparence

*Partager ou imprimer : PDF, Word, HTML—et des thèmes que vous contrôlez.*

- **PDF, HTML, DOCX, PNG** ; **impression** système
- Thèmes, dossier **Theme**, CSS externe
- Préréglages de **largeur de colonne** (Étroit / Standard / Large) en mode visuel et aperçu

### Historique

*Éditez sans crainte—les snapshots prévisualisent avant d'écraser le disque.*

- **Instantanés** ; restauration sans écraser le disque avant sauvegarde

<!-- readme-body-end -->

---

<a id="download"></a>

## Télécharger

**[Télécharger la dernière version →](https://github.com/lunote-code/lunote/releases)**

Sans inscription · fichiers `.md` locaux · hors ligne

<details>
<summary><strong>Premier lancement macOS (Gatekeeper)</strong></summary>

1. Déplacer **Lunote** dans **Applications**
2. **Clic droit → Ouvrir → Ouvrir**
3. Si besoin : `xattr -cr /Applications/Lunote.app`

</details>

| Platform | Package |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) |

---

<a id="quick-start"></a>

## Démarrage rapide

1. Installer Lunote depuis **[Télécharger](#download)**.
2. **Ouvrir votre coffre existant**—Obsidian, Logseq, Typora ou tout dossier `.md`. Pas d'import.
3. Écrire, taper `[[` pour lier, `Cmd+Shift+F` / `Ctrl+Shift+F` pour chercher, exporter en PDF ou Word si besoin.

> **Migration ?** Les fichiers restent en place. D'autres outils peuvent lire le même Markdown.

---

<a id="why-lunote"></a>

## Pourquoi Lunote

- **Vos fichiers** : des `.md` normaux dans vos dossiers.
- **Une seule app** : écriture fluide, liens wiki et graphe intégrés—sans plugins.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Comparatif

Sur Typora ou Obsidian ? Lunote est pour ceux qui veulent **écriture confortable et liens wiki dans une app bureau**, sans réglages de plugins.

| | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Écriture** | Excellente | Bonne | Excellente, intégrée |
| **Liens wiki & graphe** | Limité | Fort (souvent plugins) | Fort, intégré |
| **Plugins au départ** | Peu | Beaucoup | Aucun |


---


<a id="user-guide"></a>

## Guide (anglais)

Guides pratiques en anglais (thèmes, raccourcis et liste complète des commandes **`/`**) :

- [Thèmes](guide/themes.md) — built-in themes, Theme folder, external CSS, snippets, export styles
- [Raccourcis & menus rapides](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Templates](Templates/README.md) — default and daily note templates, variables
- [Différences par plateforme](guide/platform-differences.md) — PDF, impression, révéler dans le gestionnaire de fichiers et dépannage par OS
- [Index du guide](guide/README.md) — all guide pages

---


<a id="development"></a>

## Développement

Construire Lunote vous-même :

- **Prérequis:** Node.js, Rust et outils [Tauri](https://tauri.app/)
- **Dev:** `npm install` puis `npm run tauri:dev`
- **Build:** `npm run tauri:bundle` (ou `tauri:bundle:dmg` / `msi` / `deb`)
- **Docs:** [Index documentation](README.md) · [Packaging](packaging-strategy.md) · [Scripts](../scripts/README.md)

Questions ? [Ouvrir une issue](https://github.com/lunote-code/lunote/issues). PR bienvenues.

---

<a id="contribution"></a>

## Contribution

Avant une pull request :

- Lire [Scripts & maintenance](../scripts/README.md) (locales et releases)
- Exécuter `npm run lint` et les tests pertinents pour l’éditeur ou l’export
- Harmoniser les textes via les [README localisés](README.md)

Idées : [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

---

<a id="faq"></a>

## FAQ

**Compte ou Internet requis ?**  
Non. Hors ligne ; notes locales sauf si vous synchronisez le dossier vous-même.

**Ouvrir un dossier Obsidian ou Typora ?**  
Oui. Ouvrez le dossier comme espace de travail—les mêmes fichiers `.md`.

**Utiliser avec Obsidian ?**  
Oui. Le même dossier pour les deux. Lunote ne verrouille pas vos données.

**Remplace Obsidian ou Notion ?**  
Pas toujours. Lunote vise l'écriture bureau + liens intégrés. Mobile ou grand écosystème de plugins : combinez si besoin.

**Signaler un bug ou une idée ?**  
[Ouvrir une issue](https://github.com/lunote-code/lunote/issues) ou une [discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Licence

Logiciel open source. Voir le fichier de licence du dépôt.

<a id="sponsor"></a>

## Soutenir le projet

Si Lunote vous aide, vous pouvez soutenir volontairement le développement via **USDT TRC20** sur le réseau Tron.

| | |
|---|---|
| **Réseau** | Tron (TRC20) · USDT |
| **Adresse** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |

<sub>Vérifiez l'adresse avant d'envoyer. Les transferts on-chain sont irréversibles. Le soutien est volontaire et ne constitue pas l'achat d'un service.</sub>

---