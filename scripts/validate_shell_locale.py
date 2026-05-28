#!/usr/bin/env python3
"""
Verify `src-tauri/i18n/*.json` matches `src-tauri/src/shell_locale/schema.rs`:
- top-level keys are only menu / tray / dialog / shell
- each section's fields match the corresponding struct exactly (no missing/extra)
- all copy values are non-empty strings

Does not read or depend on frontend locale.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "src-tauri" / "src" / "shell_locale" / "schema.rs"
I18N_DIR = ROOT / "src-tauri" / "i18n"


def _struct_body(text: str, struct_name: str) -> str:
    needle = f"pub struct {struct_name} {{"
    start = text.index(needle) + len(needle)
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        i += 1
    return text[start : i - 1]


def _string_fields(body: str) -> list[str]:
    fields = re.findall(r"^\s*pub\s+(\w+)\s*:\s*String\s*,", body, re.MULTILINE)
    return fields


def load_schema_fields() -> dict[str, list[str]]:
    text = SCHEMA_PATH.read_text(encoding="utf-8")
    try:
        return {
            "menu": _string_fields(_struct_body(text, "ShellMenuStrings")),
            "tray": _string_fields(_struct_body(text, "TrayStrings")),
            "dialog": _string_fields(_struct_body(text, "DialogStrings")),
            "shell": _string_fields(_struct_body(text, "ShellStrings")),
        }
    except ValueError as e:
        raise ValueError(f"failed to parse {SCHEMA_PATH}: {e}") from e


def _check_section(
    errors: list[str],
    locale_id: str,
    section: str,
    expected: list[str],
    data: object,
) -> None:
    if not isinstance(data, dict):
        errors.append(f"{locale_id}: `{section}` must be a JSON object")
        return
    keys = set(data.keys())
    exp = set(expected)
    for k in sorted(exp - keys):
        errors.append(f"{locale_id}: missing `{section}.{k}`")
    for k in sorted(keys - exp):
        errors.append(f"{locale_id}: unknown `{section}.{k}` (not in schema)")
    for k in sorted(keys & exp):
        v = data[k]
        if not isinstance(v, str):
            errors.append(f"{locale_id}: `{section}.{k}` must be a string, got {type(v).__name__}")
        elif not v.strip():
            errors.append(f"{locale_id}: `{section}.{k}` must be non-empty")


def validate_file(path: pathlib.Path, schema: dict[str, list[str]]) -> list[str]:
    errors: list[str] = []
    locale_id = path.stem
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"{locale_id}: invalid JSON — {e}"]

    if not isinstance(doc, dict):
        return [f"{locale_id}: root must be an object"]

    top = set(doc.keys())
    required_top = set(schema.keys())
    for k in sorted(required_top - top):
        errors.append(f"{locale_id}: missing top-level key `{k}`")
    for k in sorted(top - required_top):
        errors.append(f"{locale_id}: unknown top-level key `{k}`")

    for section in required_top & top:
        _check_section(errors, locale_id, section, schema[section], doc[section])

    return errors


def main() -> int:
    if not SCHEMA_PATH.is_file():
        print(f"missing schema: {SCHEMA_PATH}", file=sys.stderr)
        return 1
    if not I18N_DIR.is_dir():
        print(f"missing i18n dir: {I18N_DIR}", file=sys.stderr)
        return 1

    try:
        schema = load_schema_fields()
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1

    for name, fields in schema.items():
        if not fields:
            print(f"schema section `{name}` has no fields (parse error?)", file=sys.stderr)
            return 1

    json_files = sorted(I18N_DIR.glob("*.json"))
    if not json_files:
        print(f"no *.json under {I18N_DIR}", file=sys.stderr)
        return 1

    all_errors: list[str] = []
    for p in json_files:
        all_errors.extend(validate_file(p, schema))

    if all_errors:
        for line in all_errors:
            print(line, file=sys.stderr)
        print(f"\nvalidate_shell_locale: {len(all_errors)} error(s)", file=sys.stderr)
        return 1

    print(f"validate_shell_locale: OK ({len(json_files)} locale files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
