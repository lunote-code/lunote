"""Load zh-CN Edit P0 menu labels from locale JSON (single source of truth)."""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
UI_ZH = ROOT / "src" / "i18n" / "locales" / "zh-CN.json"
SHELL_ZH = ROOT / "src-tauri" / "i18n" / "zh-CN.json"

EDIT_P0_SHELL_KEYS: tuple[str, ...] = (
    "edit_undo",
    "edit_redo",
    "edit_cut",
    "edit_copy",
    "edit_paste",
    "edit_select_all",
)

EDIT_P0_SHELL_TO_UI_KEY: dict[str, str] = {
    "edit_undo": "menu.edit.undo",
    "edit_redo": "menu.edit.redo",
    "edit_cut": "menu.edit.cut",
    "edit_copy": "menu.edit.copy",
    "edit_paste": "menu.edit.paste",
    "edit_select_all": "menu.edit.selectAll",
}


def load_json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def zh_cn_edit_p0_ui_expected() -> dict[str, str]:
    ui = load_json(UI_ZH)
    out: dict[str, str] = {}
    for shell_key, ui_key in EDIT_P0_SHELL_TO_UI_KEY.items():
        val = ui.get(ui_key)
        if not isinstance(val, str) or not val.strip():
            raise KeyError(f"Missing zh-CN UI label for {ui_key!r} ({shell_key})")
        out[ui_key] = val
    return out


def zh_cn_edit_p0_shell_expected() -> dict[str, str]:
    menu = load_json(SHELL_ZH).get("menu")
    if not isinstance(menu, dict):
        raise KeyError("Missing menu section in src-tauri/i18n/zh-CN.json")
    out: dict[str, str] = {}
    for shell_key in EDIT_P0_SHELL_KEYS:
        val = menu.get(shell_key)
        if not isinstance(val, str) or not val.strip():
            raise KeyError(f"Missing zh-CN shell label for {shell_key!r}")
        out[shell_key] = val
    return out
