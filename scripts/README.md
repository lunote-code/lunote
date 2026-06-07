# Scripts (`scripts/`)

Automation for **CI**, **release**, and **local development**.  
Only paths listed under [Published on GitHub](#published-on-github) are committed; everything else stays on your machine (see [.gitignore](../.gitignore)).

## Directory map

```text
scripts/
├── README.md                    ← this file
├── sponsor.json.example
│
├── build/                       # Version sync, mac menu boot, Vite plugin
│   ├── sync-version.mjs
│   ├── generate_mac_menu_boot.mjs
│   ├── export_mac_menu_icons.mjs
│   └── vite-luna-debug-log-plugin.ts
│
├── locale/                      # CI locale & menu pipeline (published)
│   ├── build_ui_locales.py
│   ├── sync_shell_menu_from_ui.py
│   ├── export_menu_*.py
│   ├── validate_*.py            # menu/locale validators
│   ├── shell_menu_to_ui_key.py
│   ├── menu_canonical.json
│   └── apply_*.{py,mjs}         # local maintainer batches (gitignored)
│
├── export/                      # PDF export
│   ├── render-html-pdf.mjs
│   └── chrome-executable-candidates.json
│
├── release/                     # Tauri bundle & publish
│   ├── prepare-signing.mjs
│   ├── sign-deb.mjs
│   ├── tauri-build-windows.mjs
│   ├── release-publish.mjs
│   ├── validate_release_config.mjs
│   └── import-windows-certificate.ps1
│
├── validate/                    # Repo validation (published)
│   ├── validate_git_publish_paths.py
│   ├── validate_chrome_candidates.py
│   ├── validate_mac_menu_assets.mjs
│   └── run-release-config-tests.mjs
│
├── test/                        # Playwright E2E + legacy harness runners
│   ├── README.md                # Test layout & commands
│   ├── lib/                     # Shared Playwright helpers
│   ├── codeblock/               # Code block CM specs
│   ├── document-editor/         # Editor syntax specs
│   ├── test-results/            # Playwright output (gitignored)
│   └── run-*.mjs                # Legacy harness (gitignored)
│
├── lib/                         # Shared Python/JS helpers
├── locale_corpus/               # UI string corpus + gaps
├── ui_locale_patches/
├── shell_menu_overrides/
└── maintenance/                 # README/i18n maintainer tools (gitignored)
```

---

## Published on GitHub

Required by [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [release](../.github/workflows/release.yml), or `package.json` scripts that are **not** under `maintenance/` or `test/`.

### CI — locales & menus (`scripts/locale/`)

| Path | Role |
|------|------|
| `locale/build_ui_locales.py` | Build `src/i18n/locales/*.json` from corpus |
| `locale/sync_shell_menu_from_ui.py` | Sync Rust shell menu strings from UI locales |
| `locale/shell_menu_to_ui_key.py` | Shell menu field → UI locale key map |
| `locale/export_menu_canonical.py` | Export `locale/menu_canonical.json` |
| `locale/export_menu_rust_manifest.py` | Generate Rust menu manifest |
| `locale/validate_menu_i18n_sync.py` | Menu i18n sync checks |
| `locale/validate_menu_runtime.py` | Runtime menu contract |
| `locale/validate_locale.py` | UI locale validation (`--strict` in CI) |
| `locale/validate_shell_locale.py` | Shell locale schema |
| `locale/menu_canonical.json` | Canonical menu data |
| `locale_corpus/ui/` | Per-locale UI string corpus |
| `locale_corpus/gaps/` | Gap-fill translations merged at build |
| `ui_locale_patches/` | Per-locale overrides merged at build |
| `shell_menu_overrides/` | Optional shell menu overrides |
| `lib/locale_contract.py` | Shared locale/menu contracts |

### CI / npm — build & export

| Path | Role |
|------|------|
| `build/sync-version.mjs` | `npm run version:sync` / `version:check` |
| `build/generate_mac_menu_boot.mjs` | `src-tauri/resources/mac-menu-boot.json` |
| `build/export_mac_menu_icons.mjs` | `public/mac-menu-icons/*.png` |
| `export/render-html-pdf.mjs` | `npm run export:pdf` |
| `export/chrome-executable-candidates.json` | PDF browser path list |
| `lib/render-html-pdf-core.mjs` | PDF export core |
| `lib/chrome-executable-candidates.mjs` | Shared Chrome path list |
| `locale/sync_sponsor_to_readmes.py` | Sync TRC20 sponsor into READMEs |
| `locale/append_sponsor_to_readmes.py` | Append sponsor section (wrapper) |
| `sponsor.json.example` | Template for local `maintenance/data/sponsor.json` |

### Release (`scripts/release/`)

| Path | Role |
|------|------|
| `release/prepare-signing.mjs` | `npm run release:prepare-signing` |
| `release/sign-deb.mjs` | `npm run release:sign-deb` |
| `release/tauri-build-windows.mjs` | `npm run tauri:build:win` |
| `release/release-publish.mjs` | `npm run release:publish` |
| `release/validate_release_config.mjs` | Guard release workflow files |
| `release/import-windows-certificate.ps1` | Windows cert import |

### Validation (`scripts/validate/`)

| Path | Role |
|------|------|
| `validate/validate_git_publish_paths.py` | Fail if git index tracks local-only paths |
| `validate/validate_chrome_candidates.py` | Rust/JS Chrome path list parity |
| `validate/validate_mac_menu_assets.mjs` | macOS menu PNG assets vs registry |
| `validate/validate_mac_menu_boot.mjs` | mac-menu-boot.json macOS accelerators |
| `validate/run_platform_ci_contract_tests.mjs` | Platform/CI contract tests |
| `validate/verify_locale_pipeline.mjs` | Locale pipeline + git cleanliness |
| `validate/verify_github_ci.mjs` | Full CI job mirror (`npm run verify:ci`) |

---

## Local only (not uploaded)

| Pattern / path | Purpose |
|----------------|---------|
| `scripts/maintenance/` | README/i18n maintainer scripts + `data/` |
| `scripts/test/` | Playwright E2E specs; `run-*.mjs` legacy harness (gitignored) |
| `scripts/test/run-*.mjs` | Invoked via `npm run test:*` / `regression:*` |
| `scripts/locale/apply_*.py` | One-off corpus merge utilities |
| `scripts/locale_corpus/data/` | Maintainer batch JSON |
| `scripts/**/__pycache__/`, `scripts/**/*.pyc` | Python bytecode |

**Common commands** (repo root):

```bash
python3 scripts/locale/build_ui_locales.py
python3 scripts/locale/validate_locale.py --strict
npm run verify:ci
npm run verify:ci:smoke
python3 scripts/validate/validate_git_publish_paths.py
npm run validate:mac-menu-assets
npm run test:codeblock             # Playwright: code block
npm run test:document-editor       # Playwright: editor syntax
npm run test:e2e                   # All Playwright tests
```

---

## CI / Release (GitHub Actions)

| Action | Used in |
|--------|---------|
| [`.github/actions/locale-pipeline`](../.github/actions/locale-pipeline/) | `ci.yml`, `release.yml` |

After editing `locale_corpus/` or menu sources, run the locale pipeline locally (see [packaging-strategy.md](../docs/packaging-strategy.md)), then `git add .`.

## Related docs

| Area | Index |
|------|--------|
| User-facing docs | [docs/README.md](../docs/README.md) |
| Release packaging | [docs/packaging-strategy.md](../docs/packaging-strategy.md) |
