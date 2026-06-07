# Theme selector reference

Stable DOM hooks for external CSS themes and UI snippets. Prefer **palette tokens** first; use these selectors for personality deltas only.

See also: [External CSS reference](../theme/external-css.md) · [Built-in vs theme layers](./README.md#built-in-editor-polish)

---

## App shell

| Selector | Use |
|----------|-----|
| `.app-shell`, `.workspace`, `.workspace-root` | App background, gradients |
| `.layout`, `.workspace-split.mod-root` | Root split layout |
| `.with-sidebar`, `.without-sidebar`, `.focus-mode`, `.with-knowledge-rail` | Layout state |
| `.sidebar`, `.workspace-split.mod-left-split` | File sidebar |
| `.kos-right-rail`, `.workspace-split.mod-right-split` | Knowledge rail |

---

## Editor chrome

| Selector | Use |
|----------|-----|
| `.main`, `.main-editor-stack` | Editor column |
| `.main.editor-body-focused` | Editor has focus (shell tint) |
| `.editor-body-surface` | Editor pane wrapper; focus inset ring when focused |
| `.editor-header`, `.editor-footer` | Top / bottom chrome |
| `.editor-format-toolbar`, `.editor-format-btn` | Format toolbar |
| `.editor-tab-row`, `.editor-tab` | Document tabs |
| `.preview-pane.markdown-visual-editor` | Visual mode container |
| `.source-pane`, `.editor-pane` | Source mode container |

---

## Visual editor content (ProseMirror)

| Selector | Use |
|----------|-----|
| `.preview-pane.markdown-visual-editor .ProseMirror` | Scroll container + body typography |
| `.preview-pane.markdown-visual-editor .ProseMirror > p` | Paragraph rhythm |
| `.preview-pane.markdown-visual-editor .ProseMirror > blockquote` | Block quotes |
| `.preview-pane.markdown-visual-editor .ProseMirror a.pm-link-inline` | Inline links (not bare `a`) |
| `.preview-pane.markdown-visual-editor .ProseMirror hr` | Horizontal rules |

### Headings (NodeView — primary)

Normal editing renders headings inside NodeView blocks. **Target these first:**

| Selector | Level |
|----------|-------|
| `.pm-heading-block--l1 .pm-heading-content` | H1 |
| `.pm-heading-block--l2 .pm-heading-content` | H2 |
| `.pm-heading-block--l3 .pm-heading-content` | H3 |
| `.pm-heading-block--l4 .pm-heading-content` | H4 |
| `.pm-heading-block--l5 .pm-heading-content` | H5 |
| `.pm-heading-block--l6 .pm-heading-content` | H6 |
| `.pm-heading-level-tag` | Left gutter `Hn` label (hover) |

Full selector prefix:

```css
.preview-pane.markdown-visual-editor .ProseMirror .pm-heading-block--l1 .pm-heading-content
```

### Headings (fallback — pasted raw HTML)

```css
.preview-pane.markdown-visual-editor .ProseMirror > h1
.preview-pane.markdown-visual-editor .ProseMirror > h2
/* … h3–h6 */
```

### NodeViews & blocks

| Selector | Block |
|----------|-------|
| `.pm-code-block-wrap` | Fenced code block (CM inside) |
| `.pm-image-card`, `.pm-image-card--open` | Image block |
| `aside.pm-callout.luna-callout-card` | GitHub callout |
| `.pm-math-block` | Display math |
| `.pm-footnote-def-wrap` | Footnote definition |
| `.pm-editor-list`, `.pm-editor-task-list` | Lists / tasks |

---

## Source mode (CodeMirror)

| Selector | Use |
|----------|-----|
| `.source-pane .cm-editor` | CM root |
| `.source-pane .cm-scroller` | Scroll container |
| `.source-pane .cm-content`, `.source-pane .cm-line` | Document lines |
| `.source-pane .cm-gutters` | Line number gutter |
| `.source-pane .cm-cursor` | Caret |
| `.source-pane .cm-activeLine` | Active line highlight |

---

## Export / static preview

| Selector | Use |
|----------|-----|
| `.markdown-preview-view` | Static markdown preview |
| `.markdown-body` | Export HTML body |

Always pair visual-editor rules with `.markdown-preview-view` when styling content that appears in export preview.

---

## Structural CSS variables

Set on `html[data-theme='light'|'dark']` or inherited from settings:

| Variable | Role |
|----------|------|
| `--editor-column-width` | Content column max width (default 860px) |
| `--editor-content-font-size` | Body size in editor |
| `--editor-content-font-family` | Body font stack |
| `--editor-heading-gutter` | Left Hn gutter width (default 52px) |
| `--font-reading`, `--line-reading` | Reading typography tokens |

**Prefer `--editor-column-width: 72ch`** over `max-width` on `.ProseMirror` — column width applies to child blocks via built-in layout.

---

## Built-in polish (do not duplicate in themes)

Shipped in app CSS (`editor-visual-core.css`, `editor-chrome-shell.css`, `editor-node-image-media.css`, `lunaCalloutCard.css`):

- `text-rendering`, `-webkit-font-smoothing` on ProseMirror
- Heading rhythm via `.pm-heading-block--l1` … `--l6`
- Paragraph margin `0.55em`, line-height `1.7`
- HR centered gradient, opacity 0.85
- Selection tint accent 18%
- Inline `img` border-radius + `--shadow-soft`
- `.main.editor-body-focused .editor-body-surface` focus inset ring
- Link colors via `--luna-link-inline-*` tokens
- Callout cards: 12px radius, gradient bg, hover shadow

Use [snippets/extra-chrome.css](./snippets/extra-chrome.css) for optional layers on top (tables, preview pre/img).
