# Knowledge graph

The graph is a **view of wiki links** in the current workspace. It is not a separate database: `[[wiki links]]` in Markdown are the source of truth.

Open it from the **knowledge rail** (right side) while a note is active.

## Local vs Global

| Mode | What you see |
|------|----------------|
| **Local** (default) | A subgraph centered on the open note. Change depth and filters to include neighbors, backlinks, and unresolved links. |
| **Global** | Linked notes across the workspace, up to the performance cap. |
| **Fullscreen** | The same graph in a larger canvas (local or global). |

Switching workspaces clears the previous vault’s nodes. Deleted links disappear after the note is saved.

## Performance caps

Large vaults are truncated so the layout stays usable. Choose a tier in the graph toolbar:

| Tier | Max nodes | Max edges |
|------|-----------|-----------|
| Compact | 120 | 200 |
| Standard | 250 | 400 |
| Extended (default) | 400 | 700 |

This is **not** an unlimited whole-vault graph like Obsidian’s Graph view. If a cap is hit, Lunote shows a limit notice; tighten filters or pick a smaller neighborhood.

## What you can do

- Click a node to open that note.
- Drag between nodes to create a wiki link; remove a link from the graph toolbar when the note is editable.
- Filter by folder, recent activity, or unresolved links.
- Export the current view as SVG or PNG from the graph toolbar.

Related: [Shortcuts](shortcuts-and-menus.md) (`[[` wiki links, Command Palette) · [Editor Tab semantics](editor-tab-semantics.md)
