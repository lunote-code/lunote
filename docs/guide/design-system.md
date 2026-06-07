# UI design system (CSS)

Lunote’s desktop UI shares a small set of **global CSS layers** under `src/app/styles/`. Feature-specific rules (editor nodes, sidebars, knowledge panels) stay in their own files; new UI should reuse the layers below instead of copying colors or focus rings.

Entry point: [`src/App.css`](../../src/App.css).

---

## Layer stack

Imported in this order (after `tokens.css`):

| File | Role |
|------|------|
| [`tokens.css`](../../src/app/styles/tokens.css) | Design variables: overlay surfaces, fields, buttons, scrollbars, semantic colors |
| [`overlay-app.css`](../../src/app/styles/overlay-app.css) | Menu row hover/active, `--luna-focus-ring`, `luna-spin` loading animation |
| [`fields-app.css`](../../src/app/styles/fields-app.css) | Input tiers: bordered forms, overlay search, sidebar chrome search |
| [`buttons-app.css`](../../src/app/styles/buttons-app.css) | Icon chrome (`.icon-btn`), ghost icon, `settings-button` disabled state |
| [`dialogs-app.css`](../../src/app/styles/dialogs-app.css) | Modal backdrops, panel shell, about/confirm/delete/rename variants |
| [`scrollbars-app.css`](../../src/app/styles/scrollbars-app.css) | Standard 8px scrollbars + sidebar/tab thin variants (imported from `App.css`) |

---

## Key tokens

```css
/* Overlay (command palette, context menu, modals) */
--luna-overlay-backdrop
--luna-overlay-panel-bg
--luna-overlay-panel-border
--luna-overlay-panel-shadow

/* Fields */
--luna-field-height
--luna-field-border
--luna-field-focus-ring    /* 0 0 0 3px var(--focus-ring) */

/* Buttons */
--luna-btn-icon-size
--luna-btn-hover-bg
--luna-focus-ring

/* Menu rows */
--luna-menu-item-hover-bg
--luna-menu-item-focus-bg
```

Popover surfaces in the editor (`--reveal-popover-*`) alias overlay panel tokens where possible.

---

## Field tiers

1. **Bordered** — settings inputs, panel search, rename modal, CodeMirror search, emoji search  
   Classes listed in `fields-app.css` tier 1; hover/focus use `--luna-field-*`.
2. **Overlay search** — `.command-palette-input`, `.global-search-input` (borderless in modal header).
3. **Sidebar chrome** — `.sidebar-search-chrome .search-input` (background focus, no ring).

---

## Buttons

| Tier | Classes | Use |
|------|---------|-----|
| Icon chrome | `.icon-btn`, `.ghost-btn`, `.icon-btn-active` | Toolbar / sidebar 34×34 controls |
| Ghost icon | `.luna-icon-btn-ghost`, `.document-history-icon-btn` | Borderless icon (close, etc.) |
| Text | `.settings-button`, `.settings-button-primary` | Preferences & dialog actions (see `settings.css`) |
| Dialog actions | `.about-modal-close` + modifiers (`confirm-modal-confirm`, `delete-modal-confirm`, …) | Confirm / delete / rename footers |

## Focus rings

Keyboard focus on interactive controls should use:

```css
:focus-visible {
  outline: none;
  box-shadow: var(--luna-focus-ring);
}
```

Do **not** use ad-hoc `outline: 3px solid color-mix(... var(--accent) ...)`. Exceptions: selection highlights (`.ProseMirror-selectednode`), navigation flash (`.navigation-reveal-highlight`, `.pm-footnote-def-flash`), and decorative swatch hover rings.

---

## Overlays & menus

- **Command palette / global search** — `command-palette.css` + `overlay-app` menu row styles (`.command-palette-item`).
- **Knowledge inline search** — `.kos-search-results .kos-search-hit` uses the same hover/focus tokens via `overlay-app`.
- **Context menu** — `sidebar-file-context-menu.css`; hover/focus from `overlay-app`.
- **Menubar** — `appMenuBar.css`; row hover from `overlay-app`.

Loading spinners: add class `command-palette-loading-icon` or `luna-spin` (single `@keyframes luna-spin`).

**Hint popovers** — icon trigger + detail panel: use [`LunaHintPopover`](../../src/components/LunaHintPopover/LunaHintPopover.tsx) in app chrome; `SettingsHelpPopover` wraps it for preferences (dialog portal).

---

## Dialogs

- Backdrop: `.app-dialog-backdrop`, `.about-modal-backdrop`, `.confirm-modal-backdrop`
- Panel chrome: `.luna-dialog-panel` or extend `.app-dialog` / `.about-modal` / `.confirm-modal`
- Wide content dialogs (history, save conflict) add a modifier class on top of `.app-dialog`

---

## Code blocks

Typography tokens live in [`code-block-tokens.css`](../../src/app/styles/code-block-tokens.css): `--code-block-font-size` scales with `--editor-content-font-size` (preferences); `--font-code-block` uses `--font-mono`. Syntax colors in [`hljsEditorTheme.css`](../../src/editor/hljsEditorTheme.css) map to semantic tokens (`--text-primary`, `--link`, `--text-muted`, etc.).

Editable Luna fenced blocks are implemented under [`src/editor/codeBlock/`](../../src/editor/codeBlock/):

| Layer | Module | Role |
|-------|--------|------|
| Model | `model/lineModel.ts` | Logical line count, gutter row count, doc offsets |
| Layout | `layout/measureLayout.ts`, `layout/domMeasure.ts`, `layout/contentRoot.ts` | Gutter/overlay snapshot + DOM Range fallback |
| NodeView | `nodeView/` | Typora-style UI, toolbar, gutter sync hook |
| Behavior | `behavior/` | Toggle, keyboard nav, Enter/Tab fence guard |
| Extension | `extension/lunaCodeBlockExtension.ts` | Tiptap `codeBlock` node |

Legacy paths (`lunaCodeBlock.tsx`, `codeBlockLineMetrics.ts`, `codeBlockSelection.ts`, `lunaCodeBlockNav.ts`, …) re-export from `codeBlock/` for compatibility.

**CBR note:** `codeBlockRuntime` edit/preview is for **Mermaid** only. Standard fenced `codeBlock` edits inline in ProseMirror (Typora-style WYSIWYG), not via CBR textarea.

**Code blocks:** editable fences use embedded CodeMirror 6 (default on) — see [codeblock-cm-migration.md](codeblock-cm-migration.md).

---

## Scrollbars

Add new scrollable regions to the selector list in `scrollbars-app.css` (standard 8px block), or use utility class `.luna-overlay-scroll`.

Sidebar file list and editor tabs use thinner dedicated tokens (`--luna-sidebar-scrollbar-*`, `--luna-tabs-scrollbar-*`).

---

## Contributing checklist

When adding UI:

1. Prefer existing tokens over hard-coded hex.
2. Register inputs in `fields-app.css` if they need bordered focus rings.
3. Use `--luna-focus-ring` for keyboard focus on controls.
4. Put modal shell styles in `dialogs-app.css`, not scattered in feature CSS.
5. Avoid duplicating rules already imported via `sidebar-files-chrome.css` (e.g. `editor-tabs.css`, `editor-chrome-shell.css`).

Run `npm run build` after CSS changes.
