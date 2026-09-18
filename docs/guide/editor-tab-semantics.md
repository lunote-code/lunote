# Editor Tab key semantics (visual vs source)

Lunote has **two editing surfaces** for the same note. The **Tab** and **Shift-Tab** keys behave differently in each mode. This is intentional: visual mode edits a structured document; source mode edits plain Markdown text.

## Quick reference

| Context | Visual mode (TipTap) | Source mode (CodeMirror) |
|---------|----------------------|---------------------------|
| Bullet / ordered / task list | **Nest** or **lift** list items (`sinkListItem` / `liftListItem`) | Add or remove **4 spaces** at the **line start** |
| Paragraph / heading | Insert **4 spaces** at the caret (or indent each selected line) | Same: **4 spaces** at line start |
| Code block (embedded CM) | CodeMirror: **4-space** indent / outdent | Fence body: **4-space** indent / outdent |
| Table cell | Handled by the table extension (not plain Tab spaces) | Not applicable in the same way |
| Mermaid source island | Tab is isolated (no document indent) | — |

**Modifier:** On macOS use **Tab** / **Shift-Tab**; the app does not remap these per platform for editor indentation.

## Visual mode — structure-first

In the rendered editor, a bullet list is a real list in the document tree—not just lines that start with `-`.

- **Tab** on a list item tries to **nest** it under the previous item (one level deeper).
- **Shift-Tab** tries to **lift** it to the parent list or out to a paragraph.
- If nesting fails (for example at a task-list checkbox boundary), Tab may fall back to inserting **four spaces** at the caret so focus does not jump to the checkbox.

Ordinary paragraphs and headings do not use list nesting: **Tab** inserts four spaces (per line when multiple lines are selected).

### Block-level Select All (`Cmd+A` / `Ctrl+A`)

In visual mode, **Select All** is **block-scoped**, not whole-document:

| Block type | What gets selected |
|------------|-------------------|
| Paragraph / heading | Text inside the current block |
| List item / task item | Text inside the current item |
| Callout / blockquote | Text inside the block |
| Code block (CM focused) | Entire code in the embedded editor |
| Table | Current cell (or cell selection) |

After Select All, you can type to replace the selection or press Delete/Backspace to clear it.

## Source mode — Markdown-first

Source mode shows the **on-disk Markdown**. Tab does not change the ProseMirror list tree; it edits **characters**:

- **Tab** on a list line adds **four spaces** before the line content (Markdown nested-list convention).
- **Shift-Tab** removes up to four leading spaces on the line(s).
- **Shift-Tab** on a plain paragraph (no leading spaces) does nothing.

Switching **visual → source → visual** preserves content, but list **nesting you created with Tab in visual mode** is stored as structure; nesting you created with Tab in source mode is stored as **leading spaces**. Both are valid Markdown and usually round-trip correctly, but the **editing feel** differs.

## Practical workflow tips

1. **Prefer visual Tab** when you want Obsidian/Typora-style list nesting without thinking about spaces.
2. **Prefer source Tab** when you are aligning raw Markdown (for example pasting indented snippets or fixing `README` code blocks).
3. After mode switch, check list depth if the note mixes both styles—especially for task lists and deeply nested bullets.
4. **Embedded code blocks** always use CodeMirror Tab rules when the code editor is focused, in both visual and source document modes.
5. **`Cmd+/` / `Ctrl+/`** toggles the **full document** between visual and source. It does not switch a single code, Mermaid, or math island.

## Related docs

- [Shortcuts & quick menus](shortcuts-and-menus.md) — mode toggle (**`Cmd+/`** / **`Ctrl+/`**), Select All, clipboard
- [Platform differences](platform-differences.md) — OS-specific shortcut labels
- Mode switch regression: `npm run test:mode-switch` and `npm run test:mode-switch-contract`

## Automated coverage

| Test | What it checks |
|------|----------------|
| `scripts/test/document-editor/document-list-interaction.spec.ts` | Visual list Tab / Shift-Tab / paste |
| `scripts/test/document-editor/document-block-select-all.spec.ts` | Mod+A on list items and callouts |
| `scripts/test/mode-switch/mode-switch-tab-semantics.spec.ts` | Visual nest vs source space indent |
| `scripts/test/document-editor/document-tab-indent.spec.ts` | Paragraph Tab in visual mode |
