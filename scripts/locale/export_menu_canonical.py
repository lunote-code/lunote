#!/usr/bin/env python3
"""
Extract canonical menu manifest (action id + menu.* labelKey) from `src/menu/menu.schema.ts`.

Output: `scripts/menu_canonical.json` (for use by validate_menu_i18n_sync with documentation).

Run: python3 scripts/export_menu_canonical.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "src" / "menu" / "menu.schema.ts"
OUT = pathlib.Path(__file__).resolve().parent / "menu_canonical.json"

ITEM_RE = re.compile(
    r"""it\(\s*'([^']+)'\s*,\s*'(menu\.[^']+)'""",
)
SUB_RE = re.compile(
    r"""sub\(\s*'([^']+)'\s*,\s*'(menu\.[^']+)'""",
)
BAR_RE = re.compile(
    r"""barGroup\(\s*'([^']+)'\s*,\s*'(menu\.[^']+)'""",
)


def main() -> int:
    if not SCHEMA.is_file():
        print(f"missing {SCHEMA}", file=sys.stderr)
        return 1
    text = SCHEMA.read_text(encoding="utf-8")
    entries: list[dict[str, str]] = []
    seen: set[str] = set()
    for regex in (ITEM_RE, SUB_RE, BAR_RE):
        for m in regex.finditer(text):
            action_id, label_key = m.group(1), m.group(2)
            if label_key in seen:
                continue
            seen.add(label_key)
            entries.append({"actionId": action_id, "labelKey": label_key})
    entries.sort(key=lambda e: e["labelKey"])
    OUT.write_text(json.dumps({"entries": entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(entries)} keys -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
