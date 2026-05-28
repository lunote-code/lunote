<div align="center">

# Lunote

**Un espacio de trabajo Markdown local-first para escribir, enlazar ideas y construir una base de conocimiento personal**

**Escritura al estilo Typora + enlaces al estilo Obsidian — integrado, sin plugins.**
*Escribe en un editor cuidado, conecta ideas con enlaces wiki y guarda cada nota como archivo `.md` local. Gratis, de código abierto y pensado para trabajar sin conexión.*

[![GitHub stars](https://img.shields.io/github/stars/lunote-code/lunote?style=social)](https://github.com/lunote-code/lunote/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/lunote-code/lunote?include_prereleases)](https://github.com/lunote-code/lunote/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)
[![License](https://img.shields.io/badge/license-Open%20Source-lightgrey)](#license)

**Documentación:** [Todos los idiomas](README.md) · [English](README.en.md)

**Guía (inglés):** [Temas](guide/themes.md) · [Atajos y comandos `/`](guide/shortcuts-and-menus.md) · [Índice](guide/README.md)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lunote-code/lunote/releases)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-orange?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/lunote-code/lunote/releases)

[Vista previa](#preview) · [Por qué Lunote](#why-lunote) · [Typora vs Obsidian vs Lunote](#typora-vs-obsidian-vs-lunote) · [Descarga](#download) · [Inicio rápido](#quick-start) · [Guía](#user-guide) · [FAQ](#faq)

<!-- readme-demo-gif -->
<p align="center">
  <a href="#preview">
    <img src="assets/demo/lunote-demo.gif" alt="Lunote — demo de 10 s: escritura, enlaces wiki, grafo y temas" width="720" />
  </a>
</p>
<p align="center"><sub>Tour 10 s · Markdown local · enlaces wiki · grafo · temas · sin plugins</sub></p>

</div>

---

## ¿Qué es Lunote?

Lunote es un espacio de trabajo Markdown de escritorio para quienes quieren tres cosas al mismo tiempo:

- **Archivos Markdown locales y simples**
- **Una experiencia fuerte de escritura**
- **Flujos de conocimiento integrados**

Puedes abrir cualquier carpeta como espacio de trabajo y seguir usando archivos `.md` normales que siguen siendo tuyos. Escribe en modo visual cuando quieras fluidez, cambia al modo fuente Markdown cuando quieras control y usa enlaces wiki, backlinks, grafo y búsqueda sin depender de plugins.

| | |
|---|---|
| **Plataformas** | macOS, Windows, Linux |
| **Idiomas de la interfaz** | English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português (Brasil), Italiano |
| **Exportación** | PDF, Word (DOCX), HTML, PNG |
| **Tecnología** | Tauri 2 · Rust · React · TipTap · CodeMirror |

---

<a id="preview"></a>

## Vista previa


<p align="center">
  <img src="assets/screenshots/hero-preview.png" alt="Espacio principal de Lunote" width="720" />
</p>

| Editor visual | Grafo de conocimiento | Tema |
| :---: | :---: | :---: |
| <img src="assets/screenshots/editor-visual.png" alt="Editor visual" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/knowledge-graph.png" alt="Grafo de conocimiento" width="240" style="max-width: 100%; height: auto;" /> | <img src="assets/screenshots/theme-presets.png" alt="Temas" width="240" style="max-width: 100%; height: auto;" /> |

---

<a id="why-lunote"></a>

## Por qué Lunote

- **Local-first**: tus notas siguen siendo archivos Markdown normales en tus propias carpetas.
- **Editor-first**: la edición visual y el código Markdown son igual de importantes.
- **Listo para conocimiento**: enlaces wiki, backlinks, grafo, esquema y búsqueda vienen integrados.
- **Práctico**: exporta cuando lo necesites, sincroniza con tus propias herramientas y trabaja sin conexión.

---

<a id="typora-vs-obsidian-vs-lunote"></a>

## Typora vs Obsidian vs Lunote

| Punto de comparación | Typora | Obsidian | Lunote |
|---|---|---|---|
| **Ideal para** | Escritura limpia en un solo documento | PKM con muchos plugins y personalización del vault | Escritura + conocimiento enlazado en una sola app |
| **Estilo de edición** | Editor Markdown minimalista | Plataforma Markdown extensible | Edición visual + fuente Markdown |
| **Funciones de conocimiento** | Limitadas | Potentes, a menudo impulsadas por plugins | Enlaces wiki, backlinks, grafo y búsqueda integrados |
| **Complejidad de configuración** | Baja | Media a alta | Baja a media |
| **Dependencia de plugins** | Baja | Alta | Baja |
| **Elígelo si...** | Quieres sobre todo una app de escritura | Quieres sobre todo un ecosistema | Quieres equilibrar escritura y flujos de conocimiento |

---

<a id="download"></a>

## Descarga

**[Última versión →](https://github.com/lunote-code/lunote/releases)**

El GitHub release workflow publica actualmente estos paquetes:

| Plataforma | Paquete | Referencia del workflow |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | `macos-14` |
| Windows (x86_64) | `.msi` (x64) | `windows-2022` |
| Windows (ARM64) | `.msi` (arm64) | `windows-11-arm` |
| Linux (Debian/Ubuntu) | `.deb` (+ optional `.deb.asc`) | `ubuntu-22.04` |

Primer inicio en macOS:

1. Mueve **Lunote** a **Applications**
2. **Clic derecho → Open → Open**
3. Si hace falta, ejecuta `xattr -cr /Applications/Lunote.app`

---

<a id="quick-start"></a>

## Inicio rápido

1. Instala Lunote para tu plataforma.
2. Abre una carpeta con notas Markdown o crea un nuevo espacio de trabajo.
3. Escribe, enlaza notas con `[[`, busca con `Ctrl+Shift+F` / `Cmd+Shift+F` y exporta cuando lo necesites.

Si ya tienes una biblioteca Markdown de Obsidian, Logseq o Typora, abre la carpeta directamente. No hace falta importar nada.

---

<a id="user-guide"></a>

## Guía (inglés)

Ayuda paso a paso en inglés (temas, atajos y la lista completa de comandos **`/`**):

- [Temas](guide/themes.md) — built-in themes, Theme folder, Obsidian CSS, snippets, export styles
- [Atajos y menús rápidos](guide/shortcuts-and-menus.md) — Command Palette, keyboard shortcuts, full **`/`** slash command list
- [Índice de la guía](guide/README.md) — all guide pages

---

<a id="faq"></a>

## FAQ

**¿Necesito una cuenta o internet?**  
No. Lunote funciona sin conexión y mantiene las notas en local salvo que tú decidas sincronizarlas.

**¿Puedo usar una biblioteca Markdown existente?**  
Sí. Abre cualquier carpeta con archivos `.md` / `.markdown`.

**¿Es compatible con otras herramientas?**  
Sí. Lunote usa Markdown estándar, así que la misma carpeta puede seguir usándose con Obsidian, VS Code, Typora o Git.

**¿Reemplaza por completo a Obsidian o Notion?**  
Lunote se centra en Markdown local, una fuerte experiencia de edición y enlaces integrados. Si necesitas una app móvil o un gran ecosistema de plugins, puedes seguir combinándolo con otras herramientas.

**¿Cómo reporto bugs o pido funciones nuevas?**  
[Abre un issue](https://github.com/lunote-code/lunote/issues) o inicia una [discusión](https://github.com/lunote-code/lunote/discussions).

---

<a id="license"></a>

## Licencia

Software de código abierto. Consulta el archivo de licencia del repositorio para más detalles.

---

<a id="sponsor"></a>

## Apoyar el proyecto

Si Lunote te ayuda:

- **[Da una estrella al repositorio](https://github.com/lunote-code/lunote)** — ayuda a que más personas lo descubran
- **[Comparte comentarios](https://github.com/lunote-code/lunote/discussions)** — ideas y casos de uso importan tanto como el código

Si Lunote te ayuda, puedes patrocinar voluntariamente el desarrollo con **USDT TRC20** en la red Tron.

| | |
|---|---|
| **Red** | Tron (TRC20) · USDT |
| **Dirección** | USDT · `TEDgPJzSmv7YTjrs2EZrFF5kCNbuZY15iY` |


<sub>Verifica la dirección antes de enviar. Las transferencias on-chain no se pueden revertir. El patrocinio es voluntario y no constituye la compra de un servicio.</sub>

---