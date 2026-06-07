#!/usr/bin/env python3
"""
Build sparse UI locales from corpus (translated keys only + meta authenticity metrics).

meta.translated / meta.fallback / meta.missing = percent of all UI keys vs en (do not compute via merge).
meta.completion is deprecated; write the synonymous field only when the three sum to 100 for legacy tools.

Run: python3 scripts/build_ui_locales.py
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
EN_PATH = ROOT / "src" / "i18n" / "locales" / "en.json"
PATCH_DIR = ROOT / "scripts" / "ui_locale_patches"
CORPUS_DIR = ROOT / "scripts" / "locale_corpus" / "ui"
GAP_DIR = ROOT / "scripts" / "locale_corpus" / "gaps"
OUT_DIR = ROOT / "src" / "i18n" / "locales"

META_PREFIX = "meta."


def load_flat(path: pathlib.Path) -> dict[str, str]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        raise ValueError(f"{path}: root must be object")
    out: dict[str, str] = {}
    for k, v in doc.items():
        if not isinstance(k, str) or not isinstance(v, str):
            raise ValueError(f"{path}: all keys/values must be strings")
        out[k] = v
    return out


def truth_stats(en: dict[str, str], corpus: dict[str, str]) -> tuple[int, int, int, int]:
    keys = [k for k in en if not k.startswith(META_PREFIX)]
    translated = fallback = missing = 0
    for k in keys:
        if k not in corpus:
            missing += 1
        elif corpus[k] == en[k]:
            fallback += 1
        else:
            translated += 1
    return translated, fallback, missing, len(keys)


def pct(n: int, total: int) -> int:
    if total <= 0:
        return 0
    return int(round(100 * n / total))


def collect_corpus(locale_id: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for base in (PATCH_DIR, CORPUS_DIR, GAP_DIR):
        p = base / f"{locale_id}.json"
        if p.is_file():
            out.update(load_flat(p))
    return out


def main() -> int:
    if not EN_PATH.is_file():
        print(f"missing {EN_PATH}", file=sys.stderr)
        return 1

    en = load_flat(EN_PATH)
    locale_ids: set[str] = set()
    if PATCH_DIR.is_dir():
        locale_ids.update(p.stem for p in PATCH_DIR.glob("*.json") if p.stem != "en")
    if CORPUS_DIR.is_dir():
        locale_ids.update(p.stem for p in CORPUS_DIR.glob("*.json") if p.stem != "en")

    if not locale_ids:
        print("no locale corpus found", file=sys.stderr)
        return 1

    for lid in sorted(locale_ids):
        try:
            corpus = collect_corpus(lid)
        except ValueError as e:
            print(str(e), file=sys.stderr)
            return 1
        if not corpus:
            continue

        for k in corpus:
            if k not in en and not k.startswith("meta."):
                print(f"{lid}: unknown key `{k}` (not in en.json)", file=sys.stderr)
                return 1

        t, f, m, total = truth_stats(en, corpus)
        tr, fb, ms = pct(t, total), pct(f, total), pct(m, total)

        sparse: dict[str, str] = {}
        if "meta.nativeName" in corpus:
            sparse["meta.nativeName"] = corpus["meta.nativeName"]

        sparse["meta.translated"] = str(tr)
        sparse["meta.fallback"] = str(fb)
        sparse["meta.missing"] = str(ms)
        sparse["meta.completion"] = str(tr)

        for k in en:
            if k.startswith(META_PREFIX):
                continue
            if k in corpus and corpus[k] != en[k]:
                sparse[k] = corpus[k]

        ordered: dict[str, str] = {}
        for mk in ("meta.nativeName", "meta.translated", "meta.fallback", "meta.missing", "meta.completion"):
            if mk in sparse:
                ordered[mk] = sparse[mk]
        for k in sorted(sparse.keys()):
            if k.startswith("meta."):
                continue
            ordered[k] = sparse[k]

        out_path = OUT_DIR / f"{lid}.json"
        out_path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(
            f"wrote {out_path.relative_to(ROOT)} "
            f"(translated={tr}% fallback={fb}% missing={ms}%, {len(ordered)} keys)"
        )

    print("build_ui_locales: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
