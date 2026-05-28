# Obsidian Theme Compatibility

This app can load desktop UI styles from `Theme/*.css` and applies an Obsidian compatibility bridge for community themes.

## How it works

1. Put an existing Obsidian community theme CSS file into your desktop theme folder.
2. Select that file in Settings -> Appearance -> External CSS Theme, or choose it from the native Theme menu.
3. Leave `CSS Theme Compatibility` on `Auto-detect Obsidian themes` unless the stylesheet is written specifically for this app.

## What is bridged

The runtime exposes a subset of high-value Obsidian theme primitives so existing themes can style the app without being rewritten:

- Theme root classes:
  - `body.theme-dark`
  - `body.theme-light`
- Workspace containers:
  - `.workspace`
  - `.workspace-split.mod-root`
  - `.workspace-split.mod-left-split`
  - `.workspace-split.mod-right-split`
  - `.workspace-leaf`
  - `.workspace-leaf-content[data-type="markdown"]`
  - `.view-header`
  - `.view-content`
- Editor mode containers:
  - `.markdown-preview-view`
  - `.markdown-reading-view`
  - `.markdown-source-view`
  - `.cm-editor`
  - `.cm-scroller`
  - `.cm-gutters`

## High-frequency variables mapped from Luna tokens

- `--background-primary`
- `--background-primary-alt`
- `--background-secondary`
- `--background-secondary-alt`
- `--background-modifier-border`
- `--background-modifier-border-hover`
- `--background-modifier-hover`
- `--background-modifier-form-field`
- `--background-modifier-form-field-highlighted`
- `--background-modifier-box-shadow`
- `--background-accent`
- `--text-normal`
- `--text-muted`
- `--text-faint`
- `--text-accent`
- `--text-accent-hover`
- `--interactive-accent`
- `--interactive-accent-hover`
- `--interactive-normal`
- `--text-on-accent`
- `--scrollbar-bg`
- `--scrollbar-thumb-bg`
- `--scrollbar-active-thumb-bg`
- `--font-interface-theme`
- `--font-text-theme`
- `--font-monospace-theme`

## Current limits

- This compatibility layer targets the desktop UI only. Exported HTML/PDF/PNG styling is not synchronized yet.
- It does not attempt to recreate Obsidian's full DOM tree.
- Themes that depend on deep, plugin-specific Obsidian selectors may still need small follow-up overrides.
- The first pass focuses on variables and top-level workspace containers, not full automatic selector rewriting.

## Recommended fallback

If a stylesheet looks wrong:

1. Keep the same CSS file selected.
2. Switch `CSS Theme Compatibility` to `Native CSS only`.
3. Add a tiny follow-up override file that targets this app's containers directly.
