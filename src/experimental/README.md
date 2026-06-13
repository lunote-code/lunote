# Experimental modules

Code here is **not wired into production boot** and may be removed or rewritten.

| Module | Status | ADR |
|--------|--------|-----|
| `knowledgeCollaborationRuntime/` | Deferred — patch/cursor/presence prototypes | `docs/adr/0001-deferred-knowledge-collaboration.md` |

Do not import from `src/experimental/` in `src/app/` or production editor paths unless explicitly building an opt-in experiment.
