<p align="center">
  <img src="../src-tauri/icons/icon.svg" alt="Lunote" width="96" />
</p>

<h1 align="center">Lunote</h1>

<p align="center">
  <strong>Construisez un système de connaissances connecté avec l'IA.</strong><br />
  <em>Lunote réunit notes Markdown, liens wiki, visualisation du graphe et découverte de connaissances par IA pour mieux penser, apprendre et créer.</em><br />
  <em>Transformez des notes éparses en connaissances reliées — local-first, chiffrement de workspace AES-256 optionnel et entièrement sous votre contrôle.</em>
</p>

<p align="center">
  Disponible sur <strong>macOS</strong>, <strong>Windows</strong> et <strong>Linux</strong>.
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
>Pourquoi Lunote</a> &nbsp;|&nbsp;
  <a href=
>Fonctionnalités</a> &nbsp;|&nbsp;
  <a href=
>Démarrage</a> &nbsp;|&nbsp;
  <a href=
>Télécharger</a> &nbsp;|&nbsp;
  <a href=
>Contribuer</a>
</h3>

<p align="center">
  <strong>Docs :</strong> <a href="README.md">Toutes les langues</a> · <a href="../README.md">English</a>
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
  <strong>Guide :</strong> <a href="guide/themes.md">Thèmes</a> · <a href="guide/shortcuts-and-menus.md">Raccourcis &amp; commandes /</a> · <a href="guide/README.md">Tous les guides</a>
</p>

<p align="center">
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Download-macOS" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Download-Windows" /></a>
  <a href="https://github.com/lunote-code/lunote/releases"><img src="https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="Download-Linux" /></a>
</p>

<p align="center">
  <a href="#preview">Captures</a> · <a href="#why-lunote">Pourquoi</a> · <a href="#key-features">Fonctions</a> · <a href="#compare">Comparer</a> · <a href="#download">Télécharger</a> · <a href="#getting-started">Démarrage</a> · <a href="#faq">FAQ</a>
</p>

<!-- readme-demo-gif -->
<p align="center">
  <img src="assets/demo/lunote-demo.gif" alt="Lunote — démo : connaissances connectées, liens wiki, IA, graphe" width="720" />
</p>
<p align="center"><sub>Connaissances reliées · `[[liens wiki]]` · découverte IA · graphe · local-first · chiffrement optionnel</sub></p>

---

Lunote est un **workspace de gestion des connaissances natif IA** — une base de connaissances personnelle où les idées se connectent, grandissent et deviennent compréhensibles par l'IA. Ouvrez un dossier `.md` et construisez un système — pas seulement une pile de notes.

| | |
|---|---|
| **Platforms** | macOS, Windows, Linux |
| **UI languages** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Export** | PDF, Word (DOCX), HTML, PNG · print |
| **Security** | Optional workspace encryption (AES-256-GCM) · passwords never saved on disk |

Notes de version dans [CHANGELOG.md](../CHANGELOG.md). **v1.0.4** : l'ouverture d'un espace de travail ne reste plus bloquée sur le voile de chargement ; l'éditeur visuel reste sur TipTap 3.23.1 (3.30/3.31 cassait l'édition).

---

<a id="why-lunote"></a>

## Pourquoi Lunote

La plupart des apps de notes aident à **capturer** l'information. Peu aident à **construire la connaissance**.

- **Les notes ordinaires deviennent des silos** — les idées s'empilent sans relations visibles.
- **Les connexions font croître le savoir** — liens wiki, backlinks et notes liées forment un réseau navigable.
- **L'IA doit comprendre toute votre base** — pas seulement le document ouvert. Avec le contexte du workspace, elle peut synthétiser, suggérer des liens et révéler des lacunes.
- **Vos notes peuvent rester chiffrées au repos** — chiffrement de workspace AES-256-GCM optionnel pour les Markdown sur disque ; mot de passe à chaque session ; jamais enregistré sur le disque.

Lunote est fait pour cela : une **base de connaissances personnelle local-first** avec **chiffrement de workspace** optionnel, où pensée connectée et compréhension par l'IA travaillent ensemble — sans cloud, compte ni jungle de plugins.
---

<a id="key-features"></a>

## Fonctionnalités clés

<!-- readme-body-start -->

### Base de connaissances propulsée par l'IA

Une IA qui comprend et travaille avec vos notes — pas une fenêtre de chat à part.

- **Conversations conscientes du workspace** — contexte de la note ouverte, sélection, mentions `@`, voisins liés, recherche
- **Recherche IA** — extraits pertinents dans tout le coffre
- **Résumés & synthèse** — condenser notes, sélections ou thèmes
- **Aide à l'écriture** — continuer, réécrire, traduire, structurer en Markdown Lunote
- **Synthèse de connaissances** — analyse multi-notes, vues d'ensemble, insights par thème

Apportez votre clé API dans **Préférences → IA** (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, etc.).

### Connaissances connectées

Relier les idées — fondation d'un système de connaissance vivant.

- **Liens wiki** — `[[lier des notes]]` en écrivant ; renommer met à jour les liens
- **Backlinks** — ce qui pointe vers la note lue
- **Notes liées** — suivre les fils sans perdre le contexte
- **Liens bidirectionnels** — automatiques dans les deux sens

### Découverte de connaissances

Trouver idées, motifs et connexions cachées dans le workspace.

- **Suggestions de liens** — l'IA propose des `[[liens wiki]]`
- **Découverte de relations** — comment les sujets se regroupent
- **Exploration thématique** — connu, manquant, prochaines écritures
- **Liens manquants** — lacunes, orphelins, sous-liens

### Visualisation du graphe

Le graphe est une **vue du réseau de connaissances** — autour de votre focus actuel.

- **Sous-graphe local** centré sur la note ouverte — profondeur et filtres
- **Navigation par connexion** — sauter entre notes liées
- **Voir le savoir évoluer** — clusters en reliant davantage

> Par défaut : **sous-graphe local** autour de la note active. **Global** ou plein écran pour un graphe de liens du workspace. Plafonds : **étendu** (défaut) 400 nœuds / 700 arêtes, **standard** 250 / 400, **compact** 120 / 200 — pas un graphe vault illimité comme Obsidian.

### Markdown natif

Notes pérennes dans un format ouvert et portable.

- **Markdown d'abord** — visuel ou source ; mode focus
- **Format ouvert** — fichiers `.md` sur disque
- **Notes portables** — même dossier dans Obsidian, Typora, etc.
- **Contenu riche** — code, tableaux, maths, Mermaid, callouts ; export PDF, Word, HTML, PNG

### Chiffrement du workspace

Protégez les notes sensibles au repos — intégré, sans plugin.

- **AES-256-GCM** — corps des notes Markdown chiffrés sur disque
- **Mot de passe par session** — déverrouiller à l'ouverture ; jamais enregistré sur le disque
- **Optionnel par workspace** — activer dans **Préférences → Sécurité**
- **Images optionnelles** — les pièces jointes restent en clair par défaut ; **Chiffrer les images** chiffre les formats courants (PNG, JPEG, WebP, GIF, HEIC, SVG, etc.)
- **Verrouillage automatique** — après inactivité (5 minutes par défaut), enregistrer puis verrouiller un workspace chiffré déverrouillé ; le travail encore sale ignore le verrouillage

### Local First

Vos connaissances restent sous votre contrôle.

- **Vos données** — notes sur votre machine dans un dossier workspace
- **Par workspace** — ouvrir tout coffre ; sync Git, Syncthing, iCloud
- **Vie privée** — offline-first, sans compte ; IA selon votre config
- **Chiffrement si besoin** — voir **Chiffrement du workspace** ci-dessus ; mots de passe jamais enregistrés
- **Léger** — outils cœur intégrés ; [packs de thèmes](https://github.com/lunote-code/lunote-theme) optionnels

### Essentiels productivité

- Onglets, plan, palette de commandes (`Cmd+Shift+P`), snapshots par note
- Recherche globale (`Cmd+Shift+F` / `Ctrl+Shift+F`), menu `/`
- Thèmes clair/sombre, packs optionnels dans **Préférences → Plugins**

<!-- readme-body-end -->

---

<a id="preview"></a>

## Captures d'écran

<p align="center">
  <img src="assets/screenshots/ai+code-view.png" alt="IA + vue code — rédaction contextuelle" width="720" />
</p>
<p align="center"><sub>IA + vue code — rédaction contextuelle</sub></p>

<p align="center">
  <img src="assets/screenshots/graph.png" alt="Graphe de connaissances — explorer les idées reliées" width="720" />
</p>
<p align="center"><sub>Graphe de connaissances — explorer les idées reliées</sub></p>

### Plus

| Assistant IA | Éditeur de code | Vue source |
| :---: | :---: | :---: |
| <img src="assets/screenshots/AI.png" alt="Assistant IA" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/code-view.png" alt="Éditeur de code" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/source-view.png" alt="Vue source" width="240" style="max-width: 100%; height: auto;" /> |

| Diagrammes Mermaid | Recherche globale | Réglages du thème |
| :---: | :---: | :---: |
| <img src="assets/screenshots/mermaid.png" alt="Diagrammes Mermaid" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/search.png" alt="Recherche globale" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme.png" alt="Réglages du thème" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="getting-started"></a>

## Démarrage rapide

1. **[Télécharger](#download)** Lunote pour macOS, Windows ou Linux.
2. **Ouvrir votre workspace** — coffre Obsidian, export Notion, dossier Typora ou tout dossier `.md`. Pas d'import.
3. **Créer des liens** — tapez `[[` pour lier ; consultez backlinks et graphe autour de la note.
4. **Activer l'IA** — ajoutez votre clé API dans **Préférences → IA**, puis interrogez note ou workspace.
5. **Découvrir & grandir** — suggestions de liens IA, vues d'ensemble, recherche pour motifs et lacunes.
6. **Optionnel : chiffrer le workspace** — dans **Préférences → Sécurité**, activez le chiffrement pour protéger les notes Markdown au repos. Saisissez le mot de passe à l'ouverture. Activez **Chiffrer les images** et le verrouillage automatique si besoin.

> **Changement d'outil ?** Vos fichiers ne bougent pas. Toute app Markdown lit le même dossier.

---

<a id="download"></a>

## Télécharger

**[Télécharger la dernière version →](https://github.com/lunote-code/lunote/releases)**

Sans inscription · fichiers `.md` locaux · fonctionne hors ligne · **chiffrement de workspace optionnel**

<details>
<summary><strong>Premier lancement macOS (Gatekeeper)</strong></summary>

1. Déplacez **Lunote** dans **Applications**
2. **Clic droit → Ouvrir → Ouvrir**
3. Si besoin : `xattr -cr /Applications/Lunote.app`

</details>

| Plateforme | Paquet |
|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows (x86_64) | `.msi` (x64) |
| Windows (ARM64) | `.msi` (arm64) |
| Linux (Debian/Ubuntu) | `.deb` (+ `.deb.asc` optionnel) |

---

<a id="compare"></a>

## Lunote vs Notion vs Obsidian

| | Notion | Obsidian | Lunote |
|---|---|---|---|
| **Vos données** | Compte cloud | Fichiers `.md` locaux | Fichiers `.md` locaux |
| **Modèle de connaissance** | Pages dans un workspace | Coffre + plugins | Workspace connecté, intégré |
| **IA** | IA cloud sur leurs données | Dépend des plugins | IA workspace (votre clé API) |
| **Liens wiki & graphe** | Basique | Graphe vault (souvent plugin) | **Sous-graphe local** + découverte, intégré |
| **Première note** | S'inscrire, puis écrire | Ajuster plugins (optionnel) | Ouvrir dossier → relier les idées |
| **Chiffrement workspace** | Non | Plugin / OS | **Intégré** (AES-256-GCM, optionnel) |
| **Hors ligne & vie privée** | Partiel | Hors ligne total | Hors ligne total, sans compte |

---

<a id="use-cases"></a>

## Cas d'usage

- **Base de connaissances personnelle** — second cerveau avec liens wiki, backlinks et synthèse IA
- **Recherche & apprentissage** — relier lectures, résumés et idées entre sujets
- **Docs développeur** — ADR, runbooks et snippets avec blocs de code et export PDF
- **Quitter Notion ou Obsidian** — mêmes dossiers Markdown, moins de friction, pas d'upload
- **Notes sensibles & journaux** — chiffrement de workspace optionnel protège les Markdown au repos
- **Docs d'équipe asynchrones** — partager un workspace via Git ; chacun garde des `.md` plain

---

<a id="roadmap"></a>

## Feuille de route

Lunote évolue vers une expérience plus profonde de **gestion des connaissances native IA**. Directions :

- **Découverte de connaissances** plus riche — suggestions de liens, cartes thématiques, détection de lacunes
- **Compréhension IA du workspace** — meilleur contexte, synthèse et raisonnement inter-notes
- **Visualisation du graphe** étendue — plus de façons d'explorer les connexions
- Finition **local-first** — performance, export et fiabilité multiplateforme

Suivez l'avancement dans [GitHub Discussions](https://github.com/lunote-code/lunote/discussions) et [Issues](https://github.com/lunote-code/lunote/issues).

---

<a id="star"></a>

## Mettre une étoile à Lunote sur GitHub

Si Lunote vous aide à construire des connaissances connectées, **[mettez une étoile au dépôt](https://github.com/lunote-code/lunote)** — cela aide d'autres personnes à découvrir une base de connaissances personnelle propulsée par l'IA. Idées dans [Discussions](https://github.com/lunote-code/lunote/discussions).

---

<a id="user-guide"></a>

## Guide utilisateur (anglais)

Guides pratiques en anglais (thèmes, raccourcis et liste complète des commandes **`/`**) :

- [Thèmes](guide/themes.md) — thèmes intégrés, dossier Theme, CSS externe, snippets, export, **Préférences → Plugins**
- [Raccourcis & menus rapides](guide/shortcuts-and-menus.md) — palette de commandes, raccourcis clavier, commandes **`/`**
- [Chiffrement du workspace](guide/workspace-encryption.md) — AES-256-GCM, chiffrement d'images optionnel, verrouillage automatique
- [Graphe de connaissances](guide/knowledge-graph.md) — sous-graphe local, Global / plein écran, plafonds
- [Différences par plateforme](guide/platform-differences.md) — PDF, impression, révéler dans le gestionnaire de fichiers
- [Index des guides](guide/README.md) — toutes les pages

---

<a id="development"></a>

## Développement

Pour compiler Lunote vous-même :

- **Prérequis :** Node.js, Rust et outils [Tauri](https://tauri.app/)
- **Dev :** `npm install` puis `npm run tauri:dev`
- **Bundle :** `npm run tauri:bundle` (ou `tauri:bundle:dmg` / `msi` / `deb`)
- **Docs :** [Index documentation](README.md) · [Packaging](packaging-strategy.md) · [Scripts](../scripts/README.md)

Questions ? [Ouvrir une issue](https://github.com/lunote-code/lunote/issues). Pull requests bienvenues.

---

<a id="contributing"></a>

## Contribuer

Avant une pull request :

- Lire [Scripts & maintenance](../scripts/README.md) pour les locales et releases
- Exécuter `npm run lint` et les tests pertinents pour l'éditeur ou l'export
- Garder les messages cohérents dans les [README localisés](README.md)

Idées et récits de migration : [Discussions](https://github.com/lunote-code/lunote/discussions) · [Issues](https://github.com/lunote-code/lunote/issues)

<a id="faq"></a>

## FAQ

**Faut-il un compte ou Internet ?**  
Non. Lunote est offline-first. Les notes restent locales jusqu'à synchronisation du dossier. L'IA nécessite votre clé API et le réseau à l'usage.

**Lunote est-il une app de notes IA ou un éditeur Markdown ?**  
Lunote est une **base de connaissances personnelle** — Markdown stocke vos notes, l'IA rend le workspace compréhensible et découvrable. L'éditeur sert le système de connaissance.

**Puis-je ouvrir mon coffre Obsidian ?**  
Oui. Pointez Lunote vers le même dossier. Aucune migration.

**Remplace-t-il entièrement Obsidian ou Notion ?**  
Pas toujours. Lunote se concentre sur la connaissance connectée, l'IA workspace et les workflows desktop local-first. Complétez avec mobile ou plugins spécialisés si besoin.

**Graphe vault entier comme Obsidian ?**  
Partiellement. Lunote affiche par défaut un **sous-graphe local** autour de la note ouverte. Passez en **Global** ou plein écran dans le rail connaissance — notes liées du workspace, plafonnées (défaut **étendu** : 400 nœuds / 700 arêtes ; **standard** : 250 / 400 ; **compact** : 120 / 200). Ce n'est pas un graphe vault illimité comme Obsidian.

**Comment l'IA utilise-t-elle mes notes ?**  
Le contexte inclut la note courante, la sélection, les mentions `@`, les voisins liés et les extraits de recherche — uniquement ce que vous envoyez. Configurez le fournisseur dans **Préférences → IA**.

**Puis-je chiffrer mon workspace ?**  
Oui. Dans **Préférences → Sécurité**, vous pouvez activer le **chiffrement du workspace**. Les notes Markdown sont stockées chiffrées ; mot de passe à l'ouverture. Les images restent en clair sauf si vous activez **Chiffrer les images**. Le **verrouillage automatique** peut verrouiller une session déverrouillée après inactivité. Les mots de passe restent en mémoire uniquement — en cas de perte, les notes chiffrées sont irrécupérables.

**Y a-t-il des plugins ?**  
Uniquement pour les thèmes — packs optionnels dans **Préférences → Plugins** depuis [lunote-theme](https://github.com/lunote-code/lunote-theme). Liens wiki, graphe, IA et export sans installation.

**Retour ?**  
[Ouvrir une issue](https://github.com/lunote-code/lunote/issues) ou [démarrer une discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Licence

Logiciel open source. Voir le fichier de licence du dépôt.

---
