# Shortcuts & quick menus

Lunote gives you several ways to run commands without hunting through menus: the **menu bar**, **Command Palette**, **keyboard shortcuts**, the **`/` slash menu** in the editor, and **global search**.

Shortcut labels below use **macOS** first, then **Windows / Linux** when different.

| macOS | Windows / Linux |
|-------|-----------------|
| `Cmd` | `Ctrl` |
| `Option` | `Alt` |

---

## Command Palette

The Command Palette lists **app-wide** actions you can run by name (export, preferences, view toggles, etc.) — similar to Obsidian’s command palette.

| Action | Default shortcut |
|--------|------------------|
| Open Command Palette | `Cmd+Shift+P` · `Ctrl+Shift+P` |

1. Press the shortcut.
2. Type part of the command name (e.g. `export`, `focus`, `source`).
3. **↑ / ↓** to move, **Enter** to run, **Esc** to close.

The slash menu (`/`) does **not** replace the Command Palette. Use the palette for workspace and window actions; use `/` for inserting blocks while writing.

---

## Global search

Search **across files and note content** in the current workspace.

| Action | Default shortcut |
|--------|------------------|
| Global search | `Cmd+Shift+F` · `Ctrl+Shift+F` |

The search UI also reminds you of the Command Palette and in-document find shortcuts.

---

## Menu bar

On desktop, Lunote uses a classic menu bar:

| Menu | Examples |
|------|----------|
| **File** | New note, open folder, save, import/export, preferences |
| **Edit** | Undo/redo, clipboard, find & replace, emoji |
| **Paragraph** | Headings (H1–H6), lists, quote, code block, table, math |
| **Format** | Bold, italic, underline, strike, link, image, clear formatting |
| **View** | Source mode, focus mode, sidebars, search panel, zoom, fullscreen |
| **Window** | Minimize, zoom, tiling (platform-dependent) |
| **Theme** | Built-in theme, open Theme folder, rescan CSS |
| **Help** | About |

Assigned shortcuts appear on the right side of menu items.

---

## Customize keyboard shortcuts

Open **File → Preferences → Shortcuts** (`Cmd+,` / `Ctrl+,`).

- Click **Set shortcut** and press a new key combination.
- **Reset** one command or **Reset all to defaults**.
- Fix **conflicts** when two commands share the same keys.

Some entries are **read-only** (system defaults). A few commands use different keys on macOS vs Windows (redo, find next, etc.); the panel shows the effective binding for your OS.

### Frequently used shortcuts

| Command | macOS | Windows / Linux |
|---------|-------|-----------------|
| Preferences | `Cmd+,` | `Ctrl+,` |
| Save | `Cmd+S` | `Ctrl+S` |
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| Global search | `Cmd+Shift+F` | `Ctrl+Shift+F` |
| Find in document | `Cmd+F` | `Ctrl+F` |
| Find & replace | `Cmd+Option+F` | `Ctrl+H` |
| Toggle source / visual mode | `Cmd+/` | `Ctrl+/` |
| Focus mode | `F8` | `F8` |
| Bold / Italic / Underline | `Cmd+B` / `Cmd+I` / `Cmd+U` | `Ctrl+B` / `Ctrl+I` / `Ctrl+U` |

See **Preferences → Shortcuts** for the complete list.

---

## Slash menu (`/`)

In **visual editing** mode, the slash menu is the in-editor quick menu for **inserting content** into the current note.

### When it opens

- You are in **visual** mode (not raw source mode).
- The cursor is in a **normal paragraph** (empty line or after a space).
- You type **`/`** — the menu opens and filters as you keep typing.
- Examples: `/` at line start, or `hello /tab` after a space.

### When it does **not** open

- **Source mode** — use the menu bar, shortcuts, or Command Palette instead.
- Inside a **table cell**, **code block**, or other guarded editing contexts.
- When text is **selected** (non-empty selection).
- For **app-wide** actions (save, export, open folder) — use Command Palette or the menu bar.

### How to use it

| Key | Action |
|-----|--------|
| Type `/` | Open menu (optionally continue typing to filter) |
| `↑` / `↓` | Move highlight |
| `Enter` | Run highlighted command |
| `Esc` | Close without running |
| Mouse | Hover and click an item |

After you pick a command, Lunote removes the `/` trigger text (and any filter letters) from the paragraph as part of applying the command.

### Slash commands (current)

These are the commands registered in the visual editor slash menu. Type `/` plus a few letters of the **name** or **filter keyword** to narrow the list.

| Command | What it does | Filter examples |
|---------|----------------|-----------------|
| **bold** | Starts inline **bold** editing with placeholder text; press **Enter** to finish the formatted span | `bold` |
| **italic** | Starts inline *italic* editing (same Enter-to-finish behavior) | `italic` |
| **heading 1** | Turn the block into a level-1 heading | `h1`, `heading1`, `title` |
| **heading 2** | Turn the block into a level-2 heading | `h2`, `heading2` |
| **bullet list** | Start an unordered list | `list`, `ul`, `bullet` |
| **ordered list** | Start a numbered list | `ol`, `ordered` |
| **task list** | Start a checklist / task list | `task`, `todo`, `checkbox` |
| **code block** | Insert a fenced code block (default language `text`) | `code`, `codeblock`, `fence` |
| **table** | Insert a **3×3** table with a header row (or open the table insert UI if the advanced inserter is used) | `table`, `tbl` |
| **Knowledge base** | Insert `[[` and open the **wiki link** suggest menu to pick a note in the workspace | `wiki`, `link`, `doc`, `wikilink`, `kb` |
| **File link** | Open a file picker and insert a link to a local file in the workspace | `file`, `attach`, `attachment`, `filelink` |
| **footnote** | Insert a footnote reference | `footnote`, `fn`, `note` |
| **mermaid** | Insert a Mermaid diagram block with a small starter `graph TD` example | `mermaid`, `mmd` |
| **callout — tip** | Insert a tip-style callout block | `tip`, `hint`, `callout` |
| **callout — caution** | Insert a caution callout block | `caution`, `attention` |
| **callout — important** | Insert an important callout block | `important`, `critical` |
| **emoji & symbols** | Open the emoji picker | `emoji`, `emoticon`, `symbol` |

**Knowledge base → wiki links:** Choosing **Knowledge base** inserts `[[` and shows note suggestions. Pick a note with **↑ / ↓** and **Enter**, or click. This is the same family of links used for backlinks and the graph.

**File link:** Choosing **File link** opens the system file picker for a file in (or for) your workspace. If you cancel the picker, the `/` trigger is left intact so you can try again.

**Headings in the menu:** Only **heading 1** and **heading 2** appear in the slash menu. Use the **Paragraph** menu or **Preferences → Shortcuts** for H3–H6 and other block types (quote, horizontal rule, etc.).

### `/table` text command (not the slash menu)

Separate from the slash menu: in a paragraph whose text starts with **`/table`** (optional column DSL), press **Enter** at the **end of the line** to replace that paragraph with a table. If the DSL cannot be parsed, Lunote still inserts a default empty **3×3** table so you can keep working.

Use the slash menu item **table** for a quick default grid; use the **`/table` … Enter** flow when you want Typora-style table DSL input.

---

## Editor toolbar

The toolbar offers one-click formatting and mode controls. Shortcuts and `/` are usually faster once you know them; the toolbar is optional.

---

## Which tool should I use?

| Goal | Use |
|------|-----|
| Save, export, preferences, view layout | **Command Palette** or **menu bar** |
| Search all notes in the workspace | **Global search** |
| Insert a block while writing in visual mode | **Slash menu** (`/`) |
| Quick 3×3 table from the menu | **Slash → table** |
| Table from `/table` DSL text | Type `/table` … then **Enter** at line end |
| Link to another note | **Slash → Knowledge base** or type `[[` |
| Attach / link a file | **Slash → File link** |
| Change or learn key bindings | **Preferences → Shortcuts** |
