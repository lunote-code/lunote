# Scripts layout

Scripts under `scripts/` that **CI** (`.github/workflows/ci.yml`) or **release** (`.github/workflows/release.yml`) need stay tracked in Git.  
Everything listed under [Gitignored (local only)](#gitignored-local-only) is in `.gitignore` and is not uploaded to GitHub.

## Published (`scripts/`)

| Script | Used by | Purpose |
|--------|---------|---------|
| `build_ui_locales.py` | CI | Build sparse UI locale JSON from corpus + patches |
| `sync_shell_menu_from_ui.py` | CI | Sync Rust shell menu strings from UI locales |
| `shell_menu_to_ui_key.py` | CI | Shell menu field → UI locale key mapping |
| `export_menu_canonical.py` | CI | Export canonical menu JSON |
| `export_menu_rust_manifest.py` | CI | Generate Rust menu manifest |
| `validate_menu_i18n_sync.py` | CI | Menu i18n sync checks |
| `validate_menu_runtime.py` | CI | Runtime menu contract |
| `validate_locale.py` | CI | Locale file validation |
| `validate_shell_locale.py` | CI | Shell locale validation |
| `menu_canonical.json` | CI | Menu canonical data |
| `locale_corpus/` | CI | UI translation corpus + gap files |
| `ui_locale_patches/` | CI | Per-locale UI patches merged at build |
| `shell_menu_overrides/` | CI | Optional shell menu overrides |
| `lib/locale_contract.py` | CI | Shared locale/menu contracts |
| `lib/render-html-pdf-core.mjs` | npm | PDF export core |
| `render-html-pdf.mjs` | npm | HTML → PDF CLI |
| `prepare-signing.mjs` | release | Signing prep |
| `sign-deb.mjs` | release | Debian package signing |
| `tauri-build-windows.mjs` | release | Windows Tauri build |
| `sync-version.mjs` | release | Version sync across manifests |
| `release-publish.mjs` | release | Release publish helper |
| `import-windows-certificate.ps1` | release | Windows cert import |
| `apply_missing_ui_locale_batch.py` | maintainer | Merge `locale_corpus/data/missing_ui_keys_batch.json` into UI corpus |
| `locale_corpus/data/missing_ui_keys_batch.json` | corpus | Batched UI strings (export/theme/knowledge rail) |

## Gitignored (local only)

Listed in the root `.gitignore`. Keep copies locally; they are not required for GitHub Actions.

| Path | Purpose |
|------|---------|
| `scripts/maintenance/` | README / i18n / sponsor / icon maintainer tooling |
| `scripts/run-mode-switch-regression.mjs` | Editor mode-switch regression runner (`npm run regression:mode-switch*`) |
| `scripts/run-mode-switch-contract-tests.mjs` | Mode-switch contract tests (`npm run test:mode-switch-contract`) |
| `scripts/mode-switch-regression-baseline.json` | Regression baseline snapshot |
| `scripts/mode-switch-regression-history.json` | Regression history log |

### `scripts/maintenance/`

Copy or keep this folder locally.

| Script | Purpose |
|--------|---------|
| `validate_readme_locales.py` | Validate docs README structure/anchors |
| `patch_readme_tail_sections.py` | Insert dev/license/star/keywords tail blocks |
| `gen_zh_tw_readme_from_zh_cn.py` | Regenerate `docs/README.zh-TW.md` from 简体 |
| `sync_sponsor_to_readmes.py` | Sync TRC20 address from `data/sponsor.json` |
| `gen_zh_tw_from_zh_cn.py` | Generate `zh-TW.json` from `zh-CN.json` |
| `fill_locale_gaps.py` | Merge gap translations into corpus + rebuild |
| `build_ui_patch_from_shell_override.py` | Build UI patches from shell overrides |
| `translate_strings_to_en.py` | Translate CJK string literals in source |
| `translate_comments_to_en.py` | Translate CJK comments in source |
| `generate_app_icons.py` | Regenerate app icon assets |
| `validate_ui_locale.py` | Extra UI locale checks |
| `validate_shortcut_registry.py` | Shortcut registry validation |
| `lib/readme_docs_contract.py` | README validation contract |
| `data/sponsor.json` | TRC20 USDT address (private — do not commit) |
| `data/readme_tail_sections.json` | Tail section templates per locale |
| `data/zh_cn_to_zh_tw_*.json` | 简繁 phrase tables |

**Common commands** (from repo root, with `scripts/maintenance/` present locally):

```bash
python3 scripts/maintenance/validate_readme_locales.py
python3 scripts/maintenance/sync_sponsor_to_readmes.py
npm run validate:readme-locales
npm run sync:sponsor
```
