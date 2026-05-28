# Compatibility Regression Baseline

This document fixes the compatibility contracts that must remain stable while the architecture is refactored.

## Contract Families

1. `parse <-> serialize`
   - Markdown does not drift when parsed and serialized without user edits.
   - Intentional blank lines, fenced code blocks, HTML comments, raw HTML, tables, footnotes, callouts, and wiki links stay structurally stable.
2. `visual <-> source`
   - Switching editor modes must not rewrite untouched documents.
   - Cursor anchor, visible section, and block boundaries should remain aligned enough for users not to lose context.
3. `save / reopen`
   - Saving an unchanged note must not introduce extra blank lines or remove Obsidian-compatible syntax.
   - Reopening after save must render the same semantic structure that was saved.
4. `vault graph / backlinks`
   - `[[wiki links]]`, rename propagation, backlinks, and graph indexing must survive create, rename, move, save, and external refresh flows.

## Long-Lived Debug Switches

- Keep blank-line lift diagnostics behind a dedicated debug switch.
- Keep document save / dirty reconciliation logs behind a dedicated debug switch.
- Keep workspace external refresh / indexing logs behind a dedicated debug switch.
- Remove one-off incident logs after the regression is covered by a fixture or a replayable scenario.

## Fixture Set

- `docs/compatibility-fixtures/typora-blank-lines.md`
- `docs/compatibility-fixtures/obsidian-vault-links.md`

## Acceptance Checklist

- No Markdown drift for untouched fixtures.
- No extra blank paragraph inserted on reopen for the Typora fixture.
- No lost wiki-link edges after rename / move for the Obsidian fixture.
- No silent save fallback when serialization fails.
- No full-workspace reindex calls from ad-hoc business code paths; reindexing must go through the shared coordinator.
