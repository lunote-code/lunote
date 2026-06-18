#!/usr/bin/env python3
"""Fail if git tracks paths that must stay local (guard against git add -f).

Run from repo root:
  python3 scripts/validate/validate_git_publish_paths.py
  python3 scripts/validate/validate_git_publish_paths.py --fix
"""
from __future__ import annotations

import argparse
import fnmatch
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Prefixes (directories) that must never appear in the index.
FORBIDDEN_PREFIXES: tuple[str, ...] = (
    "docs/compatibility/",
    "docs/qa/",
    "docs/adr/",
    "scripts/maintenance/",
    "scripts/test/",
    "scripts/locale_corpus/data/",
    "signing/",
    "node_modules/",
    "dist/",
    "dist-ssr/",
    "src-tauri/target/",
    "tmp/",
    ".cursor/",
    ".venv-i18n/",
)

# Exact files or glob patterns that must not be tracked.
FORBIDDEN_PATTERNS: tuple[str, ...] = (
    ".env",
    ".env.*",
    "scripts/sponsor.json",
    "scripts/test/run-all-tests.mjs",
    "scripts/test/run-case/run-*.mjs",
    "scripts/locale/apply_*.py",
    "scripts/locale/apply_*.mjs",
    "scripts/test/mode-switch/regression-baseline.json",
    "scripts/test/mode-switch/regression-history.json",
    "*.pem",
    "*.p12",
    "*.pfx",
)


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace").strip()
        if "not a git repository" in stderr:
            print("No git repository; skipping publish-paths check.")
            return []
        print(f"validate_git_publish_paths: git ls-files failed: {stderr}", file=sys.stderr)
        sys.exit(2)
    return [p.decode("utf-8") for p in result.stdout.split(b"\0") if p]


def is_forbidden(path: str) -> bool:
    normalized = path.replace("\\", "/")
    for prefix in FORBIDDEN_PREFIXES:
        if normalized == prefix.rstrip("/") or normalized.startswith(prefix):
            return True
    for pattern in FORBIDDEN_PATTERNS:
        if fnmatch.fnmatch(normalized, pattern):
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Remove forbidden paths from the git index (git rm --cached); keeps files on disk.",
    )
    args = parser.parse_args()

    violations = sorted(p for p in tracked_files() if is_forbidden(p))
    if not violations:
        print("No forbidden publish paths are tracked by git.")
        return 0

    if args.fix:
        for path in violations:
            result = subprocess.run(
                ["git", "rm", "--cached", "--", path],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                print(f"git rm --cached failed for {path}: {result.stderr.strip()}", file=sys.stderr)
                return 2
            print(f"removed from index: {path}")
        print("\nCommit the index change, then re-run validate:git-publish-paths.")
        return 0

    print("Forbidden paths are tracked (remove with git rm --cached):", file=sys.stderr)
    for path in violations:
        print(f"  {path}", file=sys.stderr)
    print(
        "\nSee .gitignore and scripts/README.md § Published on GitHub.",
        file=sys.stderr,
    )
    print(
        "\nAuto-fix: npm run fix:git-publish-paths  (or python3 scripts/validate/validate_git_publish_paths.py --fix)",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
