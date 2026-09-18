# Templates (English reference)

This folder ships **English** starter templates for documentation and copy-paste. They mirror the `en` locale in `src/templates/defaultNoteContent.ts`.

| File | Purpose |
|------|---------|
| [Default.md](Default.md) | New note (`Templates/Default.md` in a workspace) |
| [Daily.md](Daily.md) | Daily note (`Templates/Daily.md` in a workspace) |

When you open a workspace, Lunote creates `Templates/Default.md` and `Templates/Daily.md` **only if missing**, using the **current UI language** (not necessarily these English files). Edit templates in the app via **File → Templates**, or directly in your vault’s `Templates/` folder.

**New-note templates are optional.** In **Preferences → Templates**, you can turn them off. Then **New note** uses the built-in blank note, and Lunote **does not** auto-create a `Templates/` folder. Daily notes can stay enabled independently; they still use `Templates/Daily.md` when that daily-note setting is on.

Supported template variables: `{{title}}`, `{{filename}}`, `{{folder}}`, `{{vaultName}}`, `{{date:…}}`, `{{time:…}}`.
