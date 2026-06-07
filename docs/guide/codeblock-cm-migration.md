# Code block → CodeMirror 6 migration

Replace ProseMirror contenteditable + imperative gutter sync with an embedded CodeMirror 6 editor inside the `codeBlock` NodeView. ProseMirror remains the document source of truth; CM owns editing UI (caret, line numbers, syntax highlight, keyboard).

## Status: Phase 3 complete

CM is **on by default**. Opt out with `?codeblockCm=0` or `localStorage.setItem('luna.codeBlock.cm', '0')`.

## Phases

| Phase | Scope | Regression gate |
|-------|--------|-----------------|
| **0** | `codeBlock/cm/*` foundation, Playwright E2E, `?qa=codeblock-cm` playground | `npm run test:codeblock` |
| **1** | CM in `LunaCodeBlockView`, PM↔CM sync, `stopEvent` | Phase 0 gate |
| **2** | Keyboard parity, PM undo, chip→CM focus | `verify:codeblock:phase2` |
| **3** | Remove gutter/lowlight editing path, CM browser QA | `verify:codeblock:phase3` ✅ |

## Enable / disable CM

- **Default:** on
- **Force off:** `?codeblockCm=0`, `localStorage luna.codeBlock.cm=0`, or `VITE_CODEBLOCK_CM=0`
- **Force on:** `?codeblockCm=1`, `VITE_CODEBLOCK_CM=1`

## Regression checklist

```bash
npm run verify:codeblock:phase3    # Playwright code block E2E + mode-switch contract
npm run test:codeblock             # Playwright only (starts dev server automatically)
```

## PM ↔ CM sync

1. **CM → PM**: deferred `updateListener` (microtask) → minimal text patch — never dispatch PM inside CM’s DOM flush
2. **PM → CM**: deferred `view.dispatch({ changes })` on microtask; skip while `compositionStarted`
3. **Trailing empties**: PM collapse plugin skips transactions tagged `codeBlockCmOrigin`; CM Enter is not capped at EOF
4. **IME**: CM→PM flush waits for `compositionend` when composing
5. **contentDOM**: hidden `pm-code-block-pm-mirror` (`NodeViewContent`) keeps PM text in-tree while CM owns editing
6. **Undo**: CM forwards `Mod-z`/`Mod-y` to Tiptap; edits sync with PM history

## Removed in Phase 3

- `useCodeBlockGutterLayout.ts`, `codeBlockGutterDom.ts`, `codeBlockGutterDebug.ts`
- `phantomLineDiagnostic.ts`, `QaCodeBlockGutterPlayground.tsx`
- Real-time `LunaLowlightPlugin` in `LunaCodeBlock` (CM syntax + static `renderHTML` hljs for export)

## Legacy opt-out

When CM is disabled and block is expanded, a minimal contenteditable `NodeViewContent` path remains (no gutter). Folded blocks show toolbar + hint only.
