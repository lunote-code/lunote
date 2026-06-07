# Release packaging & signing

How [`.github/workflows/release.yml`](../.github/workflows/release.yml) builds installers and which **GitHub Actions secrets** are optional.

## Triggers

| Event | Behavior |
|-------|----------|
| Push tag `v*` (e.g. `v0.5.0`) | Full release pipeline on that tag |
| `workflow_dispatch` | Manual run; set tag input; optional draft release |

Before tagging:

```bash
npm run version:sync
npm run version:check
```

## Artifacts

| Job | Runner | Output |
|-----|--------|--------|
| `build-dmg` | `macos-14` | `.dmg` (Apple Silicon, ad-hoc signed) |
| `build-msi` | `windows-2022` / `windows-11-arm` | `.msi` x64 / arm64 |
| `build-deb` | `ubuntu-22.04` | `.deb` (+ optional `.deb.asc`) |

`verify-build` smoke-checks `cargo check` on additional OS images.  
`publish` attaches artifacts from jobs that succeeded (`continue-on-error` on build jobs).

## Release notes (automatic)

The `publish` job sets `generate_release_notes: true` on [softprops/action-gh-release](https://github.com/softprops/action-gh-release). GitHub appends categorized notes **after** the fixed “Downloads” section in the workflow `body`.

Configuration: [`.github/release.yml`](../.github/release.yml).

| PR label (examples) | Release section |
|---------------------|-----------------|
| `bug`, `fix` | Bug Fixes |
| `enhancement`, `feature` | Features |
| `documentation`, `docs` | Documentation |
| `dependencies` | Dependencies |
| `chore`, `ci`, `refactor` | Maintenance |
| (none / other) | Other Changes |
| `ignore-for-release` | Excluded |

**Practice:** merge via pull request and add one label before merge. Optional PR template: [`.github/pull_request_template.md`](../.github/pull_request_template.md).

Create matching labels in the GitHub repo (**Settings → Labels**) if they do not exist yet (`bug`, `fix`, `enhancement`, `documentation`, `dependencies`, `chore`, …).

## GitHub Secrets (optional)

### Windows Authenticode

| Secret | Purpose |
|--------|---------|
| `WINDOWS_CERTIFICATE` | Base64 `.pfx` (`scripts/release/import-windows-certificate.ps1`) |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX password |
| `WINDOWS_CERTIFICATE_THUMBPRINT` | Thumbprint for `prepare-signing.mjs` |

If unset, MSI builds run **unsigned**.

### Linux DEB (GPG detached signature)

| Secret | Purpose |
|--------|---------|
| `GPG_PRIVATE_KEY` | ASCII-armored key (`scripts/release/sign-deb.mjs`) |
| `GPG_KEY_ID` | Signing key id |
| `GPG_PASSPHRASE` | Passphrase if required |

If unset, `.deb` ships **without** `.deb.asc`.

### macOS

No secrets. Release uses ad-hoc signing (`APPLE_SIGNING_IDENTITY: '-'`).

## CI alignment

Push/PR runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): locale corpus is applied on every job that compiles the app. The `locale-and-scripts` job also runs:

- `npm run validate:git-publish-paths` — fail if local-only paths (e.g. `scripts/maintenance/`) are tracked
- `npm run validate:mac-menu-assets` — fail if `public/mac-menu-icons/` PNGs are missing or out of sync
- `npm run validate:app-icons` — fail if `src-tauri/icons/` bundle assets are missing, wrong size, or out of sync with `icon.svg`
- `npm run validate:release-config` — guard release workflow / `.github/release.yml` structure

After changing `scripts/locale_corpus/` or menu sources, regenerate and commit:

```bash
python3 scripts/locale/build_ui_locales.py
python3 scripts/locale/sync_shell_menu_from_ui.py
python3 scripts/locale/export_menu_canonical.py
python3 scripts/locale/export_menu_rust_manifest.py
node scripts/build/generate_mac_menu_boot.mjs
```

When changing menu icon mappings, also run `npm run export:mac-menu-icons` and commit `public/mac-menu-icons/`.

Signing files (`*.pem`, `*.p12`, `signing/`) stay **gitignored**.

## First push (stage via `.gitignore`)

Do **not** hand-pick paths. Root [`.gitignore`](../.gitignore) already excludes local-only and build artifacts; Git will refuse to stage them.

**Ignored (never uploaded):** `node_modules/`, `dist/`, `src-tauri/target/`, `.env*`, `signing/`, `scripts/sponsor.json` (real wallet), `tmp/`, `.cursor/`, `.venv-*/`, `docs/compatibility|qa|adr/`, `scripts/maintenance/`, `scripts/test/`, `scripts/locale/apply_*.py`, `scripts/locale_corpus/data/`, OS junk (`.DS_Store`, `Thumbs.db`), etc.

**Must be present after `git add .`:** `.github/`, `package.json`, `package-lock.json`, `version.json`, Published `scripts/` ([list](../scripts/README.md#published-on-github)), `src/`, `src-tauri/` (without `target/`), `public/mac-menu-icons/*.png` (run `npm run export:mac-menu-icons` when menu icons change), `src-tauri/resources/mac-menu-boot.json` (regenerated with locale pipeline).

```bash
# 1. Align generated locale/menu files with the corpus
python3 scripts/locale/build_ui_locales.py
python3 scripts/locale/sync_shell_menu_from_ui.py
python3 scripts/locale/export_menu_canonical.py
python3 scripts/locale/export_menu_rust_manifest.py

# 2. Stage tracked files only — .gitignore blocks the rest automatically
git add .

# 3. Sanity check before commit
git status
git check-ignore -v node_modules scripts/maintenance docs/qa src-tauri/target scripts/sponsor.json .cursor
python3 scripts/validate/validate_git_publish_paths.py
```

If `git status` shows paths you did not intend to publish, add a rule to `.gitignore` (do not force-add with `git add -f` unless you mean it).

```bash
git commit -m "Initial commit: Lunote app and CI"
git push -u origin main
```
