# Themes

Lunote separates **what you see while editing** from **how exported files look**. You can combine a built-in color scheme with Obsidian-style CSS, optional snippets, and export-only styles.

Open **File → Preferences** (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux), then use the **Appearance** tab (and **Export** for print/PDF-related options).

---

## Built-in themes

These control Lunote’s own UI tokens (sidebars, editor chrome, default colors). They do **not** load files from the Theme folder by themselves.

| Option | Effect |
|--------|--------|
| **System** | Follow light/dark mode of the operating system |
| **Light** | Light built-in palette |
| **Dark** | Dark built-in palette |
| **Dim** | Softer dark variant |
| **GitHub** | GitHub-like light styling |
| **IDEA** | IDE-inspired light styling |

You can switch quickly from the desktop **Theme** menu (menu bar) or from Appearance in Preferences.

**Custom JSON theme:** Import a JSON token file to override built-in colors. This is separate from Obsidian `.css` themes. Use **Import Theme** / **Open Theme Folder** in Preferences when you maintain your own token file.

---

## Theme folder layout

Lunote uses a **Theme** directory next to your workspace or in the app data area (open it from Preferences or **Theme → Open Theme folder…**).

Typical layout:

```text
Theme/
  SomeTheme.css          ← full UI theme (Obsidian-style)
  snippets/
    my-tweak.css         ← small UI overrides (stackable)
  export/
    print.css            ← HTML / PDF / PNG export only
```

| Location | Affects editor UI | Affects export |
|----------|-------------------|----------------|
| `Theme/*.css` (root) | Yes | No |
| `Theme/snippets/*.css` | Yes (stacked) | No |
| `Theme/export/*.css` | No | Yes (HTML, PDF, PNG) |

After adding or editing files, click **Rescan** in Preferences (or **Theme → Rescan Theme/*.css** on the menu bar) so Lunote picks up changes.

---

## External CSS theme (Obsidian-compatible)

1. Place a `.css` file in the **Theme** folder (not in `export/`).
2. In **Preferences → Appearance**, under **External CSS Theme**, choose the file from the dropdown.
3. Set **CSS Theme Compatibility** if needed:
   - **Native CSS only** — standard CSS as written.
   - **Auto-detect Obsidian themes** — better compatibility with many community Obsidian theme files.

Only **one** full external CSS theme is active at a time. Built-in theme tokens can still apply underneath depending on your settings.

---

## UI snippets

Snippets are extra `.css` files in `Theme/snippets/`. You can enable **multiple** snippets at once; they stack on top of the built-in theme and any active external CSS theme.

Use snippets for small tweaks (fonts, link colors, callout spacing) without replacing an entire Obsidian theme.

---

## Export-only CSS

Files in `Theme/export/` style **exported** HTML, PDF, and PNG output. They do **not** change the live editor.

Enable one or more export styles in **Preferences → Export**. Paper size, margins, and related export options live in the same area.

---

## Color presets (toolbar)

In **visual mode**, the toolbar may offer a **color preset** control for quick accent experiments in the browser preview build. On the **desktop app**, use the **Theme** menu and **Preferences → Appearance** for the full set of options.

---

## Tips

- **Editor looks wrong after importing an Obsidian theme:** Try **Auto-detect Obsidian themes**, rescan, or disable snippets one by one to find a conflict.
- **Export looks different from the editor:** That is expected if you use `Theme/export/` styles — tune export CSS separately.
- **Missing file warning:** If a saved theme path no longer exists, reselect the file or run **Rescan** after restoring it under `Theme/`.
