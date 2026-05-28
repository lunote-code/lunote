<div align="center">

# Lunote

**Um workspace Markdown local-first para escrever, conectar ideias e construir uma base de conhecimento pessoal**

**Escrita estilo Typora + links estilo Obsidian — integrado, sem plugins.**
*Escreva em um editor refinado, conecte ideias com links wiki e mantenha cada nota como arquivo `.md` local. Gratuito, open source e feito para trabalho offline.*

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**Documentação:** [Todos os idiomas](README.md) · [English](README.en.md)

**Guia (inglês):** [Temas](guide/themes.md) · [Atalhos & comandos `/`](guide/shortcuts-and-menus.md) · [Índice](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[Prévia](#preview) · [Por que Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [Download](#download) · [Início rápido](#quick-start) · [Guia](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — demo de 10 s: escrita, links wiki, grafo e temas" width="720" />
  </a>
</p>
<p align="center"><sub>Tour 10 s · Markdown local · links wiki · grafo · temas · sem plugins</sub></p>

</div>

---

## O que é o Lunote?

Lunote é um workspace Markdown para desktop para quem quer três coisas ao mesmo tempo:

- **Arquivos Markdown locais e simples**
- **Uma experiência forte de escrita**
- **Fluxos de conhecimento integrados**

Você pode abrir qualquer pasta como workspace e continuar usando arquivos `.md` normais que continuam sendo seus. Escreva no modo visual quando quiser fluidez, mude para o modo source Markdown quando quiser controle total e use links wiki, backlinks, grafo e busca sem depender de plugins.

| | |
|---|---|
| **Plataformas** | macOS, Windows, Linux |
| **Idiomas da interface** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Exportação** | PDF, Word (DOCX), HTML, PNG |
| **Tecnologia** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## Prévia


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Workspace principal do Lunote" width="720" />
</p>

| Editor visual | Grafo de conhecimento | Tema |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="Editor visual" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="Grafo de conhecimento" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="Temas" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Por que Lunote

- **Local-first**: suas notas continuam sendo arquivos Markdown normais nas suas próprias pastas.
- **Editor-first**: edição visual e source Markdown têm o mesmo nível de importância.
- **Pronto para conhecimento**: links wiki, backlinks, grafo, outline e busca já vêm integrados.
- **Prático**: exporte quando precisar, sincronize com suas próprias ferramentas e trabalhe offline.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| Ponto de comparação | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Melhor para** | Escrita limpa em documento único | PKM com muitos plugins e personalização do vault | Escrita + conhecimento conectado em um só app |
| **Estilo de edição** | Editor Markdown minimalista | Plataforma Markdown extensível | Edição visual + source Markdown |
| **Recursos de conhecimento** | Limitados | Fortes, muitas vezes guiados por plugins | Links wiki, backlinks, grafo e busca integrados |
| **Complexidade de configuração** | Baixa | Média a alta | Baixa a média |
| **Dependência de plugins** | Baixa | Alta | Baixa |
| **Escolha se...** | Você quer principalmente um app de escrita | Você quer principalmente um ecossistema | Você quer equilibrar escrita e workflows de conhecimento |

---

<a id="download"></a>

## Download

**[Última versão →](https://github.com/lunote-code/lunote/releases)**

O GitHub release workflow publica atualmente estes pacotes:

| Plataforma | Pacote | Referência do workflow |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

Primeira execução no macOS:

1. Mova o **Lunote** para **Applications**
2. **Clique com o botão direito → Open → Open**
3. Se necessário, execute `xattr -cr /Applications/Lunote.app`

---

<a id="quick-start"></a>

## Início rápido

1. Instale o Lunote para a sua plataforma.
2. Abra uma pasta com notas Markdown ou crie um novo workspace.
3. Escreva, conecte notas com `[[`, pesquise com `Ctrl+Shift+F` / `Cmd+Shift+F` e exporte quando precisar.

Se você já tem uma biblioteca Markdown do Obsidian, Logseq ou Typora, basta abrir a pasta. Não é necessário importar.

---

<a id="user-guide"></a>

## Guia (inglês)

Guias em inglês (temas, atalhos e a lista completa de comandos **`/`**):

- [Temas](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [Atalhos e menus rápidos](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Índice do guia](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**Preciso de conta ou internet?**  
Não. O Lunote funciona offline e mantém suas notas locais, a menos que você decida sincronizá-las.

**Posso usar uma biblioteca Markdown existente?**  
Sim. Basta abrir qualquer pasta com arquivos `.md` / `.markdown`.

**É compatível com outras ferramentas?**  
Sim. O Lunote usa Markdown padrão, então a mesma pasta pode continuar sendo usada com Obsidian, VS Code, Typora ou Git.

**Ele substitui totalmente o Obsidian ou o Notion?**  
O Lunote é focado em Markdown local, uma forte experiência de edição e links integrados. Se você precisa de app móvel ou de um grande ecossistema de plugins, ainda pode combiná-lo com outras ferramentas.

**Como reporto bugs ou peço novos recursos?**  
[Abra uma issue](https://github.com/lunote-code/lunote/issues) ou inicie uma [discussion](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Licença

Software open source. Consulte o arquivo de licença do repositório para mais detalhes.

---

<a id="sponsor"></a>

## Apoiar o projeto

Se o Lunote ajuda você:

- **[Dê uma estrela ao repositório](https://github.com/lunote-code/lunote)** — ajuda outras pessoas a descobri-lo
- **[Compartilhe feedback](https://github.com/lunote-code/lunote/discussions)** — ideias e casos de uso importam tanto quanto o código

Se o Lunote ajuda você, pode patrocinar voluntariamente o desenvolvimento via **USDT TRC20** na rede Tron.

| | |
|---|---|
| **Rede** | Tron (TRC20) · USDT |
| **Endereço** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>Confira o endereço antes de enviar. Transferências on-chain não podem ser revertidas. O patrocínio é voluntário e não constitui compra de serviço.</sub>

---