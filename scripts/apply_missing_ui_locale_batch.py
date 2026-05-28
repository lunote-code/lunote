#!/usr/bin/env python3
"""Merge missing UI locale keys (export/theme/knowledge rail batch) into locale corpus."""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = pathlib.Path(__file__).resolve().parent / "locale_corpus" / "data" / "missing_ui_keys_batch.json"
CORPUS_DIR = ROOT / "scripts" / "locale_corpus" / "ui"
EN_PATH = ROOT / "src" / "i18n" / "locales" / "en.json"


def main() -> int:
    if not DATA.is_file():
        print(f"missing {DATA}", file=sys.stderr)
        return 1
    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    batch: dict[str, dict[str, str]] = json.loads(DATA.read_text(encoding="utf-8"))
    for locale, entries in sorted(batch.items()):
        corpus_path = CORPUS_DIR / f"{locale}.json"
        if not corpus_path.is_file():
            print(f"skip missing corpus {corpus_path.name}", file=sys.stderr)
            continue
        corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
        added = 0
        for key, value in entries.items():
            if key.startswith("meta."):
                continue
            if key not in en:
                print(f"skip {locale}: unknown key {key}", file=sys.stderr)
                continue
            if key not in corpus or corpus[key] == en[key]:
                if value != en[key]:
                    corpus[key] = value
                    added += 1
        corpus_path.write_text(
            json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"merged {added} keys into ui/{locale}.json")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_ui_locales.py")], check=True, cwd=ROOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
