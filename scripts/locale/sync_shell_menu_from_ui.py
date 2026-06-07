#!/usr/bin/env python3
"""
Filled with `menu.*` copy from `src/i18n/locales/<locale>.json` (shallow merge en)
`menu` section of `src-tauri/i18n/<locale>.json`, see `shell_menu_to_ui_key.py` for key mapping.

The tray / dialog / shell sections follow `src-tauri/i18n/en.json` (brand name, etc.).

Run: python3 scripts/sync_shell_menu_from_ui.py
"""
from __future__ import annotations

import json
import pathlib
import sys

_SCRIPTS = pathlib.Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from shell_menu_to_ui_key import build_map  # noqa: E402

ROOT = _SCRIPTS.parent.parent
TAURI_EN = ROOT / "src-tauri" / "i18n" / "en.json"
UI_EN = ROOT / "src" / "i18n" / "locales" / "en.json"
UI_DIR = ROOT / "src" / "i18n" / "locales"
OUT_DIR = ROOT / "src-tauri" / "i18n"

#Optional: `scripts/shell_menu_overrides/<locale>.json` only contains `{"menu": { "file_bar": "…" }}` to override UI synchronization results
OVERRIDE_DIR = ROOT / "scripts" / "shell_menu_overrides"


def load_json(path: pathlib.Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def merge_ui(en_ui: dict[str, str], loc_ui: dict[str, str]) -> dict[str, str]:
    out = dict(en_ui)
    for k, v in loc_ui.items():
        if isinstance(v, str):
            out[k] = v
    return out


def main() -> int:
    if not TAURI_EN.is_file() or not UI_EN.is_file():
        print("missing en template", file=sys.stderr)
        return 1

    shell_en = load_json(TAURI_EN)
    en_ui = load_json(UI_EN)
    if not isinstance(shell_en, dict) or not isinstance(en_ui, dict):
        print("bad root", file=sys.stderr)
        return 1
    shell_menu_en = shell_en["menu"]
    if not isinstance(shell_menu_en, dict):
        print("bad shell menu", file=sys.stderr)
        return 1

    en_ui_str = {k: v for k, v in en_ui.items() if isinstance(k, str) and isinstance(v, str)}
    menu_map = build_map()

    for ui_path in sorted(UI_DIR.glob("*.json")):
        lid = ui_path.stem
        if lid == "en":
            continue
        loc_raw = load_json(ui_path)
        if not isinstance(loc_raw, dict):
            print(f"{ui_path}: bad json", file=sys.stderr)
            return 1
        loc_str = {k: v for k, v in loc_raw.items() if isinstance(k, str) and isinstance(v, str)}
        merged_ui = merge_ui(en_ui_str, loc_str)

        new_menu: dict[str, str] = {}
        for sk, ui_key in menu_map.items():
            v = merged_ui.get(ui_key)
            if not isinstance(v, str) or not v.strip():
                v = str(shell_menu_en[sk])
            new_menu[sk] = v

        ov_path = OVERRIDE_DIR / f"{lid}.json"
        if ov_path.is_file():
            ov = load_json(ov_path)
            if isinstance(ov, dict) and isinstance(ov.get("menu"), dict):
                for k, v in ov["menu"].items():  # type: ignore[union-attr]
                    if isinstance(k, str) and isinstance(v, str) and v.strip():
                        new_menu[k] = v

        out_doc = json.loads(json.dumps(shell_en))
        assert isinstance(out_doc, dict)
        out_doc["menu"] = new_menu
        out_path = OUT_DIR / f"{lid}.json"
        out_path.write_text(json.dumps(out_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"synced shell menu from UI: {out_path.relative_to(ROOT)}")

    print("sync_shell_menu_from_ui: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
