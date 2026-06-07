#!/usr/bin/env python3
"""
Locale authenticity audit (do not mask untranslated keys via merge).

UI three-layer state (relative to all UI keys in en.json; sparse locale file text only):
  - translated: key present in file and value ≠ en
  - fallback: key present and value == en (pseudo-translation)
  - missing: key absent in file (runtime falls back to en)

Shell (src-tauri/i18n menu/tray/dialog/shell sections):
  - same field-wise comparison; silent fallback forbidden (same as en counts as untranslated)

Pseudo-locale detection (non-en):
  - pseudo_ratio = (fallback + missing) / total
  - pseudo_ratio > 0.60 → WARNING
  - pseudo_ratio > 0.80 → ERROR (--strict)
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
UI_DIR = ROOT / "src" / "i18n" / "locales"
UI_EN = UI_DIR / "en.json"
SHELL_DIR = ROOT / "src-tauri" / "i18n"
SHELL_EN = SHELL_DIR / "en.json"

META_PREFIX = "meta."

MIN_TRANSLATED: dict[str, float] = {
    "ja": 0.90,
    "ko": 0.90,
    "fr": 0.90,
    "de": 0.90,
    "es": 0.70,
    "ru": 0.70,
    "pt": 0.70,
    "it": 0.70,
    "zh-CN": 0.90,
    "zh-TW": 0.90,
}

MIN_SHELL_MENU_TRANSLATED: dict[str, float] = {
    "ja": 0.90,
    "ko": 0.90,
    "fr": 0.90,
    "de": 0.90,
    "es": 0.70,
    "ru": 0.70,
    "pt": 0.70,
    "it": 0.70,
    "zh-CN": 0.90,
    "zh-TW": 0.90,
}


def load_ui_flat(path: pathlib.Path) -> dict[str, str]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        raise ValueError(f"{path}: root must be object")
    out: dict[str, str] = {}
    for k, v in doc.items():
        if not isinstance(k, str):
            raise ValueError(f"{path}: non-string key {k!r}")
        if not isinstance(v, str):
            raise ValueError(f"{path}: `{k}` must be string")
        out[k] = v
    return out


def ui_comparable_keys(en: dict[str, str]) -> list[str]:
    return [k for k in en if not k.startswith(META_PREFIX)]


def ui_truth_stats(en: dict[str, str], raw: dict[str, str]) -> dict[str, int]:
    keys = ui_comparable_keys(en)
    translated = fallback = missing = 0
    for k in keys:
        if k not in raw:
            missing += 1
        elif raw[k] == en[k]:
            fallback += 1
        else:
            translated += 1
    return {
        "total": len(keys),
        "translated": translated,
        "fallback": fallback,
        "missing": missing,
    }


def pct(n: int, total: int) -> int:
    if total <= 0:
        return 0
    return int(round(100 * n / total))


def flat_shell_section(doc: dict, section: str) -> dict[str, str]:
    sec = doc.get(section)
    if not isinstance(sec, dict):
        return {}
    return {k: v for k, v in sec.items() if isinstance(k, str) and isinstance(v, str)}


def shell_section_truth(en_sec: dict[str, str], loc_sec: dict[str, str]) -> dict[str, int]:
    keys = list(en_sec.keys())
    translated = fallback = missing = 0
    for k in keys:
        if k not in loc_sec:
            missing += 1
        elif loc_sec[k] == en_sec[k]:
            fallback += 1
        else:
            translated += 1
    return {
        "total": len(keys),
        "translated": translated,
        "fallback": fallback,
        "missing": missing,
    }


def validate_ui(
    * ,
    warn_pseudo: float,
    error_pseudo: float,
    strict: bool,
    check_min_translated: bool,
) -> tuple[list[str], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    lines: list[str] = []

    en = load_ui_flat(UI_EN)
    lines.append("=== UI locales (sparse file truth — NOT merged) ===")
    lines.append(
        f"{'locale':<8} {'trans':>6} {'fallb':>6} {'miss':>6} {'pseudo':>7}  status"
    )
    lines.append("-" * 54)

    for path in sorted(UI_DIR.glob("*.json")):
        lid = path.stem
        if lid == "en":
            continue
        try:
            raw = load_ui_flat(path)
        except ValueError as e:
            errors.append(str(e))
            continue

        extra = set(raw) - set(en)
        for k in sorted(extra):
            if not k.startswith(META_PREFIX):
                errors.append(f"{lid}: unknown key `{k}` (not in en.json)")

        stats = ui_truth_stats(en, raw)
        t, f, m, total = stats["translated"], stats["fallback"], stats["missing"], stats["total"]
        pseudo_ratio = (f + m) / total if total else 0.0

        status = "OK"
        if pseudo_ratio >= error_pseudo:
            status = "INVALID"
            errors.append(
                f"{lid}: INVALID LOCALE — {pct(f + m, total)}% pseudo "
                f"(fallback {pct(f, total)}% + missing {pct(m, total)}%)"
            )
        elif pseudo_ratio >= warn_pseudo:
            status = "WARN"
            warnings.append(
                f"{lid}: {pct(f + m, total)}% pseudo (fallback {pct(f, total)}% / missing {pct(m, total)}%)"
            )

        min_t = MIN_TRANSLATED.get(lid)
        if check_min_translated and min_t is not None:
            tr = t / total if total else 0
            if tr < min_t:
                errors.append(
                    f"{lid}: translated {pct(t, total)}% < required {pct(int(min_t * 100), 100)}%"
                )
                status = "LOW"

        lines.append(
            f"{lid:<8} {pct(t, total):>5}% {pct(f, total):>5}% {pct(m, total):>5}% {pct(f + m, total):>6}%  {status}"
        )

    return errors, warnings, lines


def validate_shell(
    * ,
    warn_pseudo: float,
    error_pseudo: float,
    strict: bool,
    check_min_menu: bool,
) -> tuple[list[str], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    lines: list[str] = []

    en_doc = json.loads(SHELL_EN.read_text(encoding="utf-8"))
    en_menu = flat_shell_section(en_doc, "menu")

    lines.append("")
    lines.append("=== Shell menu truth (src-tauri/i18n/menu) ===")
    lines.append(f"{'locale':<8} {'trans':>6} {'fallb':>6} {'miss':>6} {'pseudo':>7}  status")
    lines.append("-" * 54)

    for path in sorted(SHELL_DIR.glob("*.json")):
        lid = path.stem
        if lid == "en":
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{lid}: invalid JSON — {e}")
            continue

        loc_menu = flat_shell_section(doc, "menu")
        stats = shell_section_truth(en_menu, loc_menu)
        t, f, m, total = stats["translated"], stats["fallback"], stats["missing"], stats["total"]
        pseudo_ratio = (f + m) / total if total else 0.0

        status = "OK"
        if pseudo_ratio >= error_pseudo:
            status = "INVALID"
            errors.append(f"{lid}: shell menu INVALID — {pct(f + m, total)}% pseudo")
        elif pseudo_ratio >= warn_pseudo:
            status = "WARN"
            warnings.append(f"{lid}: shell menu {pct(f + m, total)}% pseudo")

        min_t = MIN_SHELL_MENU_TRANSLATED.get(lid)
        if check_min_menu and min_t is not None:
            if (t / total if total else 0) < min_t:
                errors.append(
                    f"{lid}: shell menu translated {pct(t, total)}% < {pct(int(min_t * 100), 100)}%"
                )
                status = "LOW"

        lines.append(
            f"{lid:<8} {pct(t, total):>5}% {pct(f, total):>5}% {pct(m, total):>5}% {pct(f + m, total):>6}%  {status}"
        )

    return errors, warnings, lines


def main() -> int:
    ap = argparse.ArgumentParser(description="Locale truth audit (no merge masking)")
    ap.add_argument("--warn-pseudo-ratio", type=float, default=0.60)
    ap.add_argument("--error-pseudo-ratio", type=float, default=0.80)
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--check-min-translated", action="store_true")
    ap.add_argument("--ui-only", action="store_true")
    ap.add_argument("--shell-only", action="store_true")
    args = ap.parse_args()

    all_errors: list[str] = []
    all_warnings: list[str] = []
    report: list[str] = []

    if not args.shell_only:
        e, w, lines = validate_ui(
            warn_pseudo=args.warn_pseudo_ratio,
            error_pseudo=args.error_pseudo_ratio,
            strict=args.strict,
            check_min_translated=args.check_min_translated,
        )
        all_errors.extend(e)
        all_warnings.extend(w)
        report.extend(lines)

    if not args.ui_only:
        e, w, lines = validate_shell(
            warn_pseudo=args.warn_pseudo_ratio,
            error_pseudo=args.error_pseudo_ratio,
            strict=args.strict,
            check_min_menu=args.check_min_translated,
        )
        all_errors.extend(e)
        all_warnings.extend(w)
        report.extend(lines)

    print("\n".join(report))
    print()
    for w in all_warnings:
        print(f"WARNING: {w}", file=sys.stderr)
    for e in all_errors:
        print(f"ERROR: {e}", file=sys.stderr)

    if all_errors and args.strict:
        print(f"\nvalidate_locale: FAILED ({len(all_errors)} error(s))", file=sys.stderr)
        return 1

    print(
        f"validate_locale: OK ({len(all_warnings)} warning(s), {len(all_errors)} error(s))"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
