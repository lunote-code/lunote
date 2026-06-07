#!/usr/bin/env python3
"""Ensure Rust and JS consume the same Chrome executable candidate lists."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
JSON_PATH = ROOT / "scripts" / "export" / "chrome-executable-candidates.json"
RUST_PATH = ROOT / "src-tauri" / "src" / "chrome_candidates.rs"


def load_json_templates() -> dict[str, list[str]]:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    return {
        "darwin": list(data.get("darwin", [])),
        "win32": list(data.get("win32", [])),
        "linux": list(data.get("linux", [])),
        "linuxRelativeHome": list(data.get("linuxRelativeHome", [])),
        "linuxWhichBinaries": list(data.get("linuxWhichBinaries", [])),
    }


def load_js_templates() -> dict[str, list[str]]:
    script = """
import { listCandidateTemplates } from './scripts/lib/chrome-executable-candidates.mjs';
console.log(JSON.stringify(listCandidateTemplates()));
"""
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        raise SystemExit(f"node failed with exit code {proc.returncode}")
    return json.loads(proc.stdout.strip())


def main() -> int:
    if not JSON_PATH.is_file():
        print(f"missing {JSON_PATH}", file=sys.stderr)
        return 1
    if not RUST_PATH.is_file():
        print(f"missing {RUST_PATH}", file=sys.stderr)
        return 1

    rust_src = RUST_PATH.read_text(encoding="utf-8")
    if "chrome-executable-candidates.json" not in rust_src:
        print("chrome_candidates.rs must include chrome-executable-candidates.json", file=sys.stderr)
        return 1

    json_templates = load_json_templates()
    js_templates = load_js_templates()

    mismatches: list[str] = []
    for key in ("darwin", "win32", "linux", "linuxRelativeHome", "linuxWhichBinaries"):
        if json_templates.get(key) != js_templates.get(key):
            mismatches.append(key)

    if mismatches:
        print("Chrome candidate mismatch between JSON and JS:", ", ".join(mismatches), file=sys.stderr)
        return 1

    print("Chrome executable candidates: JSON, JS, and Rust include are aligned.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
