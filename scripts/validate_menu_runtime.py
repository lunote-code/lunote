#!/usr/bin/env python3
"""
Menu runtime verification (CI) for the in-app React menu architecture:
- Rust `app_menu.rs` keeps native shell handlers only (no Tauri top-bar menu build)
- zh-CN Edit P0: no English leak / fallback in UI + shell locales
- React menu compiler guard + no forbidden fallback render paths

Run:
  python3 scripts/export_menu_canonical.py
  python3 scripts/export_menu_rust_manifest.py
  python3 scripts/validate_menu_runtime.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

_SCRIPTS = pathlib.Path(__file__).resolve().parent
_LIB = _SCRIPTS / "lib"
if str(_LIB) not in sys.path:
    sys.path.insert(0, str(_LIB))

from locale_contract import (  # noqa: E402
    EDIT_P0_SHELL_KEYS,
    zh_cn_edit_p0_ui_expected,
)

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP_MENU_RS = ROOT / "src-tauri" / "src" / "app_menu.rs"
MENU_MANIFEST_RS = ROOT / "src-tauri" / "src" / "menu_manifest.rs"
UI_ZH = ROOT / "src" / "i18n" / "locales" / "zh-CN.json"
SHELL_EN = ROOT / "src-tauri" / "i18n" / "en.json"
SHELL_ZH = ROOT / "src-tauri" / "i18n" / "zh-CN.json"
COMPILE_TS = ROOT / "src" / "menu" / "menu.compile.ts"
MENU_LABEL_TS = ROOT / "src" / "i18n" / "menuLabel.ts"
ENFORCER_TS = ROOT / "src/menu/menu.enforcer.ts"

ZH_EDIT_P0_EXPECTED: dict[str, str] = zh_cn_edit_p0_ui_expected()
ZH_EDIT_P0_FORBIDDEN_EN = frozenset({"Undo", "Redo", "Cut", "Copy", "Paste", "Select All"})
RUST_EDIT_P0_SHELL_KEYS = EDIT_P0_SHELL_KEYS

MENU_ITEM_ID_RE = re.compile(
    r"""menu_item\s*\(\s*&menu_handle\s*,\s*"([^"]+)"\s*,""",
)

FALLBACK_RENDER_PATTERNS = (
    r"⚠ missing",
    r"⚠ en leak",
    r"dev en fallback",
    r"return enVal",
    r"isDev\(\) && enVal",
)

LEGACY_RUST_MENU_MARKERS = (
    "pub fn compiled_app_menu",
    "pub fn build_app_menu(",
    "fn build_app_menu_inner",
    "SubmenuBuilder",
    "PredefinedMenuItem::",
)


def load_json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def rust_menu_item_ids() -> set[str]:
    return set(MENU_ITEM_ID_RE.findall(APP_MENU_RS.read_text(encoding="utf-8")))


def manifest_action_ids() -> set[str]:
    text = MENU_MANIFEST_RS.read_text(encoding="utf-8")
    block = text.split("REQUIRED_MENU_ACTION_IDS")[1].split("];")[0]
    return set(re.findall(r'"([^"]+)"', block))


def check_react_native_app_menu(errors: list[str]) -> None:
    text = APP_MENU_RS.read_text(encoding="utf-8")
    if "handle_native_shell_menu" not in text:
        errors.append("app_menu.rs: missing handle_native_shell_menu() for native shell items")
    for marker in LEGACY_RUST_MENU_MARKERS:
        if marker in text:
            errors.append(
                f"app_menu.rs: legacy Rust top-bar menu marker {marker!r} — use in-app React menu"
            )
    if rust_menu_item_ids():
        errors.append(
            "app_menu.rs: menu_item() entries found — top bar is React-owned; keep native shell only"
        )


def check_manifest_empty_when_no_rust_menu(errors: list[str]) -> None:
    if not MENU_MANIFEST_RS.is_file():
        errors.append("run export_menu_rust_manifest.py first")
        return
    rust_ids = rust_menu_item_ids()
    manifest_ids = manifest_action_ids()
    if rust_ids != manifest_ids:
        errors.append(
            f"menu_manifest.rs stale: rust menu_item ids {sorted(rust_ids)!r} != manifest {sorted(manifest_ids)!r}"
        )


def check_zh_edit_p0(errors: list[str]) -> None:
    zh_ui = {k: v for k, v in load_json(UI_ZH).items() if isinstance(k, str) and isinstance(v, str)}
    shell_zh = load_json(SHELL_ZH)["menu"]
    shell_en = load_json(SHELL_EN)["menu"]

    for ui_key, expected in ZH_EDIT_P0_EXPECTED.items():
        val = zh_ui.get(ui_key, "")
        if val != expected:
            errors.append(f"zh-CN UI {ui_key}: expected {expected!r}, got {val!r}")
        if val in ZH_EDIT_P0_FORBIDDEN_EN:
            errors.append(f"zh-CN UI en-fallback usage: {ui_key} = {val!r}")

    for sk in RUST_EDIT_P0_SHELL_KEYS:
        if sk not in shell_zh:
            errors.append(f"shell zh-CN missing {sk}")
            continue
        v = shell_zh[sk]
        if v in ZH_EDIT_P0_FORBIDDEN_EN:
            errors.append(f"shell zh-CN en leak: {sk} = {v!r}")
        if v == shell_en.get(sk):
            errors.append(f"shell zh-CN en-fallback: {sk} (= {shell_en.get(sk)!r})")


def check_no_fallback_render_path(errors: list[str]) -> None:
    label_src = MENU_LABEL_TS.read_text(encoding="utf-8")
    for pat in FALLBACK_RENDER_PATTERNS:
        if re.search(pat, label_src):
            errors.append(f"menuLabel.ts: forbidden fallback render pattern {pat!r}")
    enforcer_src = ENFORCER_TS.read_text(encoding="utf-8")
    if "createMenuCompiler" in enforcer_src and re.search(
        r"catch\s*\{[\s\S]*return null",
        enforcer_src,
    ):
        errors.append("menu.enforcer.ts: must not swallow enforcement errors in createMenuCompiler")


def check_guard_and_compile(errors: list[str]) -> None:
    compile_src = COMPILE_TS.read_text(encoding="utf-8")
    if "assertMenuGuard" not in compile_src:
        errors.append("menu.compile.ts: compileMenuForLocale must call assertMenuGuard")
    guard_path = ROOT / "src/menu/menu.guard.ts"
    if not guard_path.is_file():
        errors.append("missing menu.guard.ts enforcement module")
    elif "assertMenuGuard" not in guard_path.read_text(encoding="utf-8"):
        errors.append("menu.guard.ts: missing assertMenuGuard")


def main() -> int:
    errors: list[str] = []
    check_react_native_app_menu(errors)
    check_manifest_empty_when_no_rust_menu(errors)
    check_zh_edit_p0(errors)
    check_no_fallback_render_path(errors)
    check_guard_and_compile(errors)

    if errors:
        print("menu enforcement errors:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print("OK: React menu runtime (native shell only, zh-CN Edit P0, guard, no fallback render)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
